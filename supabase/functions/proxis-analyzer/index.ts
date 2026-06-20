// proxis-analyzer — Edge Function
// Cron: 0 22 * * 0  (domingo 22:00 UTC)
// Para cada asesor: analiza señales conductuales no procesadas,
// genera hipótesis, detecta vacíos de conocimiento, actualiza progresion_integrador.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { callAI, callAIJson } from '../_shared/ai-client.ts'
import { getAsesoresAutorizados } from '../_shared/tenant.ts'
import { codigoOrigenAIdTipo } from '../_shared/tipo-catalogo.ts'
import { logUsoSensible, type UsoSensibleEvento } from '../_shared/log-uso-sensible.ts'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    accion_tipo: 'trigger' | 'ajuste_dimension' | 'escalar_supervisor' | 'ninguna'
    accion_descripcion: string
  }>
  gaps_detectados: Array<{
    dimension: string
    descripcion: string
    prioridad: number
  }>
  nivel_riesgo: 'activo' | 'en_riesgo' | 'critico'
  nivel_riesgo_nota: string
  progresion_integrador: number
  confianza_perfil: number
  resumen_analisis: string
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

  const senales: Signal[] = signals ?? []
  if (!senales.length) return { hipotesis: 0, gaps: 0, progresion: 0, senalesProcessed: 0 }

  // 2. Perfil actual
  const { data: perfilArr } = await sb
    .from('asesor_perfil')
    .select('*')
    .eq('asesor', asesor)
    .limit(1)

  const perfil: PerfilActual = perfilArr?.[0] ?? {}

  // 3. Conocimiento conductual relevante (para contexto)
  // Traducir la letra histórica (E/S/R/A) al id_tipo ERRIM vía tipo_catalogo.
  const tipoErrim = await codigoOrigenAIdTipo(sb, perfil.perfil_dominante ?? null)
  const { data: conocimiento } = await sb
    .from('knowledge_base_conductual')
    .select('categoria, titulo, contenido')
    .or(`perfil.is.null,perfil.eq.${tipoErrim}`)
    .limit(20)

  // 4. Construir prompt analítico
  const senalesTexto = senales.map(s =>
    `[${s.fuente}] ${s.tipo}: ${s.valor ?? '—'} | dimensión: ${s.dimension_target ?? '?'} | perfil_hint: ${s.perfil_hint ?? '?'} | confianza: ${s.confianza_hint ?? '?'}% | fecha: ${s.created_at.slice(0,10)}`
  ).join('\n')

  const perfilTexto = Object.entries(perfil)
    .filter(([k]) => !['id','asesor','created_at','updated_at','resumen_ia'].includes(k))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')

  // Etapa 3 §5.6(b) — log de uso. ⚠️ Este consumidor LEE el crudo sin filtrar: el perfil se
  // serializa entero (incl. resiliencia=f4 y backup_style_doc=d8) al prompt del LLM, SIN pasar
  // por proyeccion-segura. Se registra la fuga TAL CUAL (salida='prompt_llm_sin_filtrar'); la
  // CORRECCIÓN del filtro es ítem aparte, NO en este commit.
  {
    const p = perfil as Record<string, unknown>
    const usos: UsoSensibleEvento[] = []
    if (p.resiliencia !== null && p.resiliencia !== undefined)
      usos.push({ asesor, dimension: 'f4', salida: 'prompt_llm_sin_filtrar', finalidad: 'analisis_conductual', actor: 'proxis-analyzer' })
    if (p.backup_style_doc !== null && p.backup_style_doc !== undefined)
      usos.push({ asesor, dimension: 'd8', salida: 'prompt_llm_sin_filtrar', finalidad: 'analisis_conductual', actor: 'proxis-analyzer' })
    await logUsoSensible(sb, usos)
  }

  const conocimientoTexto = (conocimiento ?? [])
    .map(k => `[${k.categoria}] ${k.titulo}: ${String(k.contenido).slice(0, 200)}`)
    .join('\n')

  const prompt = `Eres un motor de análisis conductual experto en el modelo Merrill-Reid y el ciclo TPS de 7 pasos.
Tu tarea es analizar las señales conductuales de un asesor de seguros y generar hipótesis de conocimiento sobre su perfil y comportamiento.

## Asesor: ${asesor}

## Perfil actual
${perfilTexto || '(sin perfil previo)'}

## Señales conductuales recientes (${senales.length} señales)
${senalesTexto}

## Base de conocimiento conductual disponible
${conocimientoTexto || '(vacía)'}

## Instrucciones
Analiza las señales y genera:
1. Hipótesis conductuales (máx. 5): inferencias sobre dimensiones del perfil, con nivel de confianza 0-100.
   Por cada hipótesis, propone una acción concreta para que el supervisor o coach tome con este asesor.
2. Vacíos de conocimiento (máx. 3): dimensiones donde hay datos insuficientes para perfilar
3. Nivel de riesgo del asesor: 'activo' (todo bien), 'en_riesgo' (señales de alerta que requieren atención), 'critico' (múltiples señales graves, intervención urgente)
4. Progresión hacia perfil integrador (0-100): qué tan maduro es el perfil conductual basado en las evidencias
5. Nivel de confianza global del perfil (0-100)
6. Resumen ejecutivo de 2-3 oraciones

Las dimensiones válidas son: identidad_vendedora, relacion_prospeccion, modelos_mentales, relacion_feedback, perfil_conductual_notas, contexto_situacional, equilibrio_adaptativo, resiliencia

Los perfiles Merrill-Reid: E (Energético/Driver/Águila), S (Sociable/Expressive/Pavo Real), R (Relacional/Amiable/Paloma), A (Reflexivo/Analytical/Búho)

Acciones válidas por hipótesis:
- "trigger": enviar un mensaje de coaching específico al asesor (describe qué mensaje en accion_descripcion)
- "ajuste_dimension": actualizar una dimensión del perfil con el valor sugerido
- "escalar_supervisor": notificar al supervisor con contexto específico
- "ninguna": la hipótesis requiere solo observación por ahora

IMPORTANTE: El perfil es siempre una hipótesis de trabajo, no un diagnóstico. Requiere consenso de múltiples evidencias.
El nivel de riesgo debe ser 'critico' solo si hay señales claras de abandono, inactividad prolongada o resultados muy por debajo de meta.

Responde ÚNICAMENTE con JSON válido con esta estructura exacta:
{
  "hipotesis": [
    {
      "hipotesis": "texto de la hipótesis",
      "dimension_afectada": "nombre_dimension",
      "confianza": 75,
      "valor_sugerido": "texto sugerido para la dimensión",
      "evidencia": "señales específicas que sustentan esta hipótesis",
      "accion_tipo": "trigger",
      "accion_descripcion": "descripción específica de la acción a tomar"
    }
  ],
  "gaps_detectados": [
    {
      "dimension": "nombre_dimension",
      "descripcion": "qué información falta y por qué es importante",
      "prioridad": 3
    }
  ],
  "nivel_riesgo": "activo",
  "nivel_riesgo_nota": "razón breve del nivel de riesgo asignado",
  "progresion_integrador": 45,
  "confianza_perfil": 60,
  "resumen_analisis": "resumen ejecutivo"
}`

  // 5. Llamar a Gemini
  let analysis: GeminiAnalysis
  try {
    analysis = await callAIJson<GeminiAnalysis>(prompt, {
      maxTokens:   4000,
      temperature: 0.4,
      componente:  'proxis-analyzer',
    })
  } catch (e) {
    const emsg = e instanceof Error ? e.message : String(e)
    console.error(`[${asesor}] Error parsing Gemini response:`, emsg)
    await sb.from('error_log').insert({
      componente: 'proxis-analyzer', severidad: 'warning',
      mensaje: `Gemini falló para ${asesor}: ${emsg}`,
    }).then(undefined, () => {})
    return { hipotesis: 0, gaps: 0, progresion: 0, senalesProcessed: 0 }
  }

  const sigIds = senales.map(s => s.id)

  // 6. Guardar hipótesis en deductions_log
  let hipotesisCount = 0
  const VALID_ACCION = ['trigger', 'ajuste_dimension', 'escalar_supervisor', 'ninguna']
  const VALID_DIMENSION = ['identidad_vendedora','relacion_prospeccion','modelos_mentales','relacion_feedback','perfil_conductual_notas','contexto_situacional','equilibrio_adaptativo','resiliencia']
  for (const h of (analysis.hipotesis ?? [])) {
    await sb.from('deductions_log').insert({
      asesor,
      hipotesis:          h.hipotesis,
      dimension_afectada: VALID_DIMENSION.includes(h.dimension_afectada) ? h.dimension_afectada : null,
      confianza:          h.confianza,
      valor_sugerido:     h.valor_sugerido,
      evidencia:          h.evidencia,
      accion_tipo:        VALID_ACCION.includes(h.accion_tipo) ? h.accion_tipo : 'ninguna',
      accion_descripcion: h.accion_descripcion ?? null,
      senales_usadas:     sigIds.slice(0, 10),
      estado:             'pendiente'
    })
    hipotesisCount++
  }

  // 7. Guardar gaps en knowledge_gaps + auto-escalación prioridad ≥ 3
  let gapsCount = 0
  for (const g of (analysis.gaps_detectados ?? [])) {
    const prioridad = Math.min(5, Math.max(1, g.prioridad))
    // Evitar duplicar gaps ya abiertos para la misma dimensión
    const { data: existing } = await sb
      .from('knowledge_gaps')
      .select('id')
      .eq('asesor', asesor)
      .eq('dimension', g.dimension)
      .in('estado', ['detectado', 'en_investigacion'])
      .limit(1)

    if (!existing?.length) {
      // Prioridad ≥ 3 → escalar directamente a investigación
      const estado = prioridad >= 3 ? 'en_investigacion' : 'detectado'
      await sb.from('knowledge_gaps').insert({
        asesor,
        dimension:   g.dimension,
        descripcion: g.descripcion,
        prioridad,
        estado,
      })
      gapsCount++
    }
  }

  // 8. Actualizar progresion, confianza y nivel_riesgo en asesor_perfil
  const nuevaProgresion = analysis.progresion_integrador ?? perfil.progresion_integrador ?? 0
  const nuevaConfianza  = analysis.confianza_perfil      ?? perfil.confianza_perfil      ?? 0
  const VALID_RIESGO    = ['activo', 'en_riesgo', 'critico']
  const nuevoRiesgo     = VALID_RIESGO.includes(analysis.nivel_riesgo) ? analysis.nivel_riesgo : 'activo'
  const now             = new Date().toISOString()

  await sb.from('asesor_perfil').upsert(
    {
      asesor,
      progresion_integrador: nuevaProgresion,
      confianza_perfil:      nuevaConfianza,
      nivel_riesgo:          nuevoRiesgo,
      nivel_riesgo_at:       now,
      nivel_riesgo_nota:     analysis.nivel_riesgo_nota ?? null,
      updated_at:            now
    },
    { onConflict: 'asesor' }
  )

  // 9. Correlación reacción→mensaje: actualizar trigger_efectividad
  const reacciones = senales.filter(s =>
    s.tipo === 'reaccion_positiva' || s.tipo === 'reaccion_negativa'
  )
  for (const reac of reacciones) {
    // Buscar el mensaje enviado más reciente al asesor en las 48h previas a la reacción
    const reacAt  = new Date(reac.created_at)
    const desde48 = new Date(reacAt.getTime() - 48 * 3_600_000).toISOString()
    const { data: msgReciente } = await sb
      .from('message_log')
      .select('id, trigger_id, created_at')
      .eq('asesor', asesor)
      .eq('evaluado', false)
      .gte('created_at', desde48)
      .lte('created_at', reac.created_at)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!msgReciente?.length) continue
    const msg = msgReciente[0]

    // Calcular periodo ISO semana del mensaje
    const msgDate  = new Date(msg.created_at)
    const thursday = new Date(msgDate)
    thursday.setDate(msgDate.getDate() - ((msgDate.getDay() + 6) % 7) + 3)
    const firstThursday = new Date(thursday.getFullYear(), 0, 4)
    const week = String(1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)).padStart(2, '0')
    const periodo = `${thursday.getFullYear()}-W${week}`

    const esPositiva = reac.tipo === 'reaccion_positiva'
    await sb.from('trigger_efectividad').upsert(
      {
        trigger_id:            msg.trigger_id,
        periodo,
        mensajes_enviados:     1,
        reacciones_positivas:  esPositiva ? 1 : 0,
        reacciones_negativas:  esPositiva ? 0 : 1,
        updated_at:            now,
      },
      {
        onConflict: 'trigger_id,periodo',
        ignoreDuplicates: false,
      }
    )
    // Si el upsert fue insert, ya está. Si fue update necesitamos incrementar.
    // Supabase no soporta increment en upsert directamente — usamos RPC o re-query.
    // Solución: update explícito tras upsert
    try {
      await sb.rpc('incrementar_efectividad' as never, {
        p_trigger_id: msg.trigger_id, p_periodo: periodo,
        p_positivas: esPositiva ? 1 : 0, p_negativas: esPositiva ? 0 : 1,
      } as never)
    } catch (_) { /* RPC puede no existir aún — fallback silencioso */ }

    // Marcar mensaje como evaluado para no doble-contar
    await sb.from('message_log').update({ evaluado: true }).eq('id', msg.id)
  }

  // 10. Sincronizar tps_perfiles.tps_progress con progresion_integrador
  await sb.from('tps_perfiles').upsert(
    { asesor, tps_progress: nuevaProgresion, updated_at: now },
    { onConflict: 'asesor' }
  )

  // 10. Marcar señales como procesadas
  await sb.from('behavioral_signals')
    .update({ procesada: true })
    .in('id', sigIds)

  // 11. Guardar snapshot en asesor_perfil_historial
  const { data: perfilFull } = await sb
    .from('asesor_perfil')
    .select('*')
    .eq('asesor', asesor)
    .limit(1)
  const pf = perfilFull?.[0] ?? {}

  await sb.from('asesor_perfil_historial').insert({
    asesor,
    snapshot_at:            now,
    progresion_integrador:  nuevaProgresion,
    confianza_perfil:       nuevaConfianza,
    nivel_riesgo:           nuevoRiesgo,
    hipotesis_count:        hipotesisCount,
    senales_procesadas:     senales.length,
    identidad_vendedora:    pf.identidad_vendedora     ?? null,
    relacion_prospeccion:   pf.relacion_prospeccion    ?? null,
    modelos_mentales:       pf.modelos_mentales        ?? null,
    relacion_feedback:      pf.relacion_feedback       ?? null,
    perfil_conductual_notas:pf.perfil_conductual_notas ?? null,
    contexto_situacional:   pf.contexto_situacional    ?? null,
    resumen_ia:             pf.resumen_ia              ?? null,
  })

  // 12. Relato de evolución (solo si hay ≥3 snapshots y el último tiene >7d de antigüedad)
  const { count: snapCount } = await sb
    .from('asesor_perfil_historial')
    .select('id', { count: 'exact', head: true })
    .eq('asesor', asesor)

  const relatoVencido = !pf.relato_evolucion_at ||
    (Date.now() - new Date(pf.relato_evolucion_at).getTime()) > 7 * 86_400_000

  if ((snapCount ?? 0) >= 3 && relatoVencido) {
    const { data: ultSnaps } = await sb
      .from('asesor_perfil_historial')
      .select('snapshot_at, progresion_integrador, confianza_perfil, nivel_riesgo, resumen_ia')
      .eq('asesor', asesor)
      .order('snapshot_at', { ascending: false })
      .limit(6)

    const tabla = (ultSnaps ?? []).map(s =>
      `• ${s.snapshot_at.slice(0,10)} | progresión: ${s.progresion_integrador ?? '?'}% | confianza: ${s.confianza_perfil ?? '?'}% | riesgo: ${s.nivel_riesgo ?? '?'}\n  resumen: ${String(s.resumen_ia ?? '(sin resumen)').slice(0, 200)}`
    ).join('\n')

    const relatoPrompt = `Eres un analista de desarrollo humano experto en el modelo Merrill-Reid y la metodología TPS.
Analiza la evolución conductual del asesor ${asesor} con base en ${ultSnaps?.length} snapshots de perfil (del más reciente al más antiguo):

${tabla}

Genera un relato de evolución en texto libre (máx. 250 palabras) que:
1. Describe el arco de desarrollo del asesor
2. Señala los cambios más significativos en su perfil conductual
3. Identifica patrones de progreso o regresión
4. Da una perspectiva sobre hacia dónde se dirige su desarrollo

Usa lenguaje preciso, en tercera persona, enfocado en comportamientos observables. No uses bullet points.`

    try {
      const relato = await callAI(relatoPrompt, {
        maxTokens:   1200,
        temperature: 0.6,
        componente:  'proxis-analyzer',
      })
      if (relato) {
        await sb.from('asesor_perfil').upsert(
          { asesor, relato_evolucion: relato, relato_evolucion_at: now, updated_at: now },
          { onConflict: 'asesor' }
        )
      }
    } catch (e) {
      console.error(`[${asesor}] Error generando relato evolución:`, e)
    }
  }

  return {
    hipotesis:        hipotesisCount,
    gaps:             gapsCount,
    progresion:       nuevaProgresion,
    senalesProcessed: senales.length
  }
}

