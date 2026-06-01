import { NextResponse } from 'next/server'

// Invoca el proxis-analyzer para procesar las señales pendientes (genera hipótesis
// y marca procesada=true). Permite al admin "procesar ahora" sin esperar el cron.
export async function POST() {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/proxis-analyzer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ triggered_by: 'admin-senales' }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return NextResponse.json({ error: j.error ?? `HTTP ${r.status}` }, { status: 500 })
    return NextResponse.json({ ok: true, asesores: j.asesores ?? 0, totalSenales: j.totalSenales ?? j.senalesProcessed ?? 0 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error invocando analyzer' }, { status: 500 })
  }
}
