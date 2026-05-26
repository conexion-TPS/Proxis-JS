import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { gap_id } = await req.json().catch(() => ({}))
  if (!gap_id) return NextResponse.json({ error: 'gap_id requerido' }, { status: 400 })

  const sb = supabaseAdmin()

  // Mark gap as en_investigacion
  const { error: upErr } = await sb
    .from('knowledge_gaps')
    .update({ estado: 'en_investigacion' })
    .eq('id', gap_id)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Call proxis-researcher Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const funcRes = await fetch(
      `${supabaseUrl}/functions/v1/proxis-researcher?gap_id=${gap_id}`,
      { headers: { Authorization: `Bearer ${serviceKey}` } }
    )
    const result = await funcRes.json()
    return NextResponse.json({ ok: true, researcher: result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error llamando proxis-researcher'
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
