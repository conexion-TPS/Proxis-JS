import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const sb = supabaseAdmin()
  const results: Record<string, unknown> = {}

  // ── Gemini — llamada real con prompt mínimo ──────────────────────────────
  try {
    const key = process.env.GEMINI_KEY
    if (!key) throw new Error('no key')
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responde solo: OK' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      }
    )
    results.gemini = r.ok
  } catch {
    results.gemini = false
  }

  // ── Resend — verificar clave presente (sin enviar) ───────────────────────
  results.resend = !!process.env.RESEND_KEY

  // ── Cron jobs — último run y estado ─────────────────────────────────────
  try {
    const { data: jobs } = await sb
      .from('cron.job' as never)
      .select('jobname, schedule, active')
      .in('jobname', ['proxis-monitor', 'proxis-analyzer-weekly', 'proxis-cerebro-diario'])

    const { data: runs } = await sb
      .from('cron.job_run_details' as never)
      .select('jobid, start_time, status')
      .order('start_time', { ascending: false })
      .limit(20)

    results.cron = (jobs ?? []).map((j: Record<string, unknown>) => {
      const lastRun = (runs ?? []).find(
        (r: Record<string, unknown>) => r.jobid === (j as Record<string, unknown>).jobid
      ) as Record<string, unknown> | undefined
      return {
        jobname:   j.jobname,
        schedule:  j.schedule,
        active:    j.active,
        last_run:  lastRun?.start_time ?? null,
        last_status: lastRun?.status ?? null,
      }
    })
  } catch {
    results.cron = []
  }

  // ── Señales pendientes de procesar ──────────────────────────────────────
  try {
    const [{ count: pending }, { count: total }] = await Promise.all([
      sb.from('behavioral_signals').select('*', { count: 'exact', head: true }).eq('procesada', false),
      sb.from('behavioral_signals').select('*', { count: 'exact', head: true }),
    ])
    results.signals = { pending: pending ?? 0, total: total ?? 0 }
  } catch {
    results.signals = { pending: 0, total: 0 }
  }

  // ── Triggers activos / pausados ──────────────────────────────────────────
  try {
    const [{ count: active }, { count: paused }] = await Promise.all([
      sb.from('trigger_config').select('*', { count: 'exact', head: true }).eq('activo', true),
      sb.from('trigger_config').select('*', { count: 'exact', head: true }).eq('activo', false),
    ])
    results.triggers = { active: active ?? 0, paused: paused ?? 0 }
  } catch {
    results.triggers = { active: 0, paused: 0 }
  }

  // ── Mensajes enviados últimas 24h y 7 días ───────────────────────────────
  try {
    const now    = new Date()
    const h24    = new Date(now.getTime() - 86_400_000).toISOString()
    const d7     = new Date(now.getTime() - 7 * 86_400_000).toISOString()
    const [{ count: last24h }, { count: last7d }] = await Promise.all([
      sb.from('message_log').select('*', { count: 'exact', head: true }).gte('created_at', h24),
      sb.from('message_log').select('*', { count: 'exact', head: true }).gte('created_at', d7),
    ])
    results.messages = { last24h: last24h ?? 0, last7d: last7d ?? 0 }
  } catch {
    results.messages = { last24h: 0, last7d: 0 }
  }

  // ── Cuestionarios: ¿TPS tiene preguntas cargadas? ───────────────────────
  try {
    const { data: tps } = await sb
      .from('cuestionarios')
      .select('id')
      .eq('nombre', 'Instrumento TPS v1.0')
      .single()
    if (tps?.id) {
      const { count } = await sb
        .from('preguntas')
        .select('*', { count: 'exact', head: true })
        .eq('cuestionario_id', tps.id)
      results.cuestionarios = { tps_preguntas: count ?? 0 }
    } else {
      results.cuestionarios = { tps_preguntas: 0 }
    }
  } catch {
    results.cuestionarios = { tps_preguntas: 0 }
  }

  // ── Último estado del cerebro ────────────────────────────────────────────
  try {
    const { data: healthLog } = await sb
      .from('system_health_log')
      .select('checked_at, estado_global, alertas_count:alertas, metricas')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: any }
    results.cerebro = healthLog
      ? {
          checked_at:    healthLog.checked_at,
          estado_global: healthLog.estado_global,
          alertas:       Array.isArray(healthLog.alertas_count) ? healthLog.alertas_count.length : 0,
          metricas:      healthLog.metricas,
        }
      : null
  } catch {
    results.cerebro = null
  }

  // ── Integridad de datos: asesores sin perfil/metas, triggers sin prompt ─────
  try {
    const { data: activos } = await sb
      .from('asesor_credentials').select('asesor').eq('activo', true)
    const nombres = (activos ?? []).map((a: Record<string,string>) => a.asesor)

    const [{ data: conPerfil }, { data: conMetas }, { data: triggers }, { data: conPrompt }] = await Promise.all([
      sb.from('tps_perfiles').select('asesor').in('asesor', nombres),
      sb.from('metas').select('asesor').in('asesor', nombres),
      sb.from('trigger_config').select('id, nombre').eq('activo', true),
      sb.from('prompts').select('trigger_id').eq('activo', true),
    ])

    const sinPerfil = nombres.filter(n => !(conPerfil ?? []).some((p: Record<string,string>) => p.asesor === n))
    const sinMetas  = nombres.filter(n => !(conMetas  ?? []).some((m: Record<string,string>) => m.asesor === n))
    const sinPrompt = (triggers ?? []).filter((t: Record<string,string>) =>
      !(conPrompt ?? []).some((p: Record<string,string>) => p.trigger_id === t.id)
    )

    results.integridad = {
      asesores_activos:  nombres.length,
      sin_perfil:        sinPerfil.length,
      sin_metas:         sinMetas.length,
      triggers_activos:  (triggers ?? []).length,
      triggers_sin_prompt: sinPrompt.length,
      detalle_sin_perfil:  sinPerfil.slice(0, 5),
      detalle_sin_prompt:  sinPrompt.slice(0, 5).map((t: Record<string,string>) => t.nombre ?? t.id),
    }
  } catch {
    results.integridad = null
  }

  // ── Pipeline de entrada: último reporte + reacciones ─────────────────────
  try {
    const since14d = new Date(Date.now() - 14 * 86_400_000).toISOString()
    const [ultimoReporte, reacciones14d, mensajes14d, sailorSinLeer] = await Promise.all([
      sb.from('reportes').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('behavioral_signals').select('*', { count: 'exact', head: true }).in('tipo', ['reaccion_positiva', 'reaccion_negativa']).gte('created_at', since14d),
      sb.from('message_log').select('*', { count: 'exact', head: true }).gte('created_at', since14d),
      sb.from('sailor_messages').select('*', { count: 'exact', head: true }).eq('leido', false).eq('origen', 'coach_ia').lt('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
    ])
    const horasDesdeReporte = ultimoReporte.data
      ? (Date.now() - new Date(ultimoReporte.data.created_at).getTime()) / 3_600_000
      : null
    results.pipeline = {
      ultimo_reporte_hace_horas: horasDesdeReporte !== null ? Math.round(horasDesdeReporte) : null,
      reacciones_14d:            reacciones14d.count ?? 0,
      mensajes_14d:              mensajes14d.count ?? 0,
      sailor_sin_leer_viejos:    sailorSinLeer.count ?? 0,
    }
  } catch {
    results.pipeline = null
  }

  // ── Efectividad de triggers (últimas 4 semanas) ───────────────────────────
  try {
    const { data: ef } = await sb
      .from('trigger_efectividad')
      .select('trigger_id, reacciones_positivas, reacciones_negativas, tasa_positiva')
      .order('periodo', { ascending: false })
      .limit(20)
    results.efectividad = ef ?? []
  } catch {
    results.efectividad = []
  }

  // ── Últimos deployments (Vercel webhook) ─────────────────────────────────
  try {
    const { data: deps } = await sb
      .from('deployment_log')
      .select('estado, url, rama, commit_sha, mensaje, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    results.deployments = deps ?? []
  } catch {
    results.deployments = []
  }

  // ── Errores recientes de edge functions y API routes ──────────────────────
  try {
    const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { data: errs, count } = await sb
      .from('error_log')
      .select('componente, severidad, mensaje, created_at', { count: 'exact' })
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(10)
    results.errores = { recientes: errs ?? [], total_7d: count ?? 0 }
  } catch {
    results.errores = { recientes: [], total_7d: 0 }
  }

  return NextResponse.json(results)
}
