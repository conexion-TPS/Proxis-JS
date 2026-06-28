import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

// dimension_target → módulo A/B/C/D (autoridad server-side; no se confía en el label del cliente)
function moduloDe(dim: string | null | undefined): 'A' | 'B' | 'C' | 'D' | null {
  if (dim === 'tps_a') return 'A'
  if (dim === 'tps_b') return 'B'
  if (dim === 'tps_d') return 'D'
  if (dim && dim.startsWith('tps_c_')) return 'C'   // f1..f5 + adapt
  return null
}

// POST /api/cuestionario/progreso-modulos  { cuestionario_id, respuestas:[{ pregunta_id, respuesta, score_valor? }] }
//   → upsert idempotente a progreso_cuestionario por (asesor, pregunta_id). Módulo derivado del
//   dimension_target de cada pregunta (lookup preguntas). No asume realtime.
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400, headers: cors })
  }

  const { cuestionario_id, respuestas } = body
  if (!cuestionario_id || !Array.isArray(respuestas)) {
    return NextResponse.json({ error: 'Faltan campos: cuestionario_id, respuestas[]' }, { status: 400, headers: cors })
  }

  const sb = supabaseAdmin()

  // Lookup de preguntas del cuestionario para derivar el módulo (dimension_target)
  const { data: preguntas } = await sb.from('preguntas')
    .select('id, dimension_target').eq('cuestionario_id', cuestionario_id)
  const dimDe = new Map((preguntas ?? []).map(p => [p.id, p.dimension_target as string]))

  const filas: any[] = []
  for (const r of respuestas) {
    if (!r.pregunta_id || r.respuesta === undefined || r.respuesta === null) continue
    const modulo = moduloDe(dimDe.get(r.pregunta_id))
    if (!modulo) continue                                   // pregunta sin dimensión TPS → se ignora
    filas.push({
      asesor,
      pregunta_id: r.pregunta_id,
      modulo,
      respuesta:  String(r.respuesta),
      score_valor: r.score_valor ?? null,
      updated_at: new Date().toISOString(),
    })
  }

  if (filas.length) {
    const { error } = await sb.from('progreso_cuestionario')
      .upsert(filas, { onConflict: 'asesor,pregunta_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }

  return NextResponse.json({ ok: true, guardadas: filas.length }, { headers: cors })
}

// GET /api/cuestionario/progreso-modulos  → [{ pregunta_id, modulo, respuesta, score_valor, updated_at }]
//   del asesor del token. Cualquier ambiente (Sailor/Bitácora/Mi Espacio) arma el estado y retoma.
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const sb = supabaseAdmin()
  const { data, error } = await sb.from('progreso_cuestionario')
    .select('pregunta_id, modulo, respuesta, score_valor, updated_at')
    .eq('asesor', asesor)
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors })

  return NextResponse.json({ ok: true, asesor, respuestas: data ?? [] }, { headers: cors })
}
