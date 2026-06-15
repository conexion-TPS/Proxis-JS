// proxis-cerebro — Monitor de salud del sistema
// Cron: 0 9 * * *  (diario 9:00 UTC → 6:00 AM Chile)
// Detecta anomalías en el pipeline, degradación de efectividad y
// genera un registro diario de estado en system_health_log.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAsesoresAutorizados, filtrarAutorizados } from '../_shared/tenant.ts'

const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY = Deno.env.get('RESEND_KEY') ?? ''
// Bearer para llamadas función→función. El SUPABASE_SERVICE_ROLE_KEY inyectado por la
// plataforma puede NO ser un JWT (formato nuevo sb_secret_…) → las funciones con
// verify_jwt=true lo rechazan con 401. INTERNAL_SR_JWT guarda el service_role JWT legacy
// (eyJ…) que el gateway sí valida. Fallback a SB_KEY para no romper si no está seteado.
const INTERNAL_JWT = Deno.env.get('INTERNAL_SR_JWT') || SB_KEY
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

  // Umbrales RELATIVOS al tamaño del despliegue (antes 50/200 era ciego a pilotos chicos)
  const { count: activosC } = await sb
    .from('asesor_credentials').select('*', { count: 'exact', head: true }).eq('activo', true)
  const activos = activosC ?? 0
  const warnUmbral = Math.max(10, activos * 5)
  const critUmbral = Math.max(30, activos * 12)

  if (pending > critUmbral) {
    alertas.push({ tipo: 'pipeline_stall', severidad: 'critical', mensaje: `${pending} señales sin procesar (umbral ${critUmbral}) — el analyzer puede estar fallando`, valor: pending })
  } else if (pending > warnUmbral) {
    alertas.push({ tipo: 'pipeline_stall', severidad: 'warning', mensaje: `${pending} señales pendientes de análisis (umbral ${warnUmbral})`, valor: pending })
  }
  return alertas
}

// CHECK DE RESULTADO (no de latencia): señales que llevan más de un ciclo semanal
// sin procesar = el analyzer NO está convirtiendo señales en hipótesis. Independiente
// de la escala — es lo que el cerebro NO detectaba (analyzer muerto reportado "saludable").
async function checkSenalesEstancadas(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const limite = new Date(Date.now() - 8 * 86_400_000).toISOString()
  const { count } = await sb
    .from('behavioral_signals')
    .select('*', { count: 'exact', head: true })
    .eq('procesada', false)
    .lt('created_at', limite)
  if ((count ?? 0) > 0) {
    alertas.push({
      tipo: 'analyzer_no_procesa',
      severidad: 'critical',
      mensaje: `${count} señal(es) llevan +8 días sin procesar — el proxis-analyzer no está generando hipótesis. Revisar fallos de Gemini en error_log.`,
      valor: count ?? 0,
    })
  }
  return alertas
}

// CHECK DE COHERENCIA: una acción marcada "ejecutada" DEBE tener una entrega real
// en message_log. Si hay más ejecutadas que entregadas, alguna acción "completó"
// sin enviar nada (el no-op cosmético que el cerebro no detectaba antes).
async function checkAccionesNoEntregadas(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const { count: ejecutadas } = await sb
    .from('deductions_log').select('*', { count: 'exact', head: true })
    .in('accion_tipo', ['trigger', 'escalar_supervisor']).eq('accion_ejecutada', true)
  const { count: entregadas } = await sb
    .from('message_log').select('*', { count: 'exact', head: true })
    .in('trigger_id', ['hipotesis-accion', 'hipotesis-escalar-supervisor'])
  const e = ejecutadas ?? 0, d = entregadas ?? 0
  if (e > d) {
    alertas.push({
      tipo: 'acciones_no_entregadas',
      severidad: 'warning',
      mensaje: `${e} acción(es) de hipótesis marcadas ejecutadas pero solo ${d} con entrega en message_log — alguna acción puede estar completando sin enviar`,
      valor: e - d,
    })
  }
  return alertas
}

