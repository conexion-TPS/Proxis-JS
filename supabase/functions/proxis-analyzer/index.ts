// proxis-analyzer — Edge Function
// Cron: 0 22 * * 0  (domingo 22:00 UTC)
// Para cada asesor: analiza señales conductuales no procesadas,
// genera hipótesis, detecta vacíos de conocimiento, actualiza progresion_integrador.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY = Deno.env.get('GEMINI_KEY') ?? ''

const sb = createClient(SB_URL, SB_KEY)

/* ── Tipos ──────────────────────────────────────────────────── */

interface Signal {
  id: string
  asesor: string
  fuente: string
  tipo: string
  valor: string | null
  dimension_target: string | null
  perfil_hint: string | null
  confianza_hint: number | null
  created_at: string
}

interface PerfilActual {
  identidad_vendedora?: string
  relacion_prospeccion?: string
  modelos_mentales?: string
  relacion_feedback?: string
  perfil_conductual_notas?: string
  contexto_situacional?: string
  perfil_dominante?: string
  assertividad_score?: number
  sociabilidad_score?: number
  progresion_integrador?: number
  confianza_perfil?: number
  resumen_ia?: string
}

interface GeminiAnalysis {
  hipotesis: Array<{
    hipotesis: string
    dimension_afectada: string
    confianza: number
    valor_sugerido: string
    evidencia: string
  }>
  gaps_detectados: Array<{
    dimension: string
    descripcion: string
    prioridad: number
  }>
  progresion_integrador: number
  confianza_perfil: number
  resumen_analisis: string
}

/* ── Gemini ─────────────────────────────────────────────────── */

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error('GEMINI_KEY no configurada')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.4,
          responseMimeType: 'application/json'
        }
      })
    }
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
}

/* ── Análisis de un asesor ──────────────────────────────────── */

