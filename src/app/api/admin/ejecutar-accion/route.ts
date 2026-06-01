import { NextRequest, NextResponse } from 'next/server'

// Ejecuta REALMENTE la acción de una hipótesis (envía el mensaje al asesor o supervisor)
// vía la edge function proxis-accion. Antes el botón solo marcaba un flag sin enviar nada.
export async function POST(req: NextRequest) {
  const { deduction_id } = await req.json().catch(() => ({}))
  if (!deduction_id) return NextResponse.json({ error: 'deduction_id requerido' }, { status: 400 })

  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/proxis-accion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ deduction_id }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.ok === false) return NextResponse.json({ error: j.error ?? `HTTP ${r.status}` }, { status: 500 })
    return NextResponse.json(j)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error invocando proxis-accion' }, { status: 500 })
  }
}
