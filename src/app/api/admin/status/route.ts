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
      .in('jobname', ['proxis-monitor', 'proxis-analyzer-semanal'])

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

  return NextResponse.json(results)
}
