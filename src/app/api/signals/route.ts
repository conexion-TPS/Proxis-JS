import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { asesor, fuente, tipo, valor, dimension_target, perfil_hint, confianza_hint } = body

  if (!asesor || !fuente || !tipo) {
    return NextResponse.json(
      { error: 'Campos requeridos: asesor, fuente, tipo' },
      { status: 400 }
    )
  }

  const FUENTES_VALIDAS = ['plataforma', 'email', 'sailor', 'cuestionario', 'manual']
  if (!FUENTES_VALIDAS.includes(fuente)) {
    return NextResponse.json(
      { error: `fuente debe ser uno de: ${FUENTES_VALIDAS.join(', ')}` },
      { status: 400 }
    )
  }

  const sb = supabaseAdmin()
  const { data, error } = await sb.from('behavioral_signals').insert({
    asesor,
    fuente,
    tipo,
    valor:            valor ?? null,
    dimension_target: dimension_target ?? null,
    perfil_hint:      perfil_hint ?? null,
    confianza_hint:   confianza_hint ?? null,
    procesada:        false
  }).select('id').single()

  if (error) {
    console.error('[/api/signals]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201, headers: corsHeaders(req.headers.get('origin')) })
}
