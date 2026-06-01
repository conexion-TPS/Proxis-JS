import { NextResponse } from 'next/server'

// Medidor de uso de Gemini: agrega gemini_usage de hoy y de los últimos 7 días.
// Proactivo: permite ver el consumo vs el tope del free-tier sin esperar el 429.
export async function GET() {
  try {
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const desde7 = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/gemini_usage?select=componente,ok,total_tokens,created_at&created_at=gte.${desde7}`
    const r = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: 500 })
    const rows: Array<{ componente: string; ok: boolean; total_tokens: number | null; created_at: string }> = await r.json()

    const hoy0 = new Date(); hoy0.setUTCHours(0, 0, 0, 0)
    const hoy = rows.filter(x => new Date(x.created_at) >= hoy0)
    const agg = (arr: typeof rows) => ({
      llamadas: arr.length,
      tokens:   arr.reduce((s, x) => s + (x.total_tokens ?? 0), 0),
      fallos:   arr.filter(x => x.ok === false).length,
    })
    // Desglose por componente (hoy)
    const porComp: Record<string, number> = {}
    for (const x of hoy) porComp[x.componente] = (porComp[x.componente] ?? 0) + 1

    return NextResponse.json({ hoy: agg(hoy), semana: agg(rows), por_componente: porComp, cap_dia: 200 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
