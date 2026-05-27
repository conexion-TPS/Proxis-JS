// proxis-cerebro — Monitor de salud del sistema
// Cron: 0 9 * * *  (diario 9:00 UTC → 6:00 AM Chile)
// Detecta anomalías en el pipeline, degradación de efectividad y
// genera un registro diario de estado en system_health_log.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY = Deno.env.get('RESEND_KEY') ?? ''
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? 'hpoblete@imrbrasil.com'

const sb = createClient(SB_URL, SB_KEY)

/* ── Tipos ──────────────────────────────────────────────────── */

interface Alerta {
  tipo:      string
  severidad: 'info' | 'warning' | 'critical'
  mensaje:   string
  valor?:    number | string
}

/* ── Checks ─────────────────────────────────────────────────── */

async function checkPipelineStall(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const { count } = await sb
    .from('behavioral_signals')
    .select('*', { count: 'exact', head: true })
    .eq('procesada', false)

  const pending = count ?? 0
  if (pending > 200) {
    alertas.push({
      tipo: 'pipeline_stall',
      severidad: 'critical',
      mensaje: `${pending} señales sin procesar — el analyzer puede estar fallando`,
      valor: pending,
    })
  } else if (pending > 50) {
    alertas.push({
      tipo: 'pipeline_stall',
      severidad: 'warning',
      mensaje: `${pending} señales pendientes de análisis`,
      valor: pending,
    })
  }
  return alertas
}

async function checkCronSalud(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const { data: runs } = await sb
    .from('cron.job_run_details' as never)
    .select('jobid, start_time, status')
    .order('start_time', { ascending: false })
    .limit(40) as { data: any[] | null }

  const { data: jobs } = await sb
    .from('cron.job' as never)
    .select('jobid, jobname, schedule')
    .in('jobname', ['proxis-monitor', 'proxis-analyzer-weekly', 'proxis-cerebro-diario']) as { data: any[] | null }

  const EXPECTED_MAX_GAP_H: Record<string, number> = {
    'proxis-monitor':          60,   // bi-semanal → máx 96h normal, alarma a 72h
    'proxis-analyzer-weekly':  200,  // semanal → máx 168h, alarma a 192h
    'proxis-cerebro-diario':   30,   // diario → alarma a 30h
  }

  const now = Date.now()
  for (const job of jobs ?? []) {
    const maxH = EXPECTED_MAX_GAP_H[job.jobname]
    if (!maxH) continue
    const lastRun = (runs ?? [])
      .filter((r: any) => r.jobid === job.jobid)
      .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0]

    if (!lastRun) {
      alertas.push({
        tipo: 'cron_nunca_corrido',
        severidad: 'warning',
        mensaje: `${job.jobname} nunca ha corrido`,
      })
      continue
    }

    const horasDesde = (now - new Date(lastRun.start_time).getTime()) / 3_600_000
    if (horasDesde > maxH) {
      alertas.push({
        tipo: 'cron_atrasado',
        severidad: 'critical',
        mensaje: `${job.jobname} no ha corrido en ${Math.round(horasDesde)}h (máx esperado: ${maxH}h)`,
        valor: Math.round(horasDesde),
      })
    }

    if (lastRun.status === 'failed') {
      alertas.push({
        tipo: 'cron_fallo',
        severidad: 'critical',
        mensaje: `${job.jobname} falló en su último run (${lastRun.start_time?.slice(0,16)})`,
      })
    }
  }
  return alertas
}

async function checkEfectividad(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  // Periodos de las últimas 4 semanas
  const { data: efectividad } = await sb
    .from('trigger_efectividad')
    .select('trigger_id, periodo, reacciones_positivas, reacciones_negativas, tasa_positiva')
    .order('periodo', { ascending: false })
    .limit(40)

  if (!efectividad?.length) return alertas

  // Agrupar por trigger_id — últimas 2 semanas
  const porTrigger: Record<string, { pos: number; neg: number }> = {}
  for (const row of efectividad) {
    if (!porTrigger[row.trigger_id]) porTrigger[row.trigger_id] = { pos: 0, neg: 0 }
    porTrigger[row.trigger_id].pos += row.reacciones_positivas ?? 0
    porTrigger[row.trigger_id].neg += row.reacciones_negativas ?? 0
  }

  for (const [tid, { pos, neg }] of Object.entries(porTrigger)) {
    const total = pos + neg
    if (total < 5) continue  // Sin datos suficientes
    const tasa = pos / total
    if (tasa < 0.2) {
      alertas.push({
        tipo: 'efectividad_critica',
        severidad: 'critical',
        mensaje: `Trigger '${tid}': solo ${Math.round(tasa * 100)}% reacciones positivas (${pos}/${total})`,
        valor: Math.round(tasa * 100),
      })
    } else if (tasa < 0.4) {
      alertas.push({
        tipo: 'efectividad_baja',
        severidad: 'warning',
        mensaje: `Trigger '${tid}': ${Math.round(tasa * 100)}% de efectividad — considerar revisar el prompt`,
        valor: Math.round(tasa * 100),
      })
    }
  }
  return alertas
}

