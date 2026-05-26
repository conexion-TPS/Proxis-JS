// proxis-signals — Edge Function
// Cron: 0 6 * * *  (diario, 6:00 AM UTC → 3:00 AM Chile)
// Lee la bitácora de prospección de cada asesor activo y genera
// señales comportamentales para el motor de hipótesis de Proxis.
// Entrada del pipeline: señales → proxis-analyzer → hipótesis → proxis-monitor → mensajes

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb     = createClient(SB_URL, SB_KEY)

// ── Ventanas de deduplicación por tipo de señal (días) ──────────────────────
// Previene re-señalizar la misma condición en la misma semana/mes.

const DEDUP_DAYS: Record<string, number> = {
  inactividad_prospeccion:             6,
  meta_semana_alcanzada:               6,
  meta_semana_no_alcanzada:            6,
  baja_conversion_contacto_prospecto:  6,
  persistencia_baja:                   6,
  bajo_ingreso_mensual:               20,
  meta_ingresos_superada:             20,
}

// ── Helpers de fecha ─────────────────────────────────────────────────────────

function getMesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getLunesActual(): Date {
  const h   = new Date()
  const dow = h.getDay()
  const lunes = new Date(h)
  lunes.setDate(h.getDate() - (dow === 0 ? 6 : dow - 1))
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

// ── Cálculos de métricas (misma lógica que proxis-monitor) ───────────────────

function calcSemanasSinReporte(reportes: any[]): number {
  if (!reportes.length) return 4
  const lunes  = getLunesActual()
  const ultimo = new Date(reportes[0].semana_inicio)
  return Math.max(0, Math.floor((lunes.getTime() - ultimo.getTime()) / (7 * 86_400_000)))
}

function calcPcPromedio(reportes: any[]): number {
  if (!reportes.length) return 0
  const vals = reportes.map((r: any) => {
    const cs    = r.contactos || []
    const total = cs.length
    const z     = cs.reduce((s: number, c: any) => s + (c.prospectos || 0), 0)
    return total > 0 ? z / total : 0
  })
  return +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2)
}

// Semanas consecutivas donde contactos < meta (desde la más reciente)
function calcPersistencia(reportes: any[], meta: number): number {
  let n = 0
  for (const r of reportes) {
    if ((r.contactos || []).length < meta) n++; else break
  }
  return n
}

// ── Construcción de contexto por asesor ──────────────────────────────────────

