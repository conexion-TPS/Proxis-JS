import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Endpoint de salud para un watchdog EXTERNO (UptimeRobot). Devuelve:
//   200 si el cerebro corrió hace poco (sistema vivo y vigilándose)
//   503 si el cerebro lleva demasiado sin correr, no hay registros, o la BD falla
// Así, un servicio externo que hace ping cada pocos minutos detecta la "muerte
// total" que el propio cerebro no puede reportar (quien vigila al vigilante).
export const dynamic = 'force-dynamic'

const STALE_H = 30 // el cerebro corre a diario (~05:00); >30h sin correr = problema

export async function GET() {
  try {
    const sb = supabaseAdmin()
    const { data } = await sb
      .from('system_health_log')
      .select('checked_at, estado_global')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ ok: false, motivo: 'sin registros de salud del cerebro' }, { status: 503 })
    }
    const ageH  = (Date.now() - new Date(data.checked_at).getTime()) / 3_600_000
    const fresh = ageH <= STALE_H
    return NextResponse.json(
      { ok: fresh, last_cerebro: data.checked_at, age_h: Math.round(ageH * 10) / 10, estado_global: data.estado_global },
      { status: fresh ? 200 : 503 }
    )
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 503 })
  }
}
