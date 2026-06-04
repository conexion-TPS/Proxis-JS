// proxis-researcher — Edge Function
// Trigger: manual desde admin (/admin/hipotesis → "Investigar" en vacíos)
// Para cada knowledge_gap en estado 'en_investigacion':
// usa Gemini para sintetizar conocimiento conductual y crear una knowledge_proposal.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY = Deno.env.get('GEMINI_KEY') ?? ''

const sb = createClient(SB_URL, SB_KEY)

// Medidor de uso de Gemini: cada llamada (éxito o fallo) deja una fila con tokens reales.
async function logGeminiUso(ok: boolean, status: number, usage: any): Promise<void> {
  try {
    await sb.from('gemini_usage').insert({
      componente: 'proxis-researcher', ok, status,
      prompt_tokens: usage?.promptTokenCount ?? null,
      output_tokens: usage?.candidatesTokenCount ?? null,
      total_tokens:  usage?.totalTokenCount ?? null,
    })
  } catch (_) { /* best-effort */ }
}

/* ── Gemini ─────────────────────────────────────────────────── */

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error('GEMINI_KEY no configurada')
  let lastStatus = 0
  for (let intento = 0; intento < 4; intento++) {
    if (intento > 0) await new Promise(r => setTimeout(r, 2000 * intento))
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 3000,
            temperature: 0.5,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 } // sin "thinking" → los tokens van a la respuesta (mismo bug que tenia el analyzer)
          }
        })
      }
    )
    if (res.ok) { const data = await res.json(); await logGeminiUso(true, 200, data.usageMetadata); return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}' }
    lastStatus = res.status
    if (res.status !== 429 && res.status !== 503) break // solo reintentar transitorios
  }
  await logGeminiUso(false, lastStatus, null)
  throw new Error(`Gemini HTTP ${lastStatus}`)
}

/* ── Categorías y etapas del ciclo TPS ─────────────────────── */

const CATEGORIAS = [
  'activacion_nodo','prospeccion','creacion_relacion','diagnostico',
  'propuesta','cierre','servicio_postventa','gestion_emocional',
  'liderazgo_personal','productividad','comunicacion','aprendizaje','otro'
]

const ETAPAS_CICLO = ['activar', 'prospectar', 'entrevistar', 'proponer', 'manejar', 'cerrar', 'servir']

/* ── Investigar un gap ──────────────────────────────────────── */