async function checkAsesoresCriticos(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const { data: criticos } = await sb
    .from('asesor_perfil')
    .select('asesor, nivel_riesgo, nivel_riesgo_nota, nivel_riesgo_at')
    .eq('nivel_riesgo', 'critico')

  if (criticos?.length) {
    alertas.push({
      tipo: 'asesores_criticos',
      severidad: 'critical',
      mensaje: `${criticos.length} asesor(es) en estado CRÍTICO: ${criticos.map((a: any) => a.asesor).join(', ')}`,
      valor: criticos.length,
    })
  }

  const { data: riesgo } = await sb
    .from('asesor_perfil')
    .select('asesor')
    .eq('nivel_riesgo', 'en_riesgo')

  if ((riesgo?.length ?? 0) > 3) {
    alertas.push({
      tipo: 'asesores_en_riesgo',
      severidad: 'warning',
      mensaje: `${riesgo!.length} asesores en estado En Riesgo`,
      valor: riesgo!.length,
    })
  }
  return alertas
}

async function checkMensajesSinEnviar(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  // Si no hubo mensajes en los últimos 10 días y hay triggers activos → posible fallo del monitor
  const { count: activeTriggers } = await sb
    .from('trigger_config')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true)

  if (!activeTriggers) return alertas

  const since10d = new Date(Date.now() - 10 * 86_400_000).toISOString()
  const { count: mensajes } = await sb
    .from('message_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since10d)

  if ((mensajes ?? 0) === 0) {
    alertas.push({
      tipo: 'sin_mensajes',
      severidad: 'warning',
      mensaje: 'No se han enviado mensajes en 10 días con triggers activos — verificar proxis-monitor',
    })
  }
  return alertas
}

async function checkErrorLog(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const since24h = new Date(Date.now() - 86_400_000).toISOString()
  const { data: errs, count } = await sb
    .from('error_log')
    .select('componente, severidad, mensaje, created_at', { count: 'exact' })
    .gte('created_at', since24h)
    .order('created_at', { ascending: false })
    .limit(20)

  if ((count ?? 0) > 0) {
    const criticos = (errs ?? []).filter((e: any) => e.severidad === 'error')
    if (criticos.length) {
      const resumen = [...new Set(criticos.map((e: any) => e.componente))].join(', ')
      alertas.push({
        tipo:      'errores_runtime',
        severidad: 'critical',
        mensaje:   `${criticos.length} error(es) de runtime en las últimas 24h — componentes: ${resumen}`,
        valor:     criticos.length,
      })
    }
  }
  return alertas
}

async function checkDeploymentLog(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: deps } = await sb
    .from('deployment_log')
    .select('estado, rama, mensaje, created_at')
    .eq('estado', 'error')
    .gte('created_at', since7d)
    .order('created_at', { ascending: false })
    .limit(5)

  if (deps?.length) {
    alertas.push({
      tipo:      'deploy_fallido',
      severidad: 'critical',
      mensaje:   `${deps.length} deploy(s) fallido(s) en los últimos 7 días — última rama: ${deps[0].rama ?? 'desconocida'}`,
      valor:     deps.length,
    })
  }

  // Si no hay NINGÚN deployment en los últimos 14 días, es sospechoso
  const since14d = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { count } = await sb
    .from('deployment_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since14d)

  if ((count ?? 0) === 0) {
    alertas.push({
      tipo:      'sin_deployments',
      severidad: 'warning',
      mensaje:   'No se registran deployments en 14 días — verificar webhook de Vercel',
    })
  }
  return alertas
}

/* ── Email de alerta ────────────────────────────────────────── */