async function analizarAsesor(asesor: string): Promise<{
  hipotesis: number
  gaps: number
  progresion: number
  senalesProcessed: number
}> {
  // 1. Señales no procesadas
  const { data: signals } = await sb
    .from('behavioral_signals')
    .select('*')
    .eq('asesor', asesor)
    .eq('procesada', false)
    .order('created_at', { ascending: false })
    .limit(100)

  const seналes: Signal[] = signals ?? []
  if (!seналes.length) return { hipotesis: 0, gaps: 0, progresion: 0, senalesProcessed: 0 }

  // 2. Perfil actual
  const { data: perfilArr } = await sb
    .from('asesor_perfil')
    .select('*')
    .eq('asesor', asesor)
    .limit(1)

  const perfil: PerfilActual = perfilArr?.[0] ?? {}

  // 3. Conocimiento conductual relevante (para contexto)
  const { data: conocimiento } = await sb
    .from('knowledge_base_conductual')
    .select('categoria, titulo, contenido')
    .or(`perfil.is.null,perfil.eq.${perfil.perfil_dominante ?? 'GEN'}`)
    .limit(20)

  // 4. Construir prompt analítico
  const senalesTexto = seналes.map(s =>
    `[${s.fuente}] ${s.tipo}: ${s.valor ?? '—'} | dimensión: ${s.dimension_target ?? '?'} | perfil_hint: ${s.perfil_hint ?? '?'} | confianza: ${s.confianza_hint ?? '?'}% | fecha: ${s.created_at.slice(0,10)}`
  ).join('\n')

  const perfilTexto = Object.entries(perfil)
    .filter(([k]) => !['id','asesor','created_at','updated_at','resumen_ia'].includes(k))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')

  const conocimientoTexto = (conocimiento ?? [])
    .map(k => `[${k.categoria}] ${k.titulo}: ${String(k.contenido).slice(0, 200)}`)
    .join('\n')

  const prompt = `Eres un motor de análisis conductual experto en el modelo Merrill-Reid y el ciclo TPS de 7 pasos.
Tu tarea es analizar las señales conductuales de un asesor de seguros y generar hipótesis de conocimiento sobre su perfil y comportamiento.

## Asesor: ${asesor}

## Perfil actual
${perfilTexto || '(sin perfil previo)'}

## Señales conductuales recientes (${seналes.length} señales)
${senalesTexto}

## Base de conocimiento conductual disponible
${conocimientoTexto || '(vacía)'}

## Instrucciones
Analiza las señales y genera:
1. Hipótesis conductuales (máx. 5): inferencias sobre dimensiones del perfil, con nivel de confianza 0-100
2. Vacíos de conocimiento (máx. 3): dimensiones donde hay datos insuficientes para perfilar
3. Progresión hacia perfil integrador (0-100): qué tan maduro es el perfil conductual basado en las evidencias
4. Nivel de confianza global del perfil (0-100)
5. Resumen ejecutivo de 2-3 oraciones

Las dimensiones válidas son: identidad_vendedora, relacion_prospeccion, modelos_mentales, relacion_feedback, perfil_conductual_notas, contexto_situacional

Los perfiles Merrill-Reid: E (Energético/Driver/Águila), S (Sociable/Expressive/Pavo Real), R (Relacional/Amiable/Paloma), A (Reflexivo/Analytical/Búho)

IMPORTANTE: El perfil es siempre una hipótesis de trabajo, no un diagnóstico. Requiere consenso de múltiples evidencias.

Responde ÚNICAMENTE con JSON válido con esta estructura exacta:
{
  "hipotesis": [
    {
      "hipotesis": "texto de la hipótesis",
      "dimension_afectada": "nombre_dimension",
      "confianza": 75,
      "valor_sugerido": "texto sugerido para la dimensión",
      "evidencia": "señales específicas que sustentan esta hipótesis"
    }
  ],
  "gaps_detectados": [
    {
      "dimension": "nombre_dimension",
      "descripcion": "qué información falta y por qué es importante",
      "prioridad": 3
    }
  ],
  "progresion_integrador": 45,
  "confianza_perfil": 60,
  "resumen_analisis": "resumen ejecutivo"
}`

  // 5. Llamar a Gemini
  let analysis: GeminiAnalysis
  try {
    const raw = await callGemini(prompt)
    analysis = JSON.parse(raw)
  } catch (e) {
    console.error(`[${asesor}] Error parsing Gemini response:`, e)
    return { hipotesis: 0, gaps: 0, progresion: 0, senalesProcessed: 0 }
  }

  const sigIds = seналes.map(s => s.id)

  // 6. Guardar hipótesis en deductions_log
  let hipotesisCount = 0
  for (const h of (analysis.hipotesis ?? [])) {
    await sb.from('deductions_log').insert({
      asesor,
      hipotesis:          h.hipotesis,
      dimension_afectada: h.dimension_afectada,
      confianza:          h.confianza,
      valor_sugerido:     h.valor_sugerido,
      evidencia:          h.evidencia,
      senales_usadas:     sigIds.slice(0, 10),
      estado:             'pendiente'
    })
    hipotesisCount++
  }

  // 7. Guardar gaps en knowledge_gaps
  let gapsCount = 0
  for (const g of (analysis.gaps_detectados ?? [])) {
    // Evitar duplicar gaps ya abiertos para la misma dimensión
    const { data: existing } = await sb
      .from('knowledge_gaps')
      .select('id')
      .eq('asesor', asesor)
      .eq('dimension', g.dimension)
      .in('estado', ['detectado', 'en_investigacion'])
      .limit(1)

    if (!existing?.length) {
      await sb.from('knowledge_gaps').insert({
        asesor,
        dimension:   g.dimension,
        descripcion: g.descripcion,
        prioridad:   Math.min(5, Math.max(1, g.prioridad)),
        estado:      'detectado'
      })
      gapsCount++
    }
  }

  // 8. Actualizar progresion_integrador y confianza_perfil en asesor_perfil
  const nuevaProgresion   = analysis.progresion_integrador ?? perfil.progresion_integrador ?? 0
  const nuevaConfianza    = analysis.confianza_perfil      ?? perfil.confianza_perfil      ?? 0

  await sb.from('asesor_perfil').upsert(
    {
      asesor,
      progresion_integrador: nuevaProgresion,
      confianza_perfil:      nuevaConfianza,
      updated_at:            new Date().toISOString()
    },
    { onConflict: 'asesor' }
  )

  // 9. Marcar señales como procesadas
  await sb.from('behavioral_signals')
    .update({ procesada: true })
    .in('id', sigIds)

  return {
    hipotesis:        hipotesisCount,
    gaps:             gapsCount,
    progresion:       nuevaProgresion,
    senalesProcessed: seналes.length
  }
}

/* ── Handler principal ──────────────────────────────────────── */

Deno.serve(async (_req: Request) => {
  const results: any[] = []
  let totalHipotesis   = 0
  let totalGaps        = 0
  let totalSenales     = 0

  // Todos los asesores con señales pendientes
  const { data: pendingArr } = await sb
    .from('behavioral_signals')
    .select('asesor')
    .eq('procesada', false)

  const asesores = [...new Set((pendingArr ?? []).map((r: any) => r.asesor as string))]

  if (!asesores.length) {
    return new Response(
      JSON.stringify({ ok: true, msg: 'Sin señales pendientes para analizar' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  for (const asesor of asesores) {
    const item: any = { asesor }
    try {
      const r = await analizarAsesor(asesor)
      item.hipotesis        = r.hipotesis
      item.gaps             = r.gaps
      item.progresion       = r.progresion
      item.senalesProcessed = r.senalesProcessed
      item.status           = 'ok'
      totalHipotesis  += r.hipotesis
      totalGaps       += r.gaps
      totalSenales    += r.senalesProcessed
    } catch (e: any) {
      item.status = 'error'
      item.error  = e.message
      console.error(`[${asesor}]`, e)
    }
    results.push(item)
  }

  const summary = {
    ok:             true,
    asesores:       asesores.length,
    totalHipotesis,
    totalGaps,
    totalSenales,
    results
  }
  console.log(JSON.stringify(summary))
  return new Response(JSON.stringify(summary), {
    headers: { 'Content-Type': 'application/json' }
  })
})