/* ── Handler principal ──────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  try {
  const results: any[] = []
  let totalHipotesis   = 0
  let totalGaps        = 0
  let totalSenales     = 0

  // Scoping opcional: el canario invoca con { asesor } para procesar SOLO al asesor
  // sintético (__canary__) sin tocar a los reales (no gasta Gemini en ellos ni muta
  // sus perfiles). Sin scoping, el cron procesa todos los asesores con señales
  // pendientes EXCLUYENDO el namespace de canarios (__*).
  const reqBody = await req.json().catch(() => ({})) as { asesor?: string }
  const asesorScope = typeof reqBody?.asesor === 'string' ? reqBody.asesor.trim() : ''

  let asesores: string[]
  if (asesorScope) {
    asesores = [asesorScope]
  } else {
    // Todos los asesores con señales pendientes (excluyendo el namespace de canarios)
    const { data: pendingArr } = await sb
      .from('behavioral_signals')
      .select('asesor')
      .eq('procesada', false)
    asesores = [...new Set((pendingArr ?? []).map((r: any) => r.asesor as string))]
      .filter(a => !a.startsWith('__'))
    // Gate por institución (lista blanca, fail-closed): solo se analizan asesores
    // autorizados. Las señales de no-autorizados quedan procesada=false (reversibles).
    const autz = await getAsesoresAutorizados(sb)
    asesores = asesores.filter(a => autz.has(a))
  }

  if (!asesores.length) {
    return new Response(
      JSON.stringify({ ok: true, msg: 'Sin señales pendientes para analizar' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  for (const [i, asesor] of asesores.entries()) {
    if (i > 0) await new Promise(r => setTimeout(r, 1000)) // pausa entre asesores
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
  } catch (e: any) {
    console.error('[proxis-analyzer] FATAL:', e)
    await sb.from('error_log').insert({
      componente: 'proxis-analyzer',
      severidad:  'error',
      mensaje:    e?.message ?? String(e),
      detalles:   { stack: e?.stack ?? '', timestamp: new Date().toISOString() },
    }).then(undefined, () => {})
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'Error interno' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
