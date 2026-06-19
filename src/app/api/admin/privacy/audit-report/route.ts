import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logLegalEvent } from '@/lib/legal'
import { isAdminGoTrueSession } from '@/lib/adminAuth'

/* Ítem 17C — Generador de reportes de auditoría de cumplimiento legal.
   Acceso restringido: requiere x-admin-key (ADMIN/PRIVACY_OFFICER). Lee legal_event_log
   (vía service_role, que hace bypass de RLS), filtra por fecha y tipo, calcula métricas. */

const EVENT_LABEL: Record<string, string> = {
  TERMS_ACCEPTED: 'Aceptación de términos', TERMS_COPY_SENT: 'Copia de términos enviada',
  CONSENT_GRANTED: 'Consentimiento otorgado', CONSENT_REVOKED: 'Consentimiento revocado',
  ACCOUNT_DELETION_REQUESTED: 'Solicitud de eliminación', ANONYMIZATION_COMPLETED: 'Anonimización completada',
  ANONYMIZATION_FAILED: 'Anonimización fallida', ANONYMIZATION_RETRIED: 'Anonimización reintentada',
  ARCOP_REQUEST_RECEIVED: 'Solicitud ARCOP+ recibida', ARCOP_REQUEST_RESOLVED: 'Solicitud ARCOP+ resuelta',
  ARCOP_REQUEST_OVERDUE: 'Solicitud ARCOP+ vencida', ARCOP_EXTENSION_GRANTED: 'Prórroga ARCOP+ otorgada',
  SUBPROCESSOR_CHANGE_NOTIFIED: 'Cambio de subencargado notificado', CONTRACT_TERMINATED: 'Contrato terminado',
  SUPPRESSION_CERTIFIED: 'Certificación de supresión', SECURITY_BREACH_REGISTERED: 'Brecha registrada',
  BREACH_NOTIFIED_APDP: 'Brecha notificada a APDP', SUPERVISOR_REACCEPTANCE: 'Re-aceptación de supervisor',
  TERMS_VERSION_PUBLISHED: 'Versión de términos publicada', TERMS_CHANGE_NOTIFIED: 'Cambio de términos notificado',
  VERIFICATION_PASSED: 'Verificación superada', VERIFICATION_FAILED: 'Verificación fallida',
  AUDIT_REPORT_GENERATED: 'Reporte de auditoría generado',
}

