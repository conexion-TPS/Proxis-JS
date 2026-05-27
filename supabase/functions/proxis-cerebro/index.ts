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

// ── Check 6: integridad de asesores activos ──────────────────────────────────
async function checkIntegridadAsesores(): Promise<Alerta[]> {
  const alertas: Alerta[] = []

  const { data: activos } = await sb
    .from('asesor_credentials')
    .select('asesor')
    .eq('activo', true)

  if (!activos?.length) return alertas
  const nombres = activos.map((a: any) => a.asesor)

  const { data: conPerfil } = await sb
    .from('tps_perfiles').select('asesor').in('asesor', nombres)
  const sinPerfil = nombres.filter((n: string) => !(conPerfil ?? []).some((p: any) => p.asesor === n))
  if (sinPerfil.length) {
    alertas.push({
      tipo: 'asesores_sin_perfil',
      severidad: sinPerfil.length > 2 ? 'critical' : 'warning',
      mensaje: `${sinPerfil.length} asesor(es) activo(s) sin tps_perfiles — proxis-monitor generará prompts incompletos: ${sinPerfil.slice(0,3).join(', ')}`,
      valor: sinPerfil.length,
    })
  }

  const { data: conMetas } = await sb
    .from('metas').select('asesor').in('asesor', nombres)
  const sinMetas = nombres.filter((n: string) => !(conMetas ?? []).some((m: any) => m.asesor === n))
  if (sinMetas.length) {
    alertas.push({
      tipo: 'asesores_sin_metas',
      severidad: 'warning',
      mensaje: `${sinMetas.length} asesor(es) activo(s) sin metas configuradas: ${sinMetas.slice(0,3).join(', ')}`,
      valor: sinMetas.length,
    })
  }

  return alertas
}

// ── Check 7: triggers activos sin prompt ─────────────────────────────────────
async function checkTriggersSinPrompt(): Promise<Alerta[]> {
  const alertas: Alerta[] = []

  const { data: triggers } = await sb
    .from('trigger_config').select('id, nombre').eq('activo', true)
  if (!triggers?.length) return alertas

  const ids = triggers.map((t: any) => t.id)
  const { data: conPrompt } = await sb
    .from('prompts').select('trigger_id').in('trigger_id', ids).eq('activo', true)

  const sinPrompt = triggers.filter((t: any) =>
    !(conPrompt ?? []).some((p: any) => p.trigger_id === t.id)
  )
  if (sinPrompt.length) {
    alertas.push({
      tipo: 'triggers_sin_prompt',
      severidad: 'critical',
      mensaje: `${sinPrompt.length} trigger(s) activo(s) sin prompt — nunca enviarán mensajes: ${sinPrompt.map((t: any) => t.nombre ?? t.id).slice(0,3).join(', ')}`,
      valor: sinPrompt.length,
    })
  }
  return alertas
}

// ── Check 8: señales huérfanas (asesor no existe) ────────────────────────────
async function checkSenalesHuerfanas(): Promise<Alerta[]> {
  const alertas: Alerta[] = []

  const { data: activos } = await sb
    .from('asesor_credentials').select('asesor').eq('activo', true)
  if (!activos?.length) return alertas
  const nombres = activos.map((a: any) => a.asesor)

  const { count } = await sb
    .from('behavioral_signals')
    .select('*', { count: 'exact', head: true })
    .eq('procesada', false)
    .not('asesor', 'in', `(${nombres.map((n: string) => `"${n}"`).join(',')})`)

  if ((count ?? 0) > 0) {
    alertas.push({
      tipo: 'senales_huerfanas',
      severidad: 'warning',
      mensaje: `${count} señal(es) pendientes de asesores inactivos o eliminados — nunca serán procesadas`,
      valor: count ?? 0,
    })
  }
  return alertas
}

