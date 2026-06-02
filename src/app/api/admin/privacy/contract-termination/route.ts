import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logLegalEvent, sha256 } from '@/lib/legal'
import { sendLegalEmail } from '@/lib/resend'

/* Ítem 9 — Terminación de contrato corporativo + certificación de supresión.
   Anonimiza a todos los asesores de la institución y emite una certificación
   (datos para PDF) que se entrega al contacto de privacidad dentro de 30 días hábiles. */
export async function POST(req: NextRequest) {
  const sb = supabaseAdmin()
  const b = await req.json()
  if (!b.institucion_id) return NextResponse.json({ error: 'institucion_id requerido' }, { status: 400 })

  const { data: inst } = await sb.from('instituciones').select('nombre').eq('id', b.institucion_id).single()
  if (!inst) return NextResponse.json({ error: 'institución no encontrada' }, { status: 404 })

  // Asesores de la institución (vía sus nodos).
  const { data: nodos } = await sb.from('org_nodos').select('id').eq('institucion_id', b.institucion_id)
  const nodoIds = (nodos ?? []).map(n => n.id)
  const { data: creds } = nodoIds.length
    ? await sb.from('asesor_credentials').select('asesor').in('org_nodo_id', nodoIds)
    : { data: [] as { asesor: string }[] }

  const asesores = (creds ?? []).map(c => c.asesor as string)
  let procesados = 0
  const hashes: string[] = []
  for (const asesor of asesores) {
    const { data: r, error } = await sb.rpc('anonimizar_asesor', { p_asesor: asesor })
    if (!error && r?.success) { procesados++; hashes.push(r.event_hash as string) }
  }

  const cert = {
    titulo: 'Certificación de Supresión de Datos',
    empresa: inst.nombre,
    institucion_id: b.institucion_id,
    fecha_termino: b.fecha_termino ?? new Date().toISOString().slice(0, 10),
    usuarios_procesados: procesados,
    usuarios_totales: asesores.length,
    fecha_proceso_utc: new Date().toISOString(),
    responsable: { nombre: 'Futura Soluciones Digitales Limitada', rut: '77.662.922-7', representante: 'Hernán Luis Poblete Miranda' },
    hash_verificacion: sha256(b.institucion_id + procesados + new Date().toISOString().slice(0, 10) + 'SUPPRESSION'),
  }

  await logLegalEvent({
    event_type: 'CONTRACT_TERMINATED', actor_type: 'ADMIN', affected_entity: 'CONTRACT',
    event_summary: `Contrato terminado: ${inst.nombre} (${procesados}/${asesores.length} usuarios anonimizados)`,
    legal_reference: 'Ley 21.719 (supresión al término)', risk_level: 'HIGH',
    metadata: { institucion_id: b.institucion_id, procesados, totales: asesores.length },
  })
  await logLegalEvent({
    event_type: 'SUPPRESSION_CERTIFIED', actor_type: 'ADMIN', affected_entity: 'CONTRACT',
    event_summary: `Certificación de supresión emitida para ${inst.nombre}`,
    legal_reference: 'Ley 21.719', risk_level: 'MEDIUM',
    metadata: { institucion_id: b.institucion_id, hash_verificacion: cert.hash_verificacion },
  })

  const destinatario = b.contacto_email ?? process.env.PRIVACY_ADMIN_EMAIL ?? 'privacidad@theprecisionselling.com'
  try {
    await sendLegalEmail({
      to: destinatario, subject: `Certificación de Supresión — ${inst.nombre}`,
      bodyHtml: `<p><strong>Certificación de Supresión de Datos</strong></p>
        <ul>
          <li><strong>Empresa:</strong> ${inst.nombre}</li>
          <li><strong>Fecha de término:</strong> ${cert.fecha_termino}</li>
          <li><strong>Usuarios procesados:</strong> ${procesados} de ${asesores.length}</li>
          <li><strong>Fecha/hora del proceso (UTC):</strong> ${cert.fecha_proceso_utc}</li>
          <li><strong>Hash de verificación:</strong> <code>${cert.hash_verificacion}</code></li>
        </ul>
        <p>Emitida por Futura Soluciones Digitales Limitada · RUT 77.662.922-7 · Hernán Luis Poblete Miranda, dentro de los 30 días hábiles del término del contrato.</p>`,
    })
  } catch { /* no bloquea */ }

  return NextResponse.json({ ok: true, certificacion: cert })
}