export async function GET(req: NextRequest) {
  // R3: aceptar sesión GoTrue admin (Bearer) O la x-admin-key vieja (DEPRECADA — quitar tras R4).
  const viaGoTrue = await isAdminGoTrueSession(req.headers.get('authorization'))
  const adminKey  = req.headers.get('x-admin-key')
  const expected  = process.env.ADMIN_PASSWORD   // sin literal: fail-closed si falta
  const viaKey    = !!(expected && adminKey === expected)   // DEPRECADO: quitar tras R4
  if (!viaGoTrue && !viaKey)
    return NextResponse.json({ error: 'Acceso restringido a ADMIN / PRIVACY_OFFICER' }, { status: 403 })

  const sb = supabaseAdmin()
  const p = req.nextUrl.searchParams
  const desde = p.get('date_from')
  const hasta = p.get('date_to')
  const tipos = p.get('event_types')?.split(',').filter(Boolean) ?? []
  const format = p.get('format') ?? 'json'

  let q = sb.from('legal_event_log').select('*').order('event_timestamp', { ascending: false })
  if (desde) q = q.gte('event_timestamp', desde)
  if (hasta) q = q.lte('event_timestamp', hasta + 'T23:59:59')
  if (tipos.length) q = q.in('event_type', tipos)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventos = (data ?? []).map(e => ({
    id: e.id, tipo: e.event_type, tipo_legible: EVENT_LABEL[e.event_type as string] ?? e.event_type,
    fecha_utc: e.event_timestamp, actor: e.actor_type, entidad: e.affected_entity,
    resumen: e.event_summary, marco_legal: e.legal_reference, riesgo: e.risk_level,
  }))

  const count = (t: string) => eventos.filter(e => e.tipo === t).length
  const metricas = {
    arcop_recibidas: count('ARCOP_REQUEST_RECEIVED'),
    arcop_resueltas: count('ARCOP_REQUEST_RESOLVED'),
    arcop_vencidas: count('ARCOP_REQUEST_OVERDUE'),
    anonimizaciones_completadas: count('ANONYMIZATION_COMPLETED'),
    anonimizaciones_fallidas: count('ANONYMIZATION_FAILED'),
    consentimientos_otorgados: count('CONSENT_GRANTED'),
    consentimientos_revocados: count('CONSENT_REVOKED'),
    brechas_registradas: count('SECURITY_BREACH_REGISTERED'),
    brechas_notificadas_apdp: count('BREACH_NOTIFIED_APDP'),
  }

  const reporte = {
    titulo: 'Informe de Auditoría de Cumplimiento Legal',
    responsable: { nombre: 'Futura Soluciones Digitales Limitada', rut: '77.662.922-7', representante: 'Hernán Luis Poblete Miranda' },
    marco_legal: 'Ley N° 21.719',
    periodo: { desde: desde ?? null, hasta: hasta ?? null },
    generado_at_utc: new Date().toISOString(),
    confidencialidad: 'Documento confidencial. Contiene registros de auditoría sin datos personales. Uso exclusivo para fines de cumplimiento ante la APDP.',
    metricas,
    total_eventos: eventos.length,
    eventos,
  }

  await logLegalEvent({
    event_type: 'AUDIT_REPORT_GENERATED', actor_type: 'ADMIN', affected_entity: 'SYSTEM',
    event_summary: `Informe de auditoría generado (${eventos.length} eventos)`, legal_reference: 'Ley 21.719', risk_level: 'LOW',
    metadata: { date_from: desde, date_to: hasta, event_count: eventos.length },
  })

  if (format === 'pdf') {
    // HTML imprimible (el cliente usa window.print → Guardar como PDF)
    const rows = eventos.map(e => `<tr><td>${e.fecha_utc}</td><td>${e.tipo_legible}</td><td>${e.actor}</td><td>${e.entidad ?? ''}</td><td>${e.resumen ?? ''}</td><td>${e.marco_legal ?? ''}</td><td>${e.riesgo}</td></tr>`).join('')
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${reporte.titulo}</title>
      <style>body{font-family:sans-serif;color:#1a1a1a;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:11px;margin-top:12px}th,td{border:1px solid #ccc;padding:5px;text-align:left}th{background:#f3f3f3}.meta{font-size:12px;color:#444;margin:4px 0}</style></head>
      <body><h1>${reporte.titulo}</h1>
      <div class="meta">${reporte.responsable.nombre} · RUT ${reporte.responsable.rut} · ${reporte.responsable.representante}</div>
      <div class="meta">Marco legal: ${reporte.marco_legal} · Período: ${desde ?? 'inicio'} a ${hasta ?? 'hoy'} · Generado: ${reporte.generado_at_utc}</div>
      <div class="meta" style="font-style:italic">${reporte.confidencialidad}</div>
      <h2 style="font-size:14px">Métricas del período</h2>
      <div class="meta">ARCOP+ recibidas: ${metricas.arcop_recibidas} · resueltas: ${metricas.arcop_resueltas} · vencidas: ${metricas.arcop_vencidas}</div>
      <div class="meta">Anonimizaciones OK: ${metricas.anonimizaciones_completadas} · fallidas: ${metricas.anonimizaciones_fallidas}</div>
      <div class="meta">Consentimientos otorgados: ${metricas.consentimientos_otorgados} · revocados: ${metricas.consentimientos_revocados}</div>
      <div class="meta">Brechas registradas: ${metricas.brechas_registradas} · notificadas APDP: ${metricas.brechas_notificadas_apdp}</div>
      <h2 style="font-size:14px">Eventos (${eventos.length})</h2>
      <table><thead><tr><th>Fecha UTC</th><th>Tipo</th><th>Actor</th><th>Entidad</th><th>Resumen</th><th>Marco</th><th>Riesgo</th></tr></thead><tbody>${rows}</tbody></table>
      </body></html>`
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  return NextResponse.json(reporte)
}
