import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Endpoint de salud para un watchdog EXTERNO (UptimeRobot). Devuelve:
//   200 si el cerebro corrió hace <30h (sistema vivo y vigilándose)
//   503 SOLO ante un problema real: cerebro obsoleto, sin registros, o BD
//       caída tras varios reintentos. Un blip transitorio (cold start de
//       Vercel, latencia momentánea de Supabase) NO debe disparar alarma
//       (si no, el latido se vuelve "el cuento del lobo" y se ignora).
export const dynamic = 'force-dynamic'

const STALE_H = 30 // el cerebro corre a diario (~05:00); >30h sin correr = problema

export async function GET() {
  const sb = supabaseAdmin()
  let lastErr = ''

  // Reintentos: un fallo transitorio de BD no debe declarar "caído"
  for (let intento = 0; intento < 3; intento++) {
    if (intento > 0) await new Promise(r => setTimeout(r, 350))
    try {
      const { data, error } = await sb
        .from('system_health_log')
        .select('checked_at, estado_global')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) { lastErr = error.message; continue }      // transitorio → reintentar
      if (!data) return NextResponse.json({ ok: false, motivo: 'sin registros de salud del cerebro' }, { status: 503 })

      const ageH  = (Date.now() - new Date(data.checked_at).getTime()) / 3_600_000
      const fresh = ageH <= STALE_H
      return NextResponse.json(
        { ok: fresh, last_cerebro: data.checked_at, age_h: Math.round(ageH * 10) / 10, estado_global: data.estado_global },
        { status: fresh ? 200 : 503 }
      )
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)  // transitorio → reintentar
    }
  }

  // 3 intentos fallaron → problema real de conectividad/BD
  return NextResponse.json({ ok: false, error: lastErr || 'BD no responde' }, { status: 503 })
}