// ── Check 9: flujo de reportes (pipeline de entrada) ─────────────────────────
async function checkFlujoReportes(): Promise<Alerta[]> {
  const alertas: Alerta[] = []

  const { data: ultimo } = await sb
    .from('reportes')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: any }

  const { count: asesoresActivos } = await sb
    .from('asesor_credentials')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true)

  if (!asesoresActivos) return alertas   // sin asesores, sin expectativa de reportes

  if (!ultimo) {
    alertas.push({ tipo: 'sin_reportes', severidad: 'warning', mensaje: 'No hay ningún reporte ingresado en el sistema' })
    return alertas
  }

  const horasDesde = (Date.now() - new Date(ultimo.created_at).getTime()) / 3_600_000
  if (horasDesde > 120) {  // 5 días
    alertas.push({
      tipo: 'reportes_atrasados',
      severidad: 'critical',
      mensaje: `Último reporte ingresado hace ${Math.round(horasDesde / 24)} días — el pipeline de entrada puede estar roto`,
      valor: Math.round(horasDesde),
    })
  } else if (horasDesde > 72) {  // 3 días
    alertas.push({
      tipo: 'reportes_atrasados',
      severidad: 'warning',
      mensaje: `Último reporte hace ${Math.round(horasDesde / 24)} días — verificar carga de datos`,
      valor: Math.round(horasDesde),
    })
  }
  return alertas
}

// ── Check 10: reacciones silenciosas ─────────────────────────────────────────
async function checkReaccionesSilenciosas(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const since14d = new Date(Date.now() - 14 * 86_400_000).toISOString()

  const [{ count: mensajes14d }, { count: reacciones14d }] = await Promise.all([
    sb.from('message_log').select('*', { count: 'exact', head: true }).gte('created_at', since14d),
    sb.from('behavioral_signals').select('*', { count: 'exact', head: true })
      .in('tipo', ['reaccion_positiva', 'reaccion_negativa'])
      .gte('created_at', since14d),
  ])

  // Solo alerta si hay mensajes enviados pero cero reacciones — indica tracking roto
  if ((mensajes14d ?? 0) >= 5 && (reacciones14d ?? 0) === 0) {
    alertas.push({
      tipo: 'reacciones_silenciosas',
      severidad: 'warning',
      mensaje: `${mensajes14d} mensajes enviados en 14 días pero 0 reacciones registradas — el tracking de Sailor puede estar roto`,
      valor: mensajes14d ?? 0,
    })
  }
  return alertas
}

// ── Check 11: mensajes Sailor sin leer > 7 días ───────────────────────────────
async function checkSailorMensajesViejos(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const limite = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { count } = await sb
    .from('sailor_messages')
    .select('*', { count: 'exact', head: true })
    .eq('leido', false)
    .eq('origen', 'coach_ia')
    .lt('created_at', limite)

  if ((count ?? 0) > 0) {
    alertas.push({
      tipo: 'mensajes_sailor_sin_leer',
      severidad: (count ?? 0) > 10 ? 'critical' : 'warning',
      mensaje: `${count} mensaje(s) del coach IA sin leer hace más de 7 días — los asesores no están abriendo la app`,
      valor: count ?? 0,
    })
  }
  return alertas
}

// ── Check 12: Gemini quota / rate limit ───────────────────────────────────────
async function checkGeminiQuota(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const since24h = new Date(Date.now() - 86_400_000).toISOString()

  const { data: errs } = await sb
    .from('error_log')
    .select('mensaje, created_at')
    .gte('created_at', since24h)
    .or('mensaje.ilike.%429%,mensaje.ilike.%quota%,mensaje.ilike.%RESOURCE_EXHAUSTED%')
    .limit(5)

  if (errs?.length) {
    alertas.push({
      tipo: 'gemini_quota',
      severidad: 'critical',
      mensaje: `Gemini está retornando errores de cuota/rate-limit (${errs.length} ocurrencia(s) en 24h) — los mensajes del coach no se están generando`,
      valor: errs.length,
    })
  }
  return alertas
}

