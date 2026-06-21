import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const UMBRAL_ALTO = 2.6
const UMBRAL_BAJO = 2.4

// Etapa 3 §5.5 — dimensiones cuyos ítems crudos son sensibles y se gatean por consentimiento.
// f4 (tps_c_f4) alimenta el scoring de resiliencia; tps_d8 se MANTIENE en el set (Paso 2) solo
// para seguir gateando la respuesta cruda del ítem d8 (ya inerte: no se calcula backup_style).
const DIMENSIONES_SENSIBLES = new Set(['tps_c_f4', 'tps_d8'])

function perfilDesdeEjes(a: number, b: number): string {
  if (a >= UMBRAL_ALTO && b <= UMBRAL_BAJO) return 'E'
  if (a >= UMBRAL_ALTO && b >= UMBRAL_ALTO) return 'S'
  if (a <= UMBRAL_BAJO && b >= UMBRAL_ALTO) return 'R'
  if (a <= UMBRAL_BAJO && b <= UMBRAL_BAJO) return 'A'
  return 'AMB'
}

function calcularConfianza(ab: string, dDominante: string): string {
  if (!dDominante) return 'Baja'
  if (ab === 'AMB') return dDominante ? 'Media' : 'Baja'
  if (ab === dDominante) return 'Alta'
  const adyacentes: Record<string, string[]> = {
    E: ['S', 'A'], S: ['E', 'R'], R: ['S', 'A'], A: ['E', 'R'],
  }
  return adyacentes[ab]?.includes(dDominante) ? 'Media' : 'Baja'
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))

  // Identidad por JWT Sailor: el asesor sale del TOKEN, nunca del body (un asesor no
  // puede escribir el perfil sensible de otro).
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

  // ── Etapa 3 §5.5 — Gate de consentimiento ANTES de persistir el dato sensible (f4/d8) ──
  // Estado de 3 valores (NUNCA booleano). Bloqueo por defecto: sin consentimiento NO se escribe
  // el crudo sensible (sin flag global de transición). qa_interno permite captura para pruebas
  // internas, marcada como tal. Fuente: header x-contexto o payload.contexto; payload.consentimiento.
  const contexto = (req.headers.get('x-contexto') ?? body.contexto ?? '').toString()
  const consentimiento_estado: 'consentido' | 'no_consentido' | 'qa_interno' =
    contexto === 'qa_interno'      ? 'qa_interno'
    : body.consentimiento === true ? 'consentido'
    :                                'no_consentido'
  const persistirSensibles = consentimiento_estado !== 'no_consentido'

  // Obtener metadata de todas las preguntas de este cuestionario
  const { data: preguntas } = await sb
    .from('preguntas')
    .select('id, dimension_target, perfil_hint, opciones')
    .eq('cuestionario_id', cuestionario_id)

  if (!preguntas?.length) {
    return NextResponse.json({ error: 'Cuestionario no encontrado o sin preguntas' }, { status: 404 })
  }

  const preguntaMap = new Map(preguntas.map(p => [p.id, p]))

  // Acumuladores
  const modA: number[] = []
  const modB: number[] = []
  const modC: Record<string, number[]> = {
    tps_c_f1: [], tps_c_f2: [], tps_c_f3: [], tps_c_f4: [], tps_c_f5: [],
  }
  // Acumulador dedicado para tps_c_adapt (ERRIM Equilibrio Adaptativo). Separado de modC
  // a propósito: NO entra a factorSums, deseabilidad_social ni al jsonb rasgos_comerciales.
  const modAdapt: number[] = []
  const dPerfiles: string[] = []

  const respuestasParaGuardar: any[] = []

  for (const r of respuestas) {
    const p = preguntaMap.get(r.pregunta_id)
    if (!p || r.respuesta === undefined || r.respuesta === null) continue

    const val = parseFloat(String(r.respuesta))
    const dim = p.dimension_target as string

    if (dim === 'tps_a') {
      if (!isNaN(val)) modA.push(val)
    } else if (dim === 'tps_b') {
      if (!isNaN(val)) modB.push(val)
    } else if (dim === 'tps_c_adapt') {
      if (!isNaN(val)) {
        const negativo = p.opciones?.negativo === true
        modAdapt.push(negativo ? 6 - val : val)
      }
    } else if (dim?.startsWith('tps_c_')) {
      if (!isNaN(val) && modC[dim]) {
        const negativo = p.opciones?.negativo === true
        modC[dim].push(negativo ? 6 - val : val)
      }
    } else if (dim === 'tps_d') {
      // r.respuesta = perfil seleccionado: 'E' | 'S' | 'R' | 'A'
      const perf = String(r.respuesta)
      if (['E', 'S', 'R', 'A'].includes(perf)) dPerfiles.push(perf)
    }
    // d8 (tps_d8 / backup_style) ELIMINADO (Paso 2): no se calcula ni se escribe.
    // El ítem se sigue ignorando en el scoring; su respuesta cruda permanece gateada
    // por DIMENSIONES_SENSIBLES (sin consentimiento no se persiste).

    // Gate §5.5: sin consentimiento NO se guarda el crudo de los ítems f4/d8 (mismo mapeo por
    // dimensión que el scoring). El resto de respuestas se guarda normal. consentido/qa_interno → todo.
    if (persistirSensibles || !DIMENSIONES_SENSIBLES.has(dim)) {
      respuestasParaGuardar.push({
        asesor,
        cuestionario_id,
        pregunta_id: r.pregunta_id,
        respuesta:   String(r.respuesta),
      })
    }
  }

  // ── Scoring Módulo A y B ──
  const avg = (arr: number[]) => arr.length
    ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 2.5

  const puntajeA = avg(modA)
  const puntajeB = avg(modB)
  const perfilAB  = perfilDesdeEjes(puntajeA, puntajeB)

  // ── Scoring Módulo C ──
  const rasgosComer: Record<string, number> = {}
  const factorSums: number[] = []
  for (const [factor, vals] of Object.entries(modC)) {
    const suma = vals.reduce((a, b) => a + b, 0)
    const key  = factor.replace('tps_c_', '')  // f1 … f5
    rasgosComer[key] = suma
    factorSums.push(suma)
  }
  const deseabilidadSocial = factorSums.length === 5 && factorSums.every(s => s >= 20)

  // ── Scoring Módulo D ──
  const dCounts: Record<string, number> = { E: 0, S: 0, R: 0, A: 0 }
  for (const p of dPerfiles) dCounts[p]++
  const dDominante = Object.entries(dCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  // ── Perfil final y confianza ──
  const perfilFinal    = perfilAB === 'AMB' && dDominante ? dDominante : perfilAB
  const confianza      = calcularConfianza(perfilAB, dDominante)

  // ── Gate de consentimiento: si no hay consentimiento, el crudo sensible NO se persiste ──
  // f4 (resiliencia) se quita del jsonb rasgos_comerciales si no hay consentimiento.
  // f1/f2/f3/f5 y deseabilidad_social no son f4 → se conservan. (d8 eliminado en Paso 2.)
  const rasgosParaGuardar = persistirSensibles
    ? rasgosComer
    : Object.fromEntries(Object.entries(rasgosComer).filter(([k]) => k !== 'f4'))

  // ── Guardar perfil en tps_perfiles ──
  await sb.from('tps_perfiles').upsert(
    {
      asesor,
      version_instrumento:   '1.0',
      perfil_base:           perfilFinal,
      confianza_diagnostico: confianza,
      puntaje_a:             puntajeA,
      puntaje_b:             puntajeB,
      rasgos_comerciales:    rasgosParaGuardar,
      deseabilidad_social:   deseabilidadSocial,
      consentimiento_estado,
      tps_progress:          100,
      updated_at:            new Date().toISOString(),
    },
    { onConflict: 'asesor' }
  )

  // ── Puente Resiliencia (ERRIM): f4 crudo → asesor_perfil.resiliencia "suma/base/n_items" ──
  // n_items = ítems de tps_c_f4 efectivamente respondidos (longitud del acumulador), NO se asume 5.
  const resF4Items  = modC['tps_c_f4'].length
  const resiliencia = resF4Items > 0
    ? `${rasgosComer['f4']}/${resF4Items * 5}/${resF4Items}`
    : null

  // ── Puente Equilibrio Adaptativo (ERRIM): tps_c_adapt crudo → asesor_perfil.equilibrio_adaptativo ──
  // Acumulador propio (modAdapt); NO toca modC, factorSums, deseabilidad_social ni el jsonb.
  const sumaAdapt = modAdapt.reduce((a, b) => a + b, 0)
  const nAdapt    = modAdapt.length
  const equilibrio_adaptativo = nAdapt > 0
    ? `${sumaAdapt}/${nAdapt * 5}/${nAdapt}`
    : null

  // ── Sincronizar con tabla asesor_perfil existente ──
  await sb.from('asesor_perfil').upsert(
    {
      asesor,
      assertividad_score: puntajeA,
      sociabilidad_score: puntajeB,
      perfil_dominante:   perfilFinal,
      // resiliencia (puente de f4) solo si hay consentimiento; equilibrio_adaptativo no es sensible.
      ...(persistirSensibles && resiliencia !== null ? { resiliencia } : {}),
      ...(equilibrio_adaptativo !== null ? { equilibrio_adaptativo } : {}),
      updated_at:         new Date().toISOString(),
    },
    { onConflict: 'asesor' }
  )

  // ── Guardar respuestas individuales (batch) ──
  if (respuestasParaGuardar.length) {
    await sb.from('respuestas_cuestionario').insert(respuestasParaGuardar)
  }

  // ── Generar señal conductual de perfil ──
  await sb.from('behavioral_signals').insert({
    asesor,
    fuente:           'cuestionario',
    tipo:             'perfil_tps_calculado',
    valor:            perfilFinal,
    dimension_target: 'perfil_conductual_notas',
    perfil_hint:      perfilFinal,
    confianza_hint:   confianza === 'Alta' ? 85 : confianza === 'Media' ? 65 : 45,
    procesada:        false,
  })

  // Respuesta 200 con el resto del perfil; los campos sensibles solo si se persistieron.
  const resultado: Record<string, unknown> = {
    perfil_base:          perfilFinal,
    confianza:            confianza,
    puntaje_a:            puntajeA,
    puntaje_b:            puntajeB,
    rasgos_comerciales:   rasgosParaGuardar,
    deseabilidad_social:  deseabilidadSocial,
    d_conteos:            dCounts,
    consentimiento_estado,
  }

  return NextResponse.json(
    { ok: true, resultado },
    { headers: corsHeaders(req.headers.get('origin')) }
  )
}