async function enviarAlertaEmail(alertas: Alerta[], resumen: string): Promise<void> {
  if (!RESEND_KEY || !alertas.length) return

  const criticas  = alertas.filter(a => a.severidad === 'critical')
  const warnings  = alertas.filter(a => a.severidad === 'warning')
  const asunto    = criticas.length
    ? `🚨 Proxis: ${criticas.length} alerta(s) crítica(s) — ${new Date().toLocaleDateString('es-CL')}`
    : `⚠️ Proxis: ${warnings.length} advertencia(s) — ${new Date().toLocaleDateString('es-CL')}`

  const cuerpo = [
    `PROXIS CEREBRO — Reporte diario ${new Date().toISOString().slice(0, 10)}`,
    '',
    resumen,
    '',
    criticas.length ? `CRÍTICAS (${criticas.length}):` : '',
    ...criticas.map(a => `  ❌ [${a.tipo}] ${a.mensaje}`),
    warnings.length ? `\nADVERTENCIAS (${warnings.length}):` : '',
    ...warnings.map(a => `  ⚠️  [${a.tipo}] ${a.mensaje}`),
    '',
    'Este mensaje fue generado automáticamente por proxis-cerebro.',
  ].filter(l => l !== undefined).join('\n')

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Proxis Cerebro <proxis@theprecisionselling.com>',
      to:      ADMIN_EMAIL,
      subject: asunto,
      text:    cuerpo,
    }),
  })
}

/* ── Handler principal ──────────────────────────────────────── */

Deno.serve(async (_req: Request) => {
  try {
  const now = new Date().toISOString()

  const [stall, cron, efect, criticos, sinMensajes, errores, deploys] = await Promise.all([
    checkPipelineStall(),
    checkCronSalud(),
    checkEfectividad(),
    checkAsesoresCriticos(),
    checkMensajesSinEnviar(),
    checkErrorLog(),
    checkDeploymentLog(),
  ])

  const todasAlertas = [...stall, ...cron, ...efect, ...criticos, ...sinMensajes, ...errores, ...deploys]
  const criticas     = todasAlertas.filter(a => a.severidad === 'critical').length
  const warnings     = todasAlertas.filter(a => a.severidad === 'warning').length
  const estadoGlobal = criticas > 0 ? 'critico' : warnings > 0 ? 'degradado' : 'saludable'

  // Contar métricas de contexto
  const { count: totalSenales } = await sb
    .from('behavioral_signals').select('*', { count: 'exact', head: true })
  const { count: pendingSenales } = await sb
    .from('behavioral_signals').select('*', { count: 'exact', head: true }).eq('procesada', false)
  const { count: hipotesisPendientes } = await sb
    .from('deductions_log').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
  const { count: gapsAbiertos } = await sb
    .from('knowledge_gaps').select('*', { count: 'exact', head: true })
    .in('estado', ['detectado', 'en_investigacion'])
  const { count: mensajes7d } = await sb
    .from('message_log').select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())

  const metricas = {
    total_senales:        totalSenales ?? 0,
    senales_pendientes:   pendingSenales ?? 0,
    hipotesis_pendientes: hipotesisPendientes ?? 0,
    gaps_abiertos:        gapsAbiertos ?? 0,
    mensajes_7d:          mensajes7d ?? 0,
    errores_runtime_24h:  errores.length,
    deploy_fallas_7d:     deploys.filter(a => a.tipo === 'deploy_fallido').length,
  }

  const resumenTexto = [
    `Estado global: ${estadoGlobal.toUpperCase()}`,
    `Señales pendientes: ${metricas.senales_pendientes}/${metricas.total_senales}`,
    `Hipótesis pendientes de validar: ${metricas.hipotesis_pendientes}`,
    `Knowledge gaps abiertos: ${metricas.gaps_abiertos}`,
    `Mensajes enviados últimos 7d: ${metricas.mensajes_7d}`,
  ].join(' | ')

  // Guardar en system_health_log
  await sb.from('system_health_log' as never).insert({
    checked_at:    now,
    estado_global: estadoGlobal,
    alertas:       todasAlertas,
    metricas,
  } as never)

  // Enviar email solo si hay alertas críticas o warnings
  if (todasAlertas.length) {
    await enviarAlertaEmail(todasAlertas, resumenTexto).catch(e =>
      console.error('Error enviando alerta:', e)
    )
  }

  const resultado = {
    ok:            true,
    checked_at:    now,
    estado_global: estadoGlobal,
    alertas_count: { criticas, warnings, total: todasAlertas.length },
    metricas,
    alertas:       todasAlertas,
  }

  console.log(JSON.stringify(resultado))
  return new Response(JSON.stringify(resultado), {
    headers: { 'Content-Type': 'application/json' },
  })
  } catch (e: any) {
    console.error('[proxis-cerebro] FATAL:', e)
    await sb.from('error_log').insert({
      componente: 'proxis-cerebro',
      severidad:  'error',
      mensaje:    e?.message ?? String(e),
      detalles:   { stack: e?.stack ?? '', timestamp: new Date().toISOString() },
    }).catch(() => {})
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'Error interno' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
