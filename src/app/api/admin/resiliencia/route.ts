import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminGoTrueSession } from '@/lib/adminAuth'
import { callGemini } from '@/lib/gemini'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// F6 — Análisis de resiliencia (f4), canal CERRADO solo-Admin.
// Gated por sesión GoTrue admin (cargo=admin). Lee con service_role (bypassa RLS) el score
// (asesor_perfil.resiliencia), las respuestas crudas de los ítems f4 y el análisis ya generado
// (tabla asesor_resiliencia). El análisis NUNCA se escribe en asesor_perfil ni se expone al
// supervisor: vive en su propia tabla, que el analyzer y equipo/informe no leen.

type Item = { orden: number | null; texto: string; negativo: boolean; respuesta: string | null; valor: number | null }
type Detalle = {
  score: { suma: number; base: number; n: number } | null
  items: Item[]
  analisis: string | null
  generado_at: string | null
}

function parseScore(raw: string | null | undefined): Detalle['score'] {
  const m = raw ? String(raw).match(/^\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*$/) : null
  return m ? { suma: +m[1], base: +m[2], n: +m[3] } : null
}

// Reúne score + desglose de los 5 ítems f4 (texto + respuesta cruda de Bart) + análisis guardado.
async function armarDetalle(asesor: string): Promise<Detalle> {
  const sb = supabaseAdmin()

  const [perfilRes, respRes, anaRes] = await Promise.all([
    sb.from('asesor_perfil').select('resiliencia').eq('asesor', asesor).maybeSingle(),
    sb.from('respuestas_cuestionario').select('pregunta_id, respuesta').eq('asesor', asesor),
    // La tabla puede no existir aún (TPS corre F6 luego): si falla, analisis = null y el desglose
    // se muestra igual.
    sb.from('asesor_resiliencia').select('analisis, generado_at').eq('asesor', asesor).maybeSingle(),
  ])

  const score = parseScore(perfilRes.data?.resiliencia ?? null)

  const respuestas = respRes.data ?? []
  const respPorPregunta = new Map(respuestas.map(r => [r.pregunta_id, String(r.respuesta)]))
  const ids = respuestas.map(r => r.pregunta_id)

  let items: Item[] = []
  if (ids.length) {
    const { data: preguntas } = await sb
      .from('preguntas')
      .select('id, orden, texto, opciones')
      .eq('dimension_target', 'tps_c_f4')
      .in('id', ids)
      .order('orden', { ascending: true })
    items = (preguntas ?? []).map(p => {
      const cruda = respPorPregunta.get(p.id) ?? null
      const negativo = (p.opciones as { negativo?: boolean } | null)?.negativo === true
      const n = cruda != null ? parseFloat(cruda) : NaN
      const valor = Number.isNaN(n) ? null : (negativo ? 6 - n : n)
      return { orden: p.orden ?? null, texto: p.texto as string, negativo, respuesta: cruda, valor }
    })
  }

  return {
    score,
    items,
    analisis: anaRes.error ? null : (anaRes.data?.analisis ?? null),
    generado_at: anaRes.error ? null : (anaRes.data?.generado_at ?? null),
  }
}

export async function GET(req: NextRequest) {
  if (!await isAdminGoTrueSession(req.headers.get('authorization')))
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const asesor = req.nextUrl.searchParams.get('asesor')
  if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })
  return NextResponse.json(await armarDetalle(asesor))
}

export async function POST(req: NextRequest) {
  if (!await isAdminGoTrueSession(req.headers.get('authorization')))
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const asesor = req.nextUrl.searchParams.get('asesor')
  if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })

  const detalle = await armarDetalle(asesor)
  if (!detalle.score) {
    return NextResponse.json({ error: 'Sin score de resiliencia (f4) para este asesor.' }, { status: 422 })
  }

  // Prompt de canal cerrado: SÍ usa el score crudo y las respuestas (lado cerrado del muro).
  const itemsTxt = detalle.items
    .map(i => `- "${i.texto}" → respuesta ${i.respuesta ?? '—'}${i.negativo ? ' (ítem inverso)' : ''} → aporta ${i.valor ?? '—'}`)
    .join('\n')
  const prompt = `Eres un experto en coaching comercial Proxis TPS. Analiza la RESILIENCIA (estabilidad bajo presión, factor f4) del asesor ${asesor} a partir de su cuestionario.

Score f4: ${detalle.score.suma} de ${detalle.score.base} (${detalle.score.n} ítems).
Respuestas a los ítems de resiliencia:
${itemsTxt || '(sin desglose disponible)'}

Escribe un análisis cualitativo conciso (máx. 180 palabras), en lenguaje observable y no clínico: qué implica este nivel de resiliencia para su desempeño comercial y para cómo acompañarlo. Devuelve SOLO el texto del análisis, sin encabezados ni JSON.`

  let analisis: string
  try {
    analisis = String(await callGemini(prompt, { maxTokens: 600, temperature: 0.6 })).trim()
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error de IA' }, { status: 502 })
  }
  if (!analisis) return NextResponse.json({ error: 'La IA no devolvió análisis.' }, { status: 502 })

  const generado_at = new Date().toISOString()
  const sb = supabaseAdmin()
  const { error } = await sb.from('asesor_resiliencia').upsert(
    { asesor, analisis, score_snapshot: `${detalle.score.suma}/${detalle.score.base}/${detalle.score.n}`, generado_por: 'generarResumen', generado_at },
    { onConflict: 'asesor' },
  )
  if (error) {
    // Tabla ausente (TPS aún no corrió F6) u otro fallo de escritura: se reporta claro.
    return NextResponse.json({ error: `No se pudo guardar el análisis: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ...detalle, analisis, generado_at })
}