// ── Check 13: cron vacío (corrió pero procesó 0) ──────────────────────────────
async function checkCronVacio(): Promise<Alerta[]> {
  const alertas: Alerta[] = []

  // Toma los últimos 2 registros de system_health_log y compara senales_pendientes
  const { data: logs } = await sb
    .from('system_health_log')
    .select('checked_at, metricas')
    .order('checked_at', { ascending: false })
    .limit(3)

  if (!logs || logs.length < 2) return alertas

  const pendings = logs.map((l: any) => (l.metricas as any)?.senales_pendientes ?? null)
  // Si los últimos 3 checks muestran el mismo valor alto → analyzer no está reduciendo
  const allSame = pendings.every((v: any) => v !== null && v === pendings[0])
  if (allSame && (pendings[0] ?? 0) > 30) {
    alertas.push({
      tipo: 'cron_vacio',
      severidad: 'warning',
      mensaje: `proxis-analyzer corrió pero las señales pendientes llevan ${logs.length} checks consecutivos sin reducir (${pendings[0]} señales) — posible ejecución vacía`,
      valor: pendings[0],
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

/* ── Auto-reparaciones ──────────────────────────────────────── */

interface Reparacion {
  tipo_alerta: string
  accion:      string
  exito:       boolean
  detalle:     string
}

// Guarda el intento y retorna si ya se intentó demasiadas veces hoy
async function puedeReparar(tipo: string, maxIntentos = 3): Promise<boolean> {
  const since24h = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await sb
    .from('repair_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo_alerta', tipo)
    .gte('created_at', since24h)
  return (count ?? 0) < maxIntentos
}

async function logReparacion(rep: Reparacion): Promise<void> {
  await sb.from('repair_log').insert({
    tipo_alerta: rep.tipo_alerta,
    accion:      rep.accion,
    exito:       rep.exito,
    detalle:     rep.detalle,
  }).catch(e => console.error('[repair_log]', e))
}

// Reparación 1: crear tps_perfiles vacío para asesores sin perfil
async function repararAsesoresSinPerfil(): Promise<Reparacion> {
  const { data: activos } = await sb
    .from('asesor_credentials').select('asesor').eq('activo', true)
  const nombres: string[] = (activos ?? []).map((a: any) => a.asesor)
  const { data: conPerfil } = await sb
    .from('tps_perfiles').select('asesor').in('asesor', nombres)
  const sinPerfil = nombres.filter(n => !(conPerfil ?? []).some((p: any) => p.asesor === n))

  if (!sinPerfil.length)
    return { tipo_alerta: 'asesores_sin_perfil', accion: 'crear_perfil_default', exito: true, detalle: 'Sin acción necesaria' }

  const { error } = await sb.from('tps_perfiles').insert(
    sinPerfil.map(asesor => ({ asesor, confianza: 0 }))
  )
  return {
    tipo_alerta: 'asesores_sin_perfil',
    accion:      `crear_perfil_default: ${sinPerfil.join(', ')}`,
    exito:       !error,
    detalle:     error ? error.message : `Creados ${sinPerfil.length} perfiles vacíos — el sistema puede ahora generar prompts`,
  }
}

// Reparación 2: crear metas por defecto para asesores sin metas
async function repararAsesoresSinMetas(): Promise<Reparacion> {
  const { data: activos } = await sb
    .from('asesor_credentials').select('asesor').eq('activo', true)
  const nombres: string[] = (activos ?? []).map((a: any) => a.asesor)
  const { data: conMetas } = await sb
    .from('metas').select('asesor').in('asesor', nombres)
  const sinMetas = nombres.filter(n => !(conMetas ?? []).some((m: any) => m.asesor === n))

  if (!sinMetas.length)
    return { tipo_alerta: 'asesores_sin_metas', accion: 'crear_metas_default', exito: true, detalle: 'Sin acción necesaria' }

  const { error } = await sb.from('metas').insert(
    sinMetas.map(asesor => ({
      asesor,
      meta_contactos_semana: 3,
      meta_prospectos_mes:   15,
      meta_ingresos:         2_000_000,
    }))
  )
  return {
    tipo_alerta: 'asesores_sin_metas',
    accion:      `crear_metas_default: ${sinMetas.join(', ')}`,
    exito:       !error,
    detalle:     error ? error.message : `Creadas metas por defecto para ${sinMetas.length} asesor(es)`,
  }
}

// Reparación 3: marcar procesadas las señales de asesores eliminados/inactivos
async function repararSenalesHuerfanas(): Promise<Reparacion> {
  // Obtener todos los asesores activos
  const { data: activos } = await sb
    .from('asesor_credentials').select('asesor').eq('activo', true)
  const nombresActivos: string[] = (activos ?? []).map((a: any) => a.asesor)

  // Obtener los asesores únicos que tienen señales pendientes
  const { data: conSenales } = await sb
    .from('behavioral_signals')
    .select('asesor')
    .eq('procesada', false)
  const asesoresConSenales = [...new Set((conSenales ?? []).map((s: any) => s.asesor as string))]

  // Los huérfanos son los que tienen señales pero no están en activos
  const huerfanos = asesoresConSenales.filter(n => !nombresActivos.includes(n))
  if (!huerfanos.length)
    return { tipo_alerta: 'senales_huerfanas', accion: 'marcar_procesadas', exito: true, detalle: 'Sin señales huérfanas' }

  let total = 0
  for (const asesor of huerfanos) {
    const { count } = await sb
      .from('behavioral_signals')
      .update({ procesada: true })
      .eq('asesor', asesor)
      .eq('procesada', false)
      .select('*', { count: 'exact', head: true } as any)
    total += count ?? 0
  }

  return {
    tipo_alerta: 'senales_huerfanas',
    accion:      `marcar_procesadas para: ${huerfanos.join(', ')}`,
    exito:       true,
    detalle:     `${total} señales huérfanas marcadas como procesadas — ${huerfanos.length} asesor(es) limpiados`,
  }
}

// Reparación 4: invocar proxis-analyzer manualmente (para pipeline_stall y cron_vacio)
async function repararInvocarAnalyzer(tipoAlerta: string): Promise<Reparacion> {
  try {
    const r = await fetch(`${SB_URL}/functions/v1/proxis-analyzer`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ triggered_by: 'proxis-cerebro-auto-repair' }),
    })
    const data: any = await r.json().catch(() => ({}))
    return {
      tipo_alerta: tipoAlerta,
      accion:      'invocar_proxis_analyzer',
      exito:       r.ok,
      detalle:     r.ok
        ? `Analyzer ejecutado: ${data.asesores ?? 0} asesores, ${data.totalSenales ?? 0} señales procesadas`
        : `HTTP ${r.status}: ${data.error ?? 'Error desconocido'}`,
    }
  } catch (e: any) {
    return { tipo_alerta: tipoAlerta, accion: 'invocar_proxis_analyzer', exito: false, detalle: e.message }
  }
}

// Reparación 5: resetear gaps atascados en 'en_investigacion' > 14 días
async function repararGapsAtascados(): Promise<Reparacion> {
  const limite = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: gaps } = await sb
    .from('knowledge_gaps')
    .select('id')
    .eq('estado', 'en_investigacion')
    .lt('updated_at', limite)

  if (!gaps?.length)
    return { tipo_alerta: 'gaps_atascados', accion: 'resetear_gaps', exito: true, detalle: 'Sin gaps atascados' }

  const ids = gaps.map((g: any) => g.id)
  const { error } = await sb
    .from('knowledge_gaps')
    .update({ estado: 'detectado' })
    .in('id', ids)

  return {
    tipo_alerta: 'gaps_atascados',
    accion:      'resetear_gaps_en_investigacion',
    exito:       !error,
    detalle:     error ? error.message : `${ids.length} gap(s) reseteados a 'detectado' — volverán a cola de investigación`,
  }
}

