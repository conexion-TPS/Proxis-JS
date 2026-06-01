import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/* Módulo B — Monitor de salidas (eliminaciones y anonimizaciones).
   El feed NUNCA muestra datos personales: el log de auditoría es inmutable y sin PII. */
export async function GET() {
  const sb = supabaseAdmin()
  const inicioMes = new Date(); inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0)

  const [{ data: eventos }, { count: activos }, { data: solicitudesElim }] = await Promise.all([
    sb.from('anonymization_audit_log').select('*').order('event_timestamp', { ascending: false }).limit(200),
    sb.from('asesor_credentials').select('*', { count: 'exact', head: true }).eq('activo', true),
    sb.from('derechos_solicitudes').select('estado, created_at').eq('tipo', 'eliminar'),
  ])

  const ev = eventos ?? []
  const kpis = {
    cuentas_activas: activos ?? 0,
    eliminaciones_mes: (solicitudesElim ?? []).filter(s => new Date(s.created_at as string) >= inicioMes).length,
    eliminaciones_total: (solicitudesElim ?? []).length,
    anonimizaciones_ok: ev.filter(e => e.process_status === 'SUCCESS').length,
    anonimizaciones_fallidas: ev.filter(e => e.process_status === 'FAILED' || e.process_status === 'PARTIAL').length,
  }
  return NextResponse.json({ eventos: ev, kpis })
}