// Fallos de las funciones de IA (analyzer/observacion) registrados en error_log.
// Ahora que esas funciones LOGUEAN sus fallos (antes eran silenciosos), el cerebro
// los puede ver sin esperar a que se acumulen cientos de señales.
async function checkFuncionesIA(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const since48 = new Date(Date.now() - 48 * 3_600_000).toISOString()
  const { data: errs, count } = await sb
    .from('error_log')
    .select('componente', { count: 'exact' })
    .in('componente', ['proxis-analyzer', 'proxis-observacion', 'proxis-researcher', 'proxis-accion'])
    .gte('created_at', since48)
  if ((count ?? 0) > 0) {
    const comps = [...new Set((errs ?? []).map((e: any) => e.componente))].join(', ')
    alertas.push({
      tipo: 'ia_fallos',
      severidad: 'warning',
      mensaje: `${count} fallo(s) de IA en 48h (${comps}) — generación de hipótesis/observaciones degradada`,
      valor: count ?? 0,
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
  const nombresActivos = new Set(activos.map((a: any) => a.asesor as string))

  // Fetch pending asesores and compare in-memory to avoid PostgREST filter
  // parsing failures when names contain spaces or special characters
  const { data: senalesPendientes } = await sb
    .from('behavioral_signals')
    .select('asesor')
    .eq('procesada', false)

  const asesoresConSenales = [...new Set((senalesPendientes ?? []).map((s: any) => s.asesor as string))]
  const huerfanos = asesoresConSenales.filter(n => !nombresActivos.has(n))
  if (!huerfanos.length) return alertas

  let totalCount = 0
  for (const asesor of huerfanos) {
    const { count } = await sb
      .from('behavioral_signals')
      .select('*', { count: 'exact', head: true })
      .eq('asesor', asesor)
      .eq('procesada', false)
    totalCount += count ?? 0
  }

  if (totalCount > 0) {
    alertas.push({
      tipo: 'senales_huerfanas',
      severidad: 'warning',
      mensaje: `${totalCount} señal(es) pendientes de asesores inactivos o eliminados — nunca serán procesadas`,
      valor: totalCount,
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
    .or('mensaje.ilike.%429%,mensaje.ilike.%quota%,mensaje.ilike.%rate%limit%,mensaje.ilike.%Groq%,mensaje.ilike.%OpenRouter%,mensaje.ilike.%RESOURCE_EXHAUSTED%')
    .limit(5)

  if (errs?.length) {
    alertas.push({
      tipo: 'gemini_quota',
      severidad: 'critical',
      mensaje: `La IA (Groq/OpenRouter) está retornando errores de cuota/rate-limit (${errs.length} ocurrencia(s) en 24h) — los mensajes del coach no se están generando`,
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
  if (allSame && (pendings[0] ?? 0) > 8) {
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

// ── Check 14: estado de la última corrida de canarios ────────────────────────
// Los canarios corren BAJO DEMANDA (no en este cron — decisión HP 06-01, para no
// gastar Gemini automáticamente). Este check pasivo lee su último resultado y lo
// trae al canal de alertas: si la última corrida tuvo fallos, el cerebro avisa.
async function checkCanarios(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const { data: last } = await sb
    .from('canary_log')
    .select('run_at, failed, gemini_ok, resultados')
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: any }

  if (!last) {
    alertas.push({
      tipo: 'canarios_nunca',
      severidad: 'info',
      mensaje: 'El arnés de canarios nunca se ha corrido — ejecutarlo bajo demanda para verificar el pipeline end-to-end',
    })
    return alertas
  }

  if ((last.failed ?? 0) > 0) {
    const fallos = (last.resultados ?? [])
      .filter((r: any) => !r.ok && !r.skipped && r.id !== 'A1')
      .map((r: any) => `${r.id}/${r.pipeline}`)
    alertas.push({
      tipo: 'canarios_fallando',
      severidad: 'critical',
      mensaje: `Última corrida de canarios con ${last.failed} fallo(s) de contrato: ${fallos.join(', ')} — un contrato del pipeline está roto`,
      valor: last.failed,
    })
  }

  // Gemini caído en la última corrida → los canarios IA (A3/A4/A5/A7) no se verificaron.
  // Es informativo (cuota), no un contrato roto.
  if (last.gemini_ok === false) {
    alertas.push({
      tipo: 'canarios_ia_sin_verificar',
      severidad: 'info',
      mensaje: 'En la última corrida de canarios Gemini no estaba disponible (429/cuota) — los canarios de IA quedaron sin verificar; re-ejecutar cuando la cuota se enfríe',
    })
  }

  const dias = (Date.now() - new Date(last.run_at).getTime()) / 86_400_000
  if (dias > 14) {
    alertas.push({
      tipo: 'canarios_obsoletos',
      severidad: 'info',
      mensaje: `Última corrida de canarios hace ${Math.round(dias)} días — re-ejecutar el arnés`,
      valor: Math.round(dias),
    })
  }
  return alertas
}

// ── Check 15: medidor PROACTIVO de uso de Gemini ─────────────────────────────
// Antes solo se detectaba el 429 reactivo. Esto agrega el consumo del día (llamadas
// + tokens reales de gemini_usage) y avisa al acercarse al tope del free-tier, ANTES
// de chocar. Tope conservador y editable (no usamos tier pago todavía).
const GROQ_FREE_REQ_DIA = 13000   // tope conservador: Groq free real es 14,400/día, avisamos antes
async function checkGeminiUso(): Promise<Alerta[]> {
  const alertas: Alerta[] = []
  const hoy0 = new Date(); hoy0.setUTCHours(0, 0, 0, 0)
  const { data } = await sb
    .from('gemini_usage')
    .select('ok, total_tokens')
    .gte('created_at', hoy0.toISOString())
  const rows = data ?? []
  const total  = rows.length
  if (total === 0) return alertas
  const fallos = rows.filter((r: any) => r.ok === false).length
  const tokens = rows.reduce((s: number, r: any) => s + (r.total_tokens ?? 0), 0)
  const pct = Math.round((total / GROQ_FREE_REQ_DIA) * 100)
  if (total >= GROQ_FREE_REQ_DIA * 0.8) {
    alertas.push({
      tipo: 'gemini_uso_alto',
      severidad: total >= GROQ_FREE_REQ_DIA ? 'critical' : 'warning',
      mensaje: `IA hoy (Groq): ${total} llamadas (${pct}% del tope free-tier ~${GROQ_FREE_REQ_DIA}/día) · ${tokens.toLocaleString('es-CL')} tokens · ${fallos} fallo(s). Espaciar o pasar a tier pago.`,
      valor: total,
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
  try {
    await sb.from('repair_log').insert({
      tipo_alerta: rep.tipo_alerta,
      accion:      rep.accion,
      exito:       rep.exito,
      detalle:     rep.detalle,
    })
  } catch (e) {
    console.error('[repair_log]', e)
  }
}

// Reparación 1: crear tps_perfiles vacío para asesores sin perfil
async function repararAsesoresSinPerfil(): Promise<Reparacion> {
  const { data: activos } = await sb
    .from('asesor_credentials').select('asesor').eq('activo', true)
  const nombres: string[] = (activos ?? []).map((a: any) => a.asesor)
  // Gate por institución (lista blanca, fail-closed): solo se siembra para autorizados.
  const autz = await getAsesoresAutorizados(sb)
  const nombresG = filtrarAutorizados(nombres, autz)
  const { data: conPerfil } = await sb
    .from('tps_perfiles').select('asesor').in('asesor', nombresG)
  const sinPerfil = nombresG.filter(n => !(conPerfil ?? []).some((p: any) => p.asesor === n))

  if (!sinPerfil.length)
    return { tipo_alerta: 'asesores_sin_perfil', accion: 'crear_perfil_default', exito: true, detalle: 'Sin acción necesaria' }

  const { error } = await sb.from('tps_perfiles').insert(
    sinPerfil.map(asesor => ({
      asesor,
      perfil_base:           'pendiente',
      confianza_diagnostico: 'sin_evaluar',
      puntaje_a:             0,
      puntaje_b:             0,
    }))
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
  // Gate por institución (lista blanca, fail-closed): solo se siembra para autorizados.
  const autz = await getAsesoresAutorizados(sb)
  const nombresG = filtrarAutorizados(nombres, autz)
  const { data: conMetas } = await sb
    .from('metas').select('asesor').in('asesor', nombresG)
  const sinMetas = nombresG.filter(n => !(conMetas ?? []).some((m: any) => m.asesor === n))

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

  for (const asesor of huerfanos) {
    await sb
      .from('behavioral_signals')
      .update({ procesada: true })
      .eq('asesor', asesor)
      .eq('procesada', false)
  }

  return {
    tipo_alerta: 'senales_huerfanas',
    accion:      `marcar_procesadas para: ${huerfanos.join(', ')}`,
    exito:       true,
    detalle:     `Señales de ${huerfanos.length} asesor(es) sin cuenta activa marcadas como procesadas`,
  }
}

// Reparación 4: invocar proxis-analyzer manualmente (para pipeline_stall y cron_vacio)
async function repararInvocarAnalyzer(tipoAlerta: string): Promise<Reparacion> {
  try {
    const r = await fetch(`${SB_URL}/functions/v1/proxis-analyzer`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${INTERNAL_JWT}`, 'Content-Type': 'application/json' },
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
    .lt('created_at', limite)

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
    { tipo: 'analyzer_no_procesa',   fn: () => repararInvocarAnalyzer('analyzer_no_procesa') },
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
    ? `Sailor Mentor · revisión del sistema: ${criticas.length} alerta(s) crítica(s) — ${new Date().toLocaleDateString('es-CL')}`
    : `Sailor Mentor · revisión del sistema: ${warnings.length} cosa(s) por mirar — ${new Date().toLocaleDateString('es-CL')}`

  const cuerpo = [
    `Soy Sailor. Revisé la salud del sistema hoy (${new Date().toISOString().slice(0, 10)}) y esto es lo que encontré:`,
    '',
    resumen,
    '',
    criticas.length ? `Lo urgente (${criticas.length}):` : '',
    ...criticas.map(a => `  ❌ ${a.mensaje}`),
    warnings.length ? `\nPara mirar con calma (${warnings.length}):` : '',
    ...warnings.map(a => `  ⚠️  ${a.mensaje}`),
    '',
    'Te aviso apenas veo algo raro. — Sailor Mentor',
  ].filter(l => l !== undefined).join('\n')

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Sailor Mentor (Proxis) <proxis@theprecisionselling.com>',
      to:      ADMIN_EMAIL,
      subject: asunto,
      text:    cuerpo,
    }),
  })
}

/* ── CANARIOS — auto-test activo por pipeline (on-demand) ─────────────────────
 * El cubo es cerrado: cada función tiene un contrato que definimos. Un canario
 * SIEMBRA un dato sintético → INVOCA el pipeline → VERIFICA el contrato → LIMPIA.
 * Caza "corrió pero no produjo" y "funciona mal" (lo que el monitoreo pasivo no ve).
 *
 * Convención de seguridad: todo artefacto usa el asesor sintético __canary__
 * (inactivo, excluido de las pasadas reales de signals/analyzer/monitor por el
 * filtro `__*`). Los canarios que envían corren en dry-run. Limpieza idempotente
 * antes y después de cada uno.
 *
 * Decisión HP (06-01): viven DENTRO del cerebro y corren SOLO bajo demanda
 * (invocar con { run_canaries: true }); el cron diario NO los ejecuta → cero gasto
 * Gemini automático hasta pasar a tier pago. A1 (sonda Gemini barata) hace de
 * compuerta: si Gemini no responde, se saltan los canarios que lo usan. */

const CANARY = '__canary__'

interface CanaryResult {
  id:        string   // A1, A2, …
  pipeline:  string
  ok:        boolean
  detalle:   string
  skipped?:  boolean
}

async function invokeFn(nameAndQuery: string, body: unknown): Promise<{ status: number; json: any }> {
  const r = await fetch(`${SB_URL}/functions/v1/${nameAndQuery}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${INTERNAL_JWT}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body ?? {}),
  })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json }
}

// ¿Hubo un 429/cuota de Gemini para este componente desde `desdeISO`? Permite a los
// canarios IA distinguir "Gemini sin cuota" (inconcluso, no es bug) de "contrato roto".
function esQuota(s: string): boolean {
  return /429|quota|RESOURCE_EXHAUSTED/i.test(s ?? '')
}
async function huboQuota429(componente: string, desdeISO: string): Promise<boolean> {
  const { data } = await sb
    .from('error_log')
    .select('mensaje')
    .eq('componente', componente)
    .gte('created_at', desdeISO)
    .order('created_at', { ascending: false })
    .limit(5)
  return (data ?? []).some((e: any) => esQuota(e.mensaje))
}

// Borra TODOS los artefactos del asesor sintético. Idempotente (corre antes y después).
async function limpiarCanary(): Promise<void> {
  const tablas = [
    'knowledge_proposals', 'knowledge_gaps', 'deductions_log', 'behavioral_signals',
    'asesor_perfil_historial', 'asesor_perfil', 'tps_perfiles', 'ingresos', 'metas',
    'message_log', 'sailor_messages', 'asesor_credentials',
  ]
  for (const t of tablas)
    await sb.from(t).delete().eq('asesor', CANARY).then(undefined, () => {})
}

// ── A1 · Gemini transversal: ¿responde JSON válido no vacío? ──────────────────
async function canaryGemini(): Promise<CanaryResult> {
  const id = 'A1', pipeline = 'gemini'
  const GEMINI_KEY = Deno.env.get('GEMINI_KEY') ?? ''
  if (!GEMINI_KEY) return { id, pipeline, ok: false, detalle: 'GEMINI_KEY no configurada' }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Devuelve exactamente este JSON, sin texto extra: {"ok":true}' }] }],
          generationConfig: { maxOutputTokens: 50, temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    )
    if (!res.ok) {
      await sb.from('gemini_usage').insert({ componente: 'proxis-cerebro', ok: false, status: res.status }).then(undefined, () => {})
      return { id, pipeline, ok: false, detalle: `Gemini HTTP ${res.status}` }
    }
    const data = await res.json()
    await sb.from('gemini_usage').insert({
      componente: 'proxis-cerebro', ok: true, status: 200,
      prompt_tokens: data.usageMetadata?.promptTokenCount ?? null,
      output_tokens: data.usageMetadata?.candidatesTokenCount ?? null,
      total_tokens:  data.usageMetadata?.totalTokenCount ?? null,
    }).then(undefined, () => {})
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
    if (!text) return { id, pipeline, ok: false, detalle: 'Gemini devolvió texto vacío (posible regresión del bug "thinking")' }
    try { JSON.parse(text) } catch { return { id, pipeline, ok: false, detalle: `Gemini devolvió no-JSON: ${text.slice(0, 60)}` } }
    return { id, pipeline, ok: true, detalle: 'Gemini responde JSON válido no vacío' }
  } catch (e: any) {
    return { id, pipeline, ok: false, detalle: e?.message ?? String(e) }
  }
}

// ── A2 · proxis-signals: dada actividad, ¿crea señales? (sin Gemini) ──────────
async function canarySignals(): Promise<CanaryResult> {
  const id = 'A2', pipeline = 'proxis-signals'
  try {
    await limpiarCanary()
    const mes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    // meta_ingresos baja + ingreso por encima → dispara 'meta_ingresos_superada' (determinista)
    await sb.from('metas').insert({ asesor: CANARY, meta_contactos_semana: 3, meta_prospectos_mes: 15, meta_ingresos: 1000 })
    await sb.from('ingresos').insert({ asesor: CANARY, mes, ingreso_real: 5000 })
    const { status, json } = await invokeFn('proxis-signals', { asesor: CANARY })
    if (status !== 200 || json?.ok !== true)
      return { id, pipeline, ok: false, detalle: `signals HTTP ${status}: ${json?.error ?? ''}` }
    const { count } = await sb.from('behavioral_signals').select('*', { count: 'exact', head: true }).eq('asesor', CANARY)
    const ok = (count ?? 0) >= 1
    return { id, pipeline, ok, detalle: ok ? `${count} señal(es) generada(s) desde la actividad sembrada` : 'No generó señales pese a la actividad (ingesta muda)' }
  } catch (e: any) {
    return { id, pipeline, ok: false, detalle: e?.message ?? String(e) }
  } finally { await limpiarCanary() }
}

// ── A3 · proxis-analyzer: señal pendiente → procesada + hipótesis (Gemini) ────
async function canaryAnalyzer(): Promise<CanaryResult> {
  const id = 'A3', pipeline = 'proxis-analyzer'
  try {
    await limpiarCanary()
    // Pre-seed tps_perfiles (cols NOT NULL sin default) para que el upsert interno del
    // analyzer no falle por constraint — el fallo sería de seeding, no de contrato.
    await sb.from('tps_perfiles').insert({ asesor: CANARY, version_instrumento: '1.0', perfil_base: 'canary', confianza_diagnostico: 'sin_evaluar', puntaje_a: 0, puntaje_b: 0 })
    await sb.from('asesor_perfil').insert({ asesor: CANARY, perfil_dominante: 'A', identidad_vendedora: 'Asesor sintético del arnés de canarios.' })
    await sb.from('behavioral_signals').insert({ asesor: CANARY, fuente: 'manual', tipo: 'canary_probe', valor: '3', dimension_target: 'relacion_prospeccion', confianza_hint: 60, procesada: false, contexto: { canary: true } })
    const t0 = new Date(Date.now() - 5000).toISOString()
    const { status, json } = await invokeFn('proxis-analyzer', { asesor: CANARY })
    if (status !== 200 || json?.ok !== true)
      return { id, pipeline, ok: false, detalle: `analyzer HTTP ${status}: ${json?.error ?? ''}` }
    const { count: pendientes } = await sb.from('behavioral_signals').select('*', { count: 'exact', head: true }).eq('asesor', CANARY).eq('procesada', false)
    const { count: hip } = await sb.from('deductions_log').select('*', { count: 'exact', head: true }).eq('asesor', CANARY)
    const procesada = (pendientes ?? 1) === 0
    const generoHip = (hip ?? 0) >= 1
    const ok = procesada && generoHip
    if (ok) return { id, pipeline, ok: true, detalle: `señal procesada + ${hip} hipótesis generada(s)` }
    // No cumplió el contrato: ¿fue cuota Gemini (inconcluso) o bug real?
    if (await huboQuota429('proxis-analyzer', t0))
      return { id, pipeline, ok: false, skipped: true, detalle: 'Inconcluso: Gemini 429/cuota durante el análisis — reintentar cuando se enfríe' }
    return { id, pipeline, ok: false, detalle: `procesada=${procesada}, hipótesis=${hip ?? 0} — el analyzer no convierte señales en hipótesis (revisar bug del "thinking")` }
  } catch (e: any) {
    return { id, pipeline, ok: false, detalle: e?.message ?? String(e) }
  } finally { await limpiarCanary() }
}

// ── A4 · proxis-researcher: gap en_investigacion → propuesta (Gemini) ─────────
async function canaryResearcher(): Promise<CanaryResult> {
  const id = 'A4', pipeline = 'proxis-researcher'
  try {
    await limpiarCanary()
    const { data: gap } = await sb.from('knowledge_gaps').insert({
      asesor: CANARY, dimension: 'relacion_prospeccion',
      descripcion: 'Canario: vacío sintético para verificar el researcher.',
      prioridad: 3, estado: 'en_investigacion',
    }).select('id').single()
    const gapId = gap?.id
    if (!gapId) return { id, pipeline, ok: false, detalle: 'No se pudo sembrar el gap canario' }
    const t0 = new Date(Date.now() - 5000).toISOString()
    const { status, json } = await invokeFn(`proxis-researcher?gap_id=${gapId}`, {})
    if (status !== 200 || json?.ok !== true)
      return { id, pipeline, ok: false, detalle: `researcher HTTP ${status}: ${json?.error ?? ''}` }
    const { count } = await sb.from('knowledge_proposals').select('*', { count: 'exact', head: true }).eq('asesor', CANARY)
    if ((count ?? 0) >= 1) return { id, pipeline, ok: true, detalle: 'propuesta de conocimiento generada' }
    if (await huboQuota429('proxis-researcher', t0))
      return { id, pipeline, ok: false, skipped: true, detalle: 'Inconcluso: Gemini 429/cuota durante la investigación — reintentar cuando se enfríe' }
    return { id, pipeline, ok: false, detalle: 'No generó propuesta (revisar bug del "thinking" en researcher)' }
  } catch (e: any) {
    return { id, pipeline, ok: false, detalle: e?.message ?? String(e) }
  } finally { await limpiarCanary() }
}

// ── A5 · proxis-observacion: perfil → ítem con opciones (Gemini) ──────────────
async function canaryObservacion(): Promise<CanaryResult> {
  const id = 'A5', pipeline = 'proxis-observacion'
  try {
    await limpiarCanary()
    await sb.from('asesor_perfil').insert({
      asesor: CANARY, perfil_dominante: 'R',
      identidad_vendedora: 'Asesor sintético; prefiere construir vínculo antes de cerrar.',
      relacion_prospeccion: 'Le cuesta la prospección en frío.',
    })
    const { status, json } = await invokeFn('proxis-observacion', { asesor: CANARY })
    if (status !== 200 || json?.ok !== true)
      return { id, pipeline, ok: false, detalle: `observacion HTTP ${status}: ${json?.error ?? ''}` }
    const item = json?.item
    const tieneItem = !!(item?.stem && Array.isArray(item?.opciones) && item.opciones.length > 0)
    if (tieneItem) return { id, pipeline, ok: true, detalle: `ítem generado con ${item.opciones.length} opciones` }
    // Sembramos un perfil base → DEBE producir un ítem. Distinguir causa:
    //  - 'ia_no_disponible' = Gemini lanzó error (típicamente 429) → INCONCLUSO, no es bug.
    //  - 'sin_item' = Gemini respondió pero vacío/no parseable → el bug del "thinking" (FALLO real).
    const motivo = json?.motivo ?? 'desconocido'
    if (motivo === 'ia_no_disponible')
      return { id, pipeline, ok: false, skipped: true, detalle: 'Inconcluso: Gemini no disponible (429/cuota) al generar la observación' }
    return { id, pipeline, ok: false, detalle: `sin ítem (motivo: ${motivo}) pese al perfil sembrado — revisar bug del "thinking"` }
  } catch (e: any) {
    return { id, pipeline, ok: false, detalle: e?.message ?? String(e) }
  } finally { await limpiarCanary() }
}

// ── A7 · proxis-accion: deducción → entrega real (dry-run, Gemini) ────────────
async function canaryAccion(): Promise<CanaryResult> {
  const id = 'A7', pipeline = 'proxis-accion'
  try {
    await limpiarCanary()
    // __canary__ inactivo a propósito (invisible a las pasadas reales); accion dry_run no exige activo.
    await sb.from('asesor_credentials').insert({ asesor: CANARY, email: 'canary@theprecisionselling.com', password_hash: 'x', activo: false })
    const { data: d } = await sb.from('deductions_log').insert({
      asesor: CANARY, hipotesis: 'Canario: hipótesis sintética para verificar la entrega de acciones.',
      dimension_afectada: 'relacion_prospeccion', confianza: 60,
      accion_tipo: 'trigger', accion_descripcion: 'Enviar un mensaje breve de aliento sobre prospección.', estado: 'validada',
    }).select('id').single()
    const did = d?.id
    if (!did) return { id, pipeline, ok: false, detalle: 'No se pudo sembrar la deducción canaria' }
    const { status, json } = await invokeFn('proxis-accion', { deduction_id: did, dry_run: true })
    if (status !== 200 || json?.ok !== true) {
      if (esQuota(String(json?.error ?? '')))
        return { id, pipeline, ok: false, skipped: true, detalle: 'Inconcluso: Gemini 429/cuota al componer el mensaje de la acción' }
      return { id, pipeline, ok: false, detalle: `accion HTTP ${status}: ${json?.error ?? ''}` }
    }
    const ok = !!(json?.dry_run && json?.destinatario && String(json?.mensaje ?? '').trim().length > 0)
    return { id, pipeline, ok, detalle: ok ? 'entrega resuelta (destinatario + mensaje compuesto)' : 'no resolvió destinatario/mensaje (posible regresión al no-op cosmético)' }
  } catch (e: any) {
    return { id, pipeline, ok: false, detalle: e?.message ?? String(e) }
  } finally { await limpiarCanary() }
}

// ── A8 · proxis-informes: cada gerente recibe su sub-árbol (dry-run, sin Gemini) ─
async function canaryInformes(): Promise<CanaryResult> {
  const id = 'A8', pipeline = 'proxis-informes'
  try {
    const { status, json } = await invokeFn('proxis-informes', { dry_run: true })
    if (status !== 200 || json?.ok !== true)
      return { id, pipeline, ok: false, detalle: `informes HTTP ${status}: ${json?.error ?? ''}` }
    const preview = Array.isArray(json?.preview) ? json.preview : null
    if (!preview) return { id, pipeline, ok: false, detalle: 'dry-run no devolvió preview de informes' }
    if (preview.length === 0) return { id, pipeline, ok: true, detalle: 'dry-run OK (0 gerentes con informe — sin jerarquía configurada)' }
    const bienFormados = preview.every((p: any) => p.destinatario && p.email && String(p.cuerpo ?? '').trim().length > 0)
    return { id, pipeline, ok: bienFormados, detalle: bienFormados ? `${preview.length} informe(s) por gerente bien formado(s)` : 'algún informe sin destinatario/cuerpo' }
  } catch (e: any) {
    return { id, pipeline, ok: false, detalle: e?.message ?? String(e) }
  }
}

// Orquestador: corre la batería, aplica la compuerta A1 y la cobertura C1.
async function runCanarios(): Promise<{ resultados: CanaryResult[]; geminiOk: boolean }> {
  const resultados: CanaryResult[] = []

  // A1 primero — compuerta de frugalidad: si Gemini no responde, saltar los caros.
  const a1 = await canaryGemini()
  resultados.push(a1)
  const geminiOk = a1.ok

  // Canarios sin Gemini: siempre
  resultados.push(await canarySignals())
  resultados.push(await canaryInformes())

  // Canarios con Gemini: solo si A1 pasó
  if (geminiOk) {
    resultados.push(await canaryAnalyzer())
    resultados.push(await canaryResearcher())
    resultados.push(await canaryObservacion())
    resultados.push(await canaryAccion())
  } else {
    const caros: Array<[string, string]> = [
      ['A3', 'proxis-analyzer'], ['A4', 'proxis-researcher'],
      ['A5', 'proxis-observacion'], ['A7', 'proxis-accion'],
    ]
    for (const [cid, pl] of caros)
      resultados.push({ id: cid, pipeline: pl, ok: false, skipped: true, detalle: 'Saltado: Gemini no disponible (A1 falló) — reintentar cuando la cuota se enfríe' })
  }

  // C1 — cobertura (meta): pipelines conocidos sin canario. Honesto sobre los blind spots.
  const PIPELINES = ['proxis-signals', 'proxis-analyzer', 'proxis-researcher', 'proxis-observacion', 'proxis-accion', 'proxis-monitor', 'proxis-informes']
  const cubiertos = new Set(resultados.map(r => r.pipeline))
  for (const p of PIPELINES.filter(p => !cubiertos.has(p)))
    resultados.push({ id: 'C1', pipeline: p, ok: true, skipped: true, detalle: `Cobertura: ${p} aún no tiene canario (pendiente — p.ej. A6 monitor)` })

  return { resultados, geminiOk }
}

/* ── Handler principal ──────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  try {
  // Rama on-demand: ejecutar el arnés de canarios (no corre en el cron diario).
  const reqBody = await req.json().catch(() => ({})) as { run_canaries?: boolean; triggered_by?: string }
  if (reqBody?.run_canaries === true) {
    await limpiarCanary()
    const { resultados, geminiOk } = await runCanarios()
    // A1 es la COMPUERTA (sonda Gemini), no un canario de contrato: un 429 transitorio
    // no debe contar como fallo de pipeline ni marcar el sistema crítico por días.
    // El tally cuenta solo canarios de contrato que efectivamente corrieron.
    const contrato = resultados.filter(r => !r.skipped && r.id !== 'A1')
    const passed = contrato.filter(r => r.ok).length
    const failed = contrato.filter(r => !r.ok).length
    const ok = failed === 0
    await sb.from('canary_log').insert({
      ok, total: contrato.length, passed, failed, gemini_ok: geminiOk,
      resultados, triggered_by: reqBody?.triggered_by ?? 'manual',
    } as never).then(undefined, () => {})
    const out = { ok, gemini_ok: geminiOk, passed, failed, resultados }
    console.log(JSON.stringify(out))
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } })
  }

  const now = new Date().toISOString()

  const safe = (fn: () => Promise<Alerta[]>): Promise<Alerta[]> =>
    fn().catch((e: any) => { console.error('[cerebro] check error:', e?.message); return [] })

  const [
    stall, cron, efect, criticos, sinMensajes, errores, deploys,
    integridad, sinPrompt, huerfanas, reportes, reacciones, sailorViejos, geminiQuota, cronVacio,
    estancadas, iaFallos, accionesNoEntregadas, canarios, geminiUso,
  ] = await Promise.all([
    safe(checkPipelineStall),
    safe(checkCronSalud),
    safe(checkEfectividad),
    safe(checkAsesoresCriticos),
    safe(checkMensajesSinEnviar),
    safe(checkErrorLog),
    safe(checkDeploymentLog),
    safe(checkIntegridadAsesores),
    safe(checkTriggersSinPrompt),
    safe(checkSenalesHuerfanas),
    safe(checkFlujoReportes),
    safe(checkReaccionesSilenciosas),
    safe(checkSailorMensajesViejos),
    safe(checkGeminiQuota),
    safe(checkCronVacio),
    safe(checkSenalesEstancadas),
    safe(checkFuncionesIA),
    safe(checkAccionesNoEntregadas),
    safe(checkCanarios),
    safe(checkGeminiUso),
  ])

  const todasAlertas = [
    ...stall, ...cron, ...efect, ...criticos, ...sinMensajes, ...errores, ...deploys,
    ...integridad, ...sinPrompt, ...huerfanas, ...reportes, ...reacciones,
    ...sailorViejos, ...geminiQuota, ...cronVacio, ...estancadas, ...iaFallos, ...accionesNoEntregadas,
    ...canarios, ...geminiUso,
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

  // Uso de Gemini del día (medidor proactivo)
  const hoy0 = new Date(); hoy0.setUTCHours(0, 0, 0, 0)
  const { data: usoHoy } = await sb
    .from('gemini_usage').select('ok, total_tokens').gte('created_at', hoy0.toISOString())
  const geminiLlamadasHoy = (usoHoy ?? []).length
  const geminiTokensHoy   = (usoHoy ?? []).reduce((s: number, r: any) => s + (r.total_tokens ?? 0), 0)

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
    gemini_llamadas_hoy:        geminiLlamadasHoy,
    gemini_tokens_hoy:          geminiTokensHoy,
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

  // Enviar email solo si hay alertas críticas o warnings (los 'info' no spamean a diario)
  if (criticas > 0 || warnings > 0) {
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
    try {
      await sb.from('error_log').insert({
        componente: 'proxis-cerebro',
        severidad:  'error',
        mensaje:    e?.message ?? String(e),
        detalles:   { stack: e?.stack ?? '', timestamp: new Date().toISOString() },
      })
    } catch (_) { /* best-effort */ }
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'Error interno' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
