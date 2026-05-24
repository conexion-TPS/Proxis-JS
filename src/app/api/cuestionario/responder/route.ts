import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

/* Merrill-Reid scoring
   assertividad: eje "decir" vs "preguntar" — alto = Driver/Expressive
   sociabilidad: eje "gente" vs "tarea"     — alto = Expressive/Amiable
   Cuadrantes:
     E (Águila)   = alta assertividad + baja sociabilidad
     S (Pavo Real)= alta assertividad + alta sociabilidad
     R (Paloma)   = baja assertividad + alta sociabilidad
     A (Búho)     = baja assertividad + baja sociabilidad
*/
function calcularPerfil(a: number, s: number): 'E' | 'S' | 'R' | 'A' {
  const midA = 5, midS = 5
  if (a >= midA && s <  midS) return 'E'
  if (a >= midA && s >= midS) return 'S'
  if (a <  midA && s >= midS) return 'R'
  return 'A'
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { asesor, cuestionario_id, respuestas } = body
  // respuestas: Array<{ pregunta_id, respuesta, dimension_target, perfil_hint, eje }>
  // eje: 'assertividad' | 'sociabilidad' | null

  if (!asesor || !cuestionario_id || !Array.isArray(respuestas)) {
    return NextResponse.json(
      { error: 'Campos requeridos: asesor, cuestionario_id, respuestas[]' },
      { status: 400 }
    )
  }

  const sb = supabaseAdmin()

  // 1. Obtener info del cuestionario para saber si es onboarding
  const { data: cues } = await sb
    .from('cuestionarios')
    .select('tipo, nombre')
    .eq('id', cuestionario_id)
    .single()

  const esOnboarding = cues?.tipo === 'onboarding'

  // 2. Guardar respuestas + generar señales conductuales
  const signalInserts: any[] = []
  const assertividades: number[] = []
  const sociabilidades: number[] = []

  for (const r of respuestas) {
    if (!r.pregunta_id || r.respuesta === undefined) continue

    // Guardar en respuestas_cuestionario
    await sb.from('respuestas_cuestionario').insert({
      asesor,
      cuestionario_id,
      pregunta_id: r.pregunta_id,
      respuesta:   String(r.respuesta),
      contexto:    r.contexto ?? null,
    })

    // Generar señal conductual desde la respuesta
    if (r.dimension_target) {
      signalInserts.push({
        asesor,
        fuente:           'cuestionario',
        tipo:             `respuesta_${cues?.tipo ?? 'cuestionario'}`,
        valor:            String(r.respuesta),
        dimension_target: r.dimension_target,
        perfil_hint:      r.perfil_hint ?? null,
        confianza_hint:   r.confianza_hint ?? 55,
        procesada:        false,
      })
    }

    // Acumular scores para onboarding
    if (esOnboarding && r.eje && r.respuesta !== null) {
      const val = parseFloat(String(r.respuesta))
      if (!isNaN(val)) {
        if (r.eje === 'assertividad') assertividades.push(val)
        if (r.eje === 'sociabilidad') sociabilidades.push(val)
      }
    }
  }

  if (signalInserts.length) {
    await sb.from('behavioral_signals').insert(signalInserts)
  }

  // 3. Si es onboarding, calcular scores y actualizar asesor_perfil
  let scores: { assertividad: number; sociabilidad: number; perfil: string } | null = null

  if (esOnboarding && (assertividades.length || sociabilidades.length)) {
    const avg = (arr: number[]) =>
      arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 5

    const assertividad = avg(assertividades)
    const sociabilidad = avg(sociabilidades)
    const perfil       = calcularPerfil(assertividad, sociabilidad)

    await sb.from('asesor_perfil').upsert(
      {
        asesor,
        assertividad_score: assertividad,
        sociabilidad_score: sociabilidad,
        perfil_dominante:   perfil,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'asesor' }
    )

    scores = { assertividad, sociabilidad, perfil }
  }

  return NextResponse.json({ ok: true, signals: signalInserts.length, scores }, { headers: corsHeaders(req.headers.get('origin')) })
}