async function buildContext(asesor: string) {
  const mes    = getMesActual()
  const [y, m] = mes.split('-').map(Number)
  const next   = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`

  const [metaRes, reportesRes, ingresoRes] = await Promise.all([
    sb.from('metas')
      .select('meta_contactos_semana,meta_prospectos_mes,meta_ingresos,perfil_conductual')
      .eq('asesor', asesor)
      .maybeSingle(),
    sb.from('reportes')
      .select('id,semana_inicio')
      .eq('asesor', asesor)
      .order('semana_inicio', { ascending: false })
      .limit(4),
    sb.from('ingresos')
      .select('ingreso_real')
      .eq('asesor', asesor)
      .eq('mes', mes)
      .maybeSingle(),
  ])

  const meta     = (metaRes.data    || {}) as Record<string, any>
  const reportes = (reportesRes.data || []) as any[]

  // Cargar contactos de cada reporte secuencialmente (evita burst de queries en paralelo)
  for (const r of reportes) {
    const { data } = await sb.from('contactos').select('prospectos').eq('reporte_id', r.id)
    r.contactos = data || []
  }

  const meta_contactos_semana = (meta.meta_contactos_semana as number) || 3
  const semanas_sin_reporte   = calcSemanasSinReporte(reportes)

  return {
    asesor,
    meta_contactos_semana,
    meta_prospectos_mes: (meta.meta_prospectos_mes as number) || 15,
    meta_ingresos:       (meta.meta_ingresos       as number) || 2_000_000,
    perfil_conductual:   (meta.perfil_conductual   as string) || null,
    semanas_sin_reporte,
    // 0 si no hay reporte esta semana — no confundir con "0 contactos registrados"
    contactos_ultima_semana: semanas_sin_reporte === 0
      ? (reportes[0]?.contactos?.length ?? 0)
      : 0,
    pc_promedio:         calcPcPromedio(reportes),
    persistencia_actual: calcPersistencia(reportes, meta_contactos_semana),
    ingreso_mes_actual:  (ingresoRes.data?.ingreso_real as number) || 0,
    mes_actual: mes,
  }
}

// ── Evaluación de señales ────────────────────────────────────────────────────

interface SignalSpec {
  tipo:             string
  valor:            string
  dimension_target: string
  confianza_hint:   number
  contexto:         Record<string, unknown>
}

function evaluateSignals(ctx: Awaited<ReturnType<typeof buildContext>>): SignalSpec[] {
  const signals: SignalSpec[] = []

  // ─ Inactividad: sin reporte ≥ 1 semana ─────────────────────────────────────
  if (ctx.semanas_sin_reporte >= 1) {
    signals.push({
      tipo:             'inactividad_prospeccion',
      valor:            String(ctx.semanas_sin_reporte),
      dimension_target: 'relacion_prospeccion',
      confianza_hint:   75,
      contexto: { semanas_sin_reporte: ctx.semanas_sin_reporte, mes: ctx.mes_actual },
    })
  }

  // ─ Meta semanal alcanzada ───────────────────────────────────────────────────
  if (ctx.semanas_sin_reporte === 0 && ctx.contactos_ultima_semana >= ctx.meta_contactos_semana) {
    signals.push({
      tipo:             'meta_semana_alcanzada',
      valor:            String(ctx.contactos_ultima_semana),
      dimension_target: 'identidad_vendedora',
      confianza_hint:   80,
      contexto: {
        contactos: ctx.contactos_ultima_semana,
        meta:      ctx.meta_contactos_semana,
        mes:       ctx.mes_actual,
      },
    })
  }

  // ─ Meta semanal no alcanzada (hay reporte pero por debajo) ──────────────────
  if (ctx.semanas_sin_reporte === 0 && ctx.contactos_ultima_semana < ctx.meta_contactos_semana) {
    signals.push({
      tipo:             'meta_semana_no_alcanzada',
      valor:            String(ctx.contactos_ultima_semana),
      dimension_target: 'relacion_prospeccion',
      confianza_hint:   70,
      contexto: {
        contactos: ctx.contactos_ultima_semana,
        meta:      ctx.meta_contactos_semana,
        mes:       ctx.mes_actual,
      },
    })
  }

  // ─ Baja conversión contacto → prospecto ────────────────────────────────────
  // Solo cuando hay datos reales (pc > 0) — pc = 0 sin reportes es "sin datos"
  if (ctx.pc_promedio > 0 && ctx.pc_promedio < 0.3) {
    signals.push({
      tipo:             'baja_conversion_contacto_prospecto',
      valor:            String(ctx.pc_promedio),
      dimension_target: 'modelos_mentales',
      confianza_hint:   65,
      contexto: { pc_promedio: ctx.pc_promedio, mes: ctx.mes_actual },
    })
  }

  // ─ Persistencia baja: ≥ 2 semanas consecutivas bajo meta ───────────────────
  if (ctx.persistencia_actual >= 2) {
    signals.push({
      tipo:             'persistencia_baja',
      valor:            String(ctx.persistencia_actual),
      dimension_target: 'relacion_feedback',
      confianza_hint:   70,
      contexto: {
        semanas_bajo_meta:      ctx.persistencia_actual,
        meta_contactos_semana:  ctx.meta_contactos_semana,
        mes:                    ctx.mes_actual,
      },
    })
  }

  // ─ Bajo ingreso mensual (< 70 % de meta) ───────────────────────────────────
  // Guardado con > 0 para no disparar cuando aún no se registró el ingreso del mes
  if (ctx.ingreso_mes_actual > 0 && ctx.ingreso_mes_actual < ctx.meta_ingresos * 0.7) {
    signals.push({
      tipo:             'bajo_ingreso_mensual',
      valor:            String(ctx.ingreso_mes_actual),
      dimension_target: 'contexto_situacional',
      confianza_hint:   60,
      contexto: {
        ingreso_real:  ctx.ingreso_mes_actual,
        meta_ingresos: ctx.meta_ingresos,
        pct:           +(ctx.ingreso_mes_actual / ctx.meta_ingresos * 100).toFixed(1),
        mes:           ctx.mes_actual,
      },
    })
  }

  // ─ Meta de ingresos superada ────────────────────────────────────────────────
  if (ctx.ingreso_mes_actual >= ctx.meta_ingresos && ctx.meta_ingresos > 0) {
    signals.push({
      tipo:             'meta_ingresos_superada',
      valor:            String(ctx.ingreso_mes_actual),
      dimension_target: 'identidad_vendedora',
      confianza_hint:   80,
      contexto: {
        ingreso_real:  ctx.ingreso_mes_actual,
        meta_ingresos: ctx.meta_ingresos,
        pct:           +(ctx.ingreso_mes_actual / ctx.meta_ingresos * 100).toFixed(1),
        mes:           ctx.mes_actual,
      },
    })
  }

  return signals
}

// ── Deduplicación en memoria (usando señales pre-cargadas) ───────────────────

function wasRecentlySignaled(
  recentSignals: Array<{ asesor: string; tipo: string; created_at: string }>,
  asesor: string,
  tipo: string,
  dedupDays: number,
): boolean {
  const cutoff = Date.now() - dedupDays * 86_400_000
  return recentSignals.some(
    s => s.asesor === asesor
      && s.tipo   === tipo
      && new Date(s.created_at).getTime() > cutoff,
  )
}

// ── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const log: string[]  = []
  let total_inserted   = 0
  let total_skipped    = 0
  let total_errors     = 0

  try {
    // 1. Asesores activos (todos los que tienen fila en metas)
    const { data: metas, error: metasErr } = await sb
      .from('metas')
      .select('asesor')
      .not('asesor', 'is', null)
    if (metasErr) throw metasErr

    const asesores = [...new Set((metas || []).map((m: any) => m.asesor as string))]
    log.push(`Asesores a evaluar: ${asesores.length}`)

    // 2. Pre-cargar señales de los últimos 20 días para deduplicación en memoria
    const cutoff20d = new Date(Date.now() - 20 * 86_400_000).toISOString()
    const { data: recentSignals } = await sb
      .from('behavioral_signals')
      .select('asesor,tipo,created_at')
      .eq('fuente', 'plataforma')
      .gte('created_at', cutoff20d)

    const recent: Array<{ asesor: string; tipo: string; created_at: string }> =
      recentSignals || []

    // 3. Procesar cada asesor de forma independiente
    for (const asesor of asesores) {
      try {
        const ctx     = await buildContext(asesor)
        const signals = evaluateSignals(ctx)

        for (const s of signals) {
          const dedupDays = DEDUP_DAYS[s.tipo] ?? 6

          if (wasRecentlySignaled(recent, asesor, s.tipo, dedupDays)) {
            total_skipped++
            continue
          }

          const { error } = await sb.from('behavioral_signals').insert({
            asesor,
            fuente:           'plataforma',
            tipo:             s.tipo,
            valor:            s.valor,
            dimension_target: s.dimension_target,
            confianza_hint:   s.confianza_hint,
            procesada:        false,
            contexto:         s.contexto,
          })

          if (error) {
            log.push(`  ERROR ${s.tipo} / ${asesor}: ${error.message}`)
            total_errors++
          } else {
            total_inserted++
            // Agregar al índice en memoria para que iteraciones posteriores dedupliquen
            recent.push({ asesor, tipo: s.tipo, created_at: new Date().toISOString() })
          }
        }
      } catch (e: any) {
        log.push(`  ERROR procesando ${asesor}: ${e.message}`)
        total_errors++
      }
    }

    log.push(`Insertadas: ${total_inserted} | Omitidas (dedup): ${total_skipped} | Errores: ${total_errors}`)

    return new Response(
      JSON.stringify({ ok: true, log, total_inserted, total_skipped, total_errors }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
