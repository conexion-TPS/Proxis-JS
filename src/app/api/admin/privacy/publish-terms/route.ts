import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logLegalEvent, getChileanHolidays, addChileanBusinessDays, sha256 } from '@/lib/legal'
import { sendLegalEmail } from '@/lib/resend'

/* Ítem 15 — Publicación de nueva versión de un documento legal.
   Entrada en vigor = publicación + 15 días hábiles chilenos. Requiere resumen de
   cambios (obligatorio). Notifica a los usuarios afectados y registra los eventos. */
export async function POST(req: NextRequest) {
  const sb = supabaseAdmin()
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  if (!b.resumen_cambios || !String(b.resumen_cambios).trim())
    return NextResponse.json({ error: 'El resumen de cambios es obligatorio para publicar' }, { status: 400 })

  const { data: doc } = await sb.from('legal_documentos').select('tipo, version, titulo').eq('id', b.id).single()
  if (!doc) return NextResponse.json({ error: 'documento no encontrado' }, { status: 404 })

  const holidays = await getChileanHolidays()
  const vigente = addChileanBusinessDays(new Date().toISOString().slice(0, 10), 15, holidays)

  // Desactivar otras versiones del tipo y activar esta con vigencia +15 hábiles.
  await sb.from('legal_documentos').update({ activo: false }).eq('tipo', doc.tipo)
  const { error } = await sb.from('legal_documentos')
    .update({ activo: true, vigente_desde: vigente, resumen_cambios: b.resumen_cambios })
    .eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logLegalEvent({
    event_type: 'TERMS_VERSION_PUBLISHED', actor_type: 'ADMIN', affected_entity: 'SYSTEM',
    event_summary: `Publicada ${doc.tipo} v${doc.version}; vigor ${vigente}`, legal_reference: 'Ley 21.719', risk_level: 'MEDIUM',
    metadata: { tipo: doc.tipo, version: doc.version, vigente_desde: vigente },
  })

  // Notificar a los usuarios afectados (asesores activos con email).
  const { data: creds } = await sb.from('asesor_credentials').select('asesor, email').eq('activo', true)
  let notificados = 0
  for (const c of creds ?? []) {
    if (!c.email) continue
    try {
      await sendLegalEmail({
        to: c.email as string, subject: `Actualización de ${doc.titulo} (v${doc.version})`,
        bodyHtml: `<p>Hola ${String(c.asesor).split(' ')[0]},</p>
          <p>Actualizamos el documento <strong>${doc.titulo}</strong> a la versión <strong>${doc.version}</strong>.</p>
          <p><strong>Resumen de cambios:</strong> ${b.resumen_cambios}</p>
          <p><strong>Entrada en vigor:</strong> ${vigente}. El uso continuado de la plataforma tras esa fecha constituye aceptación. Te solicitaremos aceptación expresa en tu próximo acceso.</p>
          <p><a href="https://proxis-dev-admin.vercel.app/legal/${doc.tipo}" style="color:#1a56c4">Ver el texto completo</a></p>`,
      })
      notificados++
    } catch { /* continuar */ }
  }

  await logLegalEvent({
    event_type: 'TERMS_CHANGE_NOTIFIED', actor_type: 'SYSTEM', affected_entity: 'USER_ACCOUNT',
    event_summary: `Notificación de cambio de ${doc.tipo} v${doc.version} a ${notificados} usuarios`,
    legal_reference: 'Ley 21.719', risk_level: 'LOW',
    metadata: { tipo: doc.tipo, version: doc.version, notificados, resumen_hash: sha256(b.resumen_cambios) },
  })

  return NextResponse.json({ ok: true, vigente_desde: vigente, notificados })
}