async function investigarGap(gap: {
  id: string
  asesor: string
  dimension: string
  descripcion: string
  prioridad: number
}): Promise<boolean> {
  // Contexto: señales del asesor en esa dimensión
  const { data: senales } = await sb
    .from('behavioral_signals')
    .select('fuente,tipo,valor,perfil_hint,confianza_hint,created_at')
    .eq('asesor', gap.asesor)
    .eq('dimension_target', gap.dimension)
    .order('created_at', { ascending: false })
    .limit(30)

  // Perfil actual del asesor
  const { data: perfilArr } = await sb
    .from('asesor_perfil')
    .select('perfil_dominante,assertividad_score,sociabilidad_score,resumen_ia')
    .eq('asesor', gap.asesor)
    .limit(1)

  const perfil = perfilArr?.[0] ?? {}

  // Conocimiento existente en la dimensión
  const { data: conocimientoExistente } = await sb
    .from('knowledge_base_conductual')
    .select('titulo,contenido,perfil,categoria')
    .eq('dimension', gap.dimension)
    .limit(10)

  const senalesTexto = (senales ?? []).map(s =>
    `[${s.fuente}] ${s.tipo}: ${s.valor ?? '—'} | perfil_hint: ${s.perfil_hint ?? '?'} | conf: ${s.confianza_hint ?? '?'}%`
  ).join('\n') || '(sin señales para esta dimensión)'

  const conocimientoTexto = (conocimientoExistente ?? []).map(k =>
    `[${k.perfil ?? 'GEN'}/${k.categoria}] ${k.titulo}: ${String(k.contenido).slice(0, 300)}`
  ).join('\n') || '(sin conocimiento previo en esta dimensión)'

  const prompt = `Eres un investigador especializado en psicología conductual aplicada a ventas de seguros, con dominio del modelo Merrill-Reid y el ciclo TPS de 7 pasos.

## Vacío de conocimiento a investigar
Asesor: ${gap.asesor}
Dimensión: ${gap.dimension}
Descripción del vacío: ${gap.descripcion}
Prioridad: ${gap.prioridad}/5

## Perfil actual del asesor
Perfil dominante: ${perfil.perfil_dominante ?? 'desconocido'}
Assertividad: ${perfil.assertividad_score ?? '?'}/10
Sociabilidad: ${perfil.sociabilidad_score ?? '?'}/10
Resumen IA: ${perfil.resumen_ia?.slice(0, 300) ?? '(sin resumen)'}

## Señales conductuales disponibles en esta dimensión
${senalesTexto}

## Conocimiento conductual ya registrado en esta dimensión
${conocimientoTexto}

## Instrucciones
Sintetiza el conocimiento conductual que falta para perfilar completamente al asesor en la dimensión "${gap.dimension}".
Genera UNA propuesta de conocimiento conductual estructurada que:
1. Sea específica para el perfil Merrill-Reid del asesor (o general si el perfil es incierto)
2. Se apoye en las señales disponibles y razonamiento inductivo
3. Pueda ser validada por un humano antes de incorporarse a la base de conocimiento

Categorías válidas: ${CATEGORIAS.join(', ')}
Etapas del ciclo TPS: ${ETAPAS_CICLO.join(', ')} (usa null si no aplica)
Perfiles Merrill-Reid: E, S, R, A, GEN (usa GEN si aplica a todos)

Responde ÚNICAMENTE con JSON válido:
{
  "titulo": "título descriptivo de la entrada de conocimiento",
  "contenido": "contenido detallado del conocimiento (2-4 párrafos)",
  "perfil": "E|S|R|A|GEN",
  "categoria": "una de las categorías válidas",
  "etapa_ciclo": "una de las etapas o null",
  "completitud": 60,
  "regla_inferencia": "descripción de la regla de inferencia usada para llegar a este conocimiento",
  "accion_correctiva": "qué hacer cuando este patrón se detecta en un asesor",
  "justificacion": "por qué esta propuesta llena el vacío detectado"
}`

  let parsed: any
  try {
    const raw = await callGemini(prompt)
    parsed = JSON.parse(raw)
  } catch (e) {
    const emsg = e instanceof Error ? e.message : String(e)
    console.error(`[gap ${gap.id}] Error parsing Gemini:`, emsg)
    await sb.from('error_log').insert({ componente: 'proxis-researcher', severidad: 'warning', mensaje: `Gemini falló investigando gap ${gap.dimension} (${gap.asesor}): ${emsg}` }).then(undefined, () => {})
    return false
  }

  // Insertar en knowledge_proposals
  await sb.from('knowledge_proposals').insert({
    gap_id:          gap.id,
    asesor:          gap.asesor,
    titulo:          parsed.titulo,
    contenido:       parsed.contenido,
    perfil:          parsed.perfil,
    categoria:       parsed.categoria,
    etapa_ciclo:     parsed.etapa_ciclo ?? null,
    completitud:     Math.min(100, Math.max(0, parsed.completitud ?? 60)),
    regla_inferencia: parsed.regla_inferencia ?? null,
    accion_correctiva: parsed.accion_correctiva ?? null,
    justificacion:   parsed.justificacion ?? null,
    estado:          'pendiente'
  })

  // Actualizar gap → en_revision
  await sb.from('knowledge_gaps')
    .update({ estado: 'en_revision' })
    .eq('id', gap.id)

  return true
}

/* ── Handler principal ──────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  try {
  // Acepta ?gap_id=uuid para investigar un gap específico,
  // o sin parámetros para procesar todos los 'en_investigacion'
  const url   = new URL(req.url)
  const gapId = url.searchParams.get('gap_id')

  let query = sb
    .from('knowledge_gaps')
    .select('*')
    .eq('estado', 'en_investigacion')
    .order('prioridad', { ascending: false })

  if (gapId) query = query.eq('id', gapId) as any

  const { data: gaps, error } = await query.limit(20)

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (!gaps?.length) {
    return new Response(
      JSON.stringify({ ok: true, msg: 'Sin gaps en estado en_investigacion' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const results: any[] = []
  let ok = 0

  for (const gap of gaps) {
    try {
      const success = await investigarGap(gap)
      results.push({ id: gap.id, asesor: gap.asesor, dimension: gap.dimension, status: success ? 'ok' : 'error' })
      if (success) ok++
    } catch (e: any) {
      results.push({ id: gap.id, asesor: gap.asesor, dimension: gap.dimension, status: 'error', error: e.message })
      console.error(`[gap ${gap.id}]`, e)
    }
  }

  const summary = { ok: true, processed: gaps.length, successful: ok, results }
  console.log(JSON.stringify(summary))
  return new Response(JSON.stringify(summary), {
    headers: { 'Content-Type': 'application/json' }
  })
  } catch (e: any) {
    console.error('[proxis-researcher] FATAL:', e)
    await sb.from('error_log').insert({
      componente: 'proxis-researcher',
      severidad:  'error',
      mensaje:    e?.message ?? String(e),
      detalles:   { stack: e?.stack ?? '', timestamp: new Date().toISOString() },
    }).then(undefined, () => {})
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'Error interno' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