// Orquestador: ejecuta todas las reparaciones pertinentes
async function executeRepairs(alertas: Alerta[]): Promise<Reparacion[]> {
  const tipos = new Set(alertas.map(a => a.tipo))
  const realizadas: Reparacion[] = []

  const REGISTRY: Array<{ tipo: string; fn: () => Promise<Reparacion> }> = [
    { tipo: 'asesores_sin_perfil',   fn: repararAsesoresSinPerfil },
    { tipo: 'asesores_sin_metas',    fn: repararAsesoresSinMetas },
    { tipo: 'senales_huerfanas',     fn: repararSenalesHuerfanas },
    { tipo: 'pipeline_stall',        fn: () => repararInvocarAnalyzer('pipeline_stall') },
    { tipo: 'cron_vacio',            fn: () => repararInvocarAnalyzer('cron_vacio') },
    // gaps_atascados: siempre corre como mantenimiento preventivo diario
    { tipo: '_mantenimiento',        fn: repararGapsAtascados },
  ]

  for (const entry of REGISTRY) {
    // _mantenimiento siempre corre; el resto solo si hay alerta del tipo
    if (entry.tipo !== '_mantenimiento' && !tipos.has(entry.tipo)) continue

    const puede = await puedeReparar(entry.tipo)
    if (!puede) {
      console.log(`[cerebro] repair ${entry.tipo}: ya intentado 3 veces hoy, escalar a humano`)
      continue
    }

    try {
      const rep = await entry.fn()
      await logReparacion(rep)
      realizadas.push(rep)
      console.log(`[cerebro] repair ${entry.tipo}: exito=${rep.exito} — ${rep.detalle}`)
    } catch (e: any) {
      const rep: Reparacion = {
        tipo_alerta: entry.tipo, accion: 'error_en_repair',
        exito: false, detalle: e.message,
      }
      await logReparacion(rep)
      realizadas.push(rep)
    }
  }

  return realizadas
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

  const [
    stall, cron, efect, criticos, sinMensajes, errores, deploys,
    integridad, sinPrompt, huerfanas, reportes, reacciones, sailorViejos, geminiQuota, cronVacio,
  ] = await Promise.all([
    checkPipelineStall(),
    checkCronSalud(),
    checkEfectividad(),
    checkAsesoresCriticos(),
    checkMensajesSinEnviar(),
    checkErrorLog(),
    checkDeploymentLog(),
    checkIntegridadAsesores(),
    checkTriggersSinPrompt(),
    checkSenalesHuerfanas(),
    checkFlujoReportes(),
    checkReaccionesSilenciosas(),
    checkSailorMensajesViejos(),
    checkGeminiQuota(),
    checkCronVacio(),
  ])

  const todasAlertas = [
    ...stall, ...cron, ...efect, ...criticos, ...sinMensajes, ...errores, ...deploys,
    ...integridad, ...sinPrompt, ...huerfanas, ...reportes, ...reacciones,
    ...sailorViejos, ...geminiQuota, ...cronVacio,
  ]
  const criticas     = todasAlertas.filter(a => a.severidad === 'critical').length
  const warnings     = todasAlertas.filter(a => a.severidad === 'warning').length
  const estadoGlobal = criticas > 0 ? 'critico' : warnings > 0 ? 'degradado' : 'saludable'

  // ── Auto-reparaciones (ejecutar antes de guardar el log) ─────────────────
  const reparaciones = await executeRepairs(todasAlertas)
  const reparacionesExitosas = reparaciones.filter(r => r.exito && r.detalle !== 'Sin acción necesaria')

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
    total_senales:              totalSenales ?? 0,
    senales_pendientes:         pendingSenales ?? 0,
    hipotesis_pendientes:       hipotesisPendientes ?? 0,
    gaps_abiertos:              gapsAbiertos ?? 0,
    mensajes_7d:                mensajes7d ?? 0,
    errores_runtime_24h:        errores.length,
    deploy_fallas_7d:           deploys.filter(a => a.tipo === 'deploy_fallido').length,
    asesores_sin_perfil:        integridad.filter(a => a.tipo === 'asesores_sin_perfil').reduce((s, a) => s + (Number(a.valor) || 0), 0),
    triggers_sin_prompt:        sinPrompt.reduce((s, a) => s + (Number(a.valor) || 0), 0),
    senales_huerfanas:          huerfanas.reduce((s, a) => s + (Number(a.valor) || 0), 0),
    mensajes_sailor_sin_leer:   sailorViejos.reduce((s, a) => s + (Number(a.valor) || 0), 0),
    gemini_quota_errores_24h:   geminiQuota.length,
  }

  const resumenTexto = [
    `Estado global: ${estadoGlobal.toUpperCase()}`,
    `Señales pendientes: ${metricas.senales_pendientes}/${metricas.total_senales}`,
    `Hipótesis pendientes de validar: ${metricas.hipotesis_pendientes}`,
    `Knowledge gaps abiertos: ${metricas.gaps_abiertos}`,
    `Mensajes enviados últimos 7d: ${metricas.mensajes_7d}`,
    reparacionesExitosas.length
      ? `\nREPARACIONES AUTOMÁTICAS (${reparacionesExitosas.length}): ${reparacionesExitosas.map(r => r.detalle).join(' | ')}`
      : '',
  ].filter(Boolean).join(' | ')

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
    ok:             true,
    checked_at:     now,
    estado_global:  estadoGlobal,
    alertas_count:  { criticas, warnings, total: todasAlertas.length },
    metricas,
    alertas:        todasAlertas,
    reparaciones:   reparaciones.filter(r => r.detalle !== 'Sin acción necesaria'),
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
