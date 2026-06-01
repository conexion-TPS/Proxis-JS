import { NextResponse } from 'next/server'

// Invoca proxis-cerebro en modo "arnés de canarios": siembra datos sintéticos,
// invoca cada pipeline, verifica su contrato y limpia. Corre BAJO DEMANDA (no en
// el cron diario) para no gastar Gemini automáticamente mientras no haya tier pago.
export async function POST() {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/proxis-cerebro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ run_canaries: true, triggered_by: 'admin-canarios' }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return NextResponse.json({ error: j.error ?? `HTTP ${r.status}` }, { status: 500 })
    return NextResponse.json(j)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error invocando canarios' }, { status: 500 })
  }
}
