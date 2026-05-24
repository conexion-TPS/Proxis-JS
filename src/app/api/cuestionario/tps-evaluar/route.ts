import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const UMBRAL_ALTO = 2.6
const UMBRAL_BAJO = 2.4

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
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { asesor, cuestionario_id, respuestas } = body
  if (!asesor || !cuestionario_id || !Array.isArray(respuestas)) {
    return NextResponse.json({ error: 'Faltan campos: asesor, cuestionario_id, respuestas[]' }, { status: 400 })
  }

  const sb = supabaseAdmin()

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
  const dPerfiles: string[] = []
  let backupStyleActivo = false

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
    } else if (dim?.startsWith('tps_c_')) {
      if (!isNaN(val) && modC[dim]) {
        const negativo = p.opciones?.negativo === true
        modC[dim].push(negativo ? 6 - val : val)
      }
    } else if (dim === 'tps_d') {
      // r.respuesta = perfil seleccionado: 'E' | 'S' | 'R' | 'A'
      const perf = String(r.respuesta)
      if (['E', 'S', 'R', 'A'].includes(perf)) dPerfiles.push(perf)
    } else if (dim === 'tps_d8') {
      if (String(r.respuesta) === 'backup') backupStyleActivo = true
    }

    respuestasParaGuardar.push({
      asesor,
      cuestionario_id,
      pregunta_id: r.pregunta_id,
      respuesta:   String(r.respuesta),
    })
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

  // ── Guardar perfil en tps_perfiles ──
  await sb.from('tps_perfiles').upsert(
    {
      asesor,
      version_instrumento:   '1.0',
      perfil_base:           perfilFinal,
      confianza_diagnostico: confianza,
      puntaje_a:             puntajeA,
      puntaje_b:             puntajeB,
      rasgos_comerciales:    rasgosComer,
      backup_style_activo:   backupStyleActivo,
      deseabilidad_social:   deseabilidadSocial,
      updated_at:            new Date().toISOString(),
    },
    { onConflict: 'asesor' }
  )

  // ── Sincronizar con tabla asesor_perfil existente ──
  await sb.from('asesor_perfil').upsert(
    {
      asesor,
      assertividad_score: puntajeA,
      sociabilidad_score: puntajeB,
      perfil_dominante:   perfilFinal,
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

  const resultado = {
    perfil_base:          perfilFinal,
    confianza:            confianza,
    puntaje_a:            puntajeA,
    puntaje_b:            puntajeB,
    rasgos_comerciales:   rasgosComer,
    backup_style_activo:  backupStyleActivo,
    deseabilidad_social:  deseabilidadSocial,
    d_conteos:            dCounts,
  }

  return NextResponse.json(
    { ok: true, resultado },
    { headers: corsHeaders(req.headers.get('origin')) }
  )
}
