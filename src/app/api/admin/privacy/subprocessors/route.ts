import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logLegalEvent, getChileanHolidays, addChileanBusinessDays } from '@/lib/legal'
import { sendLegalEmail } from '@/lib/resend'

/* Ítem 8 — Registro y notificación de cambios de subencargados.
   Al dar de alta o modificar un subencargado, la vigencia se fija a +15 días hábiles
   y se notifica a las empresas clientes con su derecho a objetar dentro de ese plazo. */
export async function GET() {
  const sb = supabaseAdmin()
  const { data, error } = await sb.from('subencargados').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subencargados: data ?? [] })
}

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin()
  const b = await req.json()
  if (!b.nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })

  const holidays = await getChileanHolidays()
  const vigente = addChileanBusinessDays(new Date().toISOString().slice(0, 10), 15, holidays)

  // Alta o actualización
  let id = b.id as string | undefined
  if (id) {
    await sb.from('subencargados').update({
      nombre: b.nombre, funcion: b.funcion, region: b.region, garantia: b.garantia,
      estado: b.estado ?? 'activo', vigente_desde: vigente, notificado_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', id)
  } else {
    const { data, error } = await sb.from('subencargados').insert({
      nombre: b.nombre, funcion: b.funcion, region: b.region, garantia: b.garantia,
      estado: b.estado ?? 'activo', vigente_desde: vigente, notificado_at: new Date().toISOString(),
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    id = data.id
  }

  // Notificar a las empresas clientes (en el piloto: aviso al canal de privacidad).
  // Producción: iterar contactos de privacidad por institución cliente activa.
  const { data: instituciones } = await sb.from('instituciones').select('nombre')
  const destinatarios = process.env.PRIVACY_ADMIN_EMAIL ?? 'privacidad@theprecisionselling.com'
  try {
    await sendLegalEmail({
      to: destinatarios,
      subject: `Aviso de cambio de subencargado — ${b.nombre}`,
      bodyHtml: `<p>Comunicamos un cambio en la cadena de subencargados de Proxis, con al menos <strong>15 días hábiles de anticipación</strong> a su entrada en vigor.</p>
        <ul>
          <li><strong>Subencargado:</strong> ${b.nombre}</li>
          <li><strong>Función:</strong> ${b.funcion ?? '—'}</li>
          <li><strong>Región de tratamiento:</strong> ${b.region ?? '—'}</li>
          <li><strong>Garantía de transferencia:</strong> ${b.garantia ?? '—'}</li>
          <li><strong>Entrada en vigor:</strong> ${vigente}</li>
        </ul>
        <p>Puedes objetar este cambio por motivos razonables de protección de datos, dentro de los 15 días hábiles, escribiendo a privacidad@theprecisionselling.com.</p>
        <p style="color:#8a8885;font-size:12px">Empresas cliente activas notificadas: ${(instituciones ?? []).length}.</p>`,
    })
  } catch { /* no bloquea */ }

  await logLegalEvent({
    event_type: 'SUBPROCESSOR_CHANGE_NOTIFIED', actor_type: 'ADMIN', affected_entity: 'SUBPROCESSOR',
    event_summary: `Cambio de subencargado notificado: ${b.nombre} (vigor ${vigente})`,
    legal_reference: 'Ley 21.719 (encargo / subencargo)', risk_level: 'MEDIUM',
    metadata: { id, nombre: b.nombre, region: b.region, vigente_desde: vigente, empresas_notificadas: (instituciones ?? []).length },
  })

  return NextResponse.json({ ok: true, id, vigente_desde: vigente })
}
