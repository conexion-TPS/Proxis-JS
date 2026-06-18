// proxis-monitor — Edge Function
// Cron: 0 8 * * 1,3  (lunes y miércoles, 8:00 AM UTC-3 → 11:00 UTC)
// Evalúa cada trigger activo × cada asesor y dispara mensajes cuando
// la condición se cumple y el cooldown ha expirado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { callAI } from '../_shared/ai-client.ts'
import { getAsesoresAutorizados, esAutorizado } from '../_shared/tenant.ts'

const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY = Deno.env.get('RESEND_KEY') ?? ''

const sb = createClient(SB_URL, SB_KEY)

/* ── Helpers de fecha ───────────────────────────────────────── */

function getMesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function esLunes():             boolean { return new Date().getDay() === 1 }
function esMiercoles():        boolean { return new Date().getDay() === 3 }
function esPrimerLunesMes():   boolean {
  const h = new Date(); return h.getDay() === 1 && h.getDate() <= 7
}

/* ── Cálculos (espejo de _core.js) ─────────────────────────── */

function calcSemanasSinReporte(reportes: any[]): number {
  if (!reportes.length) return 4 // Sin reportes = inactivo todo el mes
  const hoy = new Date()
  const dow = hoy.getDay()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1))
  const ultimo = new Date(reportes[0].semana_inicio)
  return Math.max(0, Math.floor((lunes.getTime() - ultimo.getTime()) / (7 * 86400_000)))
}

function calcPcPromedio(reportes: any[]): number {
  if (!reportes.length) return 0
  const vals = reportes.map((r: any) => {
    const cs = r.contactos || []
    const total = cs.length
    const z = cs.reduce((s: number, c: any) => s + (c.prospectos || 0), 0)
    return total > 0 ? z / total : 0
  })
  return +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2)
}

function calcProspectosMes(reportes: any[]): number {
  return reportes.reduce((s: number, r: any) =>
    s + (r.contactos || []).reduce((a: number, c: any) => a + (c.prospectos || 0), 0), 0)
}

function calcContactosSemanaActual(reportes: any[]): number {
  if (!reportes.length) return 0
  const hoy   = new Date()
  const dow   = hoy.getDay()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1))
  const lunesStr = lunes.toISOString().split('T')[0]
  const semana   = reportes.find((r: any) => r.semana_inicio === lunesStr)
  return (semana?.contactos || []).length
}

function calcPersistencia(reportes: any[], meta: number): number {
  let n = 0
  for (const r of reportes) {
    if ((r.contactos || []).length < (meta || 3)) n++; else break
  }
  return n
}

/* ── Build Context ──────────────────────────────────────────── */

async function buildContext(asesor: string) {
  const mes = getMesActual()
  const [y, m] = mes.split('-').map(Number)
  const next    = m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`
  const prevM   = m === 1 ? 12 : m - 1
  const prevY   = m === 1 ? y - 1 : y
  const mesPrev = `${prevY}-${String(prevM).padStart(2,'0')}`

  const [metaRes, reportesRes, ingresoRes, perfilRes, tpsRes, reportesPrevRes, ingresoPrevRes, hipRes, riesgoRes, ultimoMsgRes] = await Promise.all([
    sb.from('metas').select('*').eq('asesor', asesor),
    sb.from('reportes').select('*')
      .eq('asesor', asesor)
      .gte('semana_inicio', `${mes}-01`)
      .lt('semana_inicio', `${next}-01`)
      .order('semana_inicio', { ascending: false }),
    sb.from('ingresos').select('*').eq('asesor', asesor).eq('mes', mes),
    sb.from('asesor_perfil').select('resumen_ia').eq('asesor', asesor).limit(1),
    sb.from('tps_perfiles').select(
      'perfil_base,confianza_diagnostico,puntaje_a,puntaje_b,rasgos_comerciales,backup_style_activo,deseabilidad_social,coach_tono'
    ).eq('asesor', asesor).maybeSingle(),
    sb.from('reportes').select('*')
      .eq('asesor', asesor)
      .gte('semana_inicio', `${mesPrev}-01`)
      .lt('semana_inicio', `${mes}-01`)
      .order('semana_inicio', { ascending: false }),
    sb.from('ingresos').select('ingreso_real').eq('asesor', asesor).eq('mes', mesPrev).maybeSingle(),
    sb.from('deductions_log').select('confianza').eq('asesor', asesor).eq('estado', 'pendiente'),
    sb.from('asesor_perfil').select('nivel_riesgo, nivel_riesgo_nota').eq('asesor', asesor).maybeSingle(),
    sb.from('message_log').select('created_at').eq('asesor', asesor)
      .order('created_at', { ascending: false }).limit(1),
  ])

  const meta         = metaRes.data?.[0]     || {}
  const reportes     = reportesRes.data      || []
  const ultimas4     = reportes.slice(0, 4)
  const reportesPrev = reportesPrevRes.data  || []
  const ultimas4Prev = reportesPrev.slice(0, 4)

  for (const r of ultimas4) {
    const { data } = await sb.from('contactos').select('*')
      .eq('reporte_id', r.id).order('created_at', { ascending: true })
    r.contactos = data || []
  }

  for (const r of ultimas4Prev) {
    const { data } = await sb.from('contactos').select('*')
      .eq('reporte_id', r.id).order('created_at', { ascending: true })
    r.contactos = data || []
  }

  const nodosRes = await sb.from('activaciones_nodo').select('id')
    .eq('asesor', asesor)
    .gte('semana_inicio', `${mes}-01`)
    .lt('semana_inicio', `${next}-01`)

  return {
    nombre:                asesor,
    meta_contactos_semana: meta.meta_contactos_semana  || 3,
    meta_prospectos_mes:   meta.meta_prospectos_mes    || 15,
    meta_ingresos:         meta.meta_ingresos          || 2000000,
    perfil_conductual:     meta.perfil_conductual      || null,
    semanas_sin_reporte:   calcSemanasSinReporte(reportes),
    reportes_recientes:    ultimas4,
    nodos_activos:         nodosRes.data?.length        || 0,
    ingreso_mes_actual:    ingresoRes.data?.[0]?.ingreso_real || 0,
    mes_actual:            mes,
    pc_promedio:           calcPcPromedio(ultimas4),
    prospectos_mes:          calcProspectosMes(ultimas4),
    contactos_semana_actual: calcContactosSemanaActual(ultimas4),
    persistencia_actual:     calcPersistencia(ultimas4, meta.meta_contactos_semana || 3),
    meta_ventas_mes:         meta.meta_ventas_mes       || 0,
    meta_ingresos_mes:       meta.meta_ingresos         || 0,
    prospectos_mes_anterior: calcProspectosMes(ultimas4Prev),
    ingreso_mes_anterior:    ingresoPrevRes.data?.ingreso_real ?? 0,
    es_primer_mes:           reportesPrev.length === 0 && reportes.length === 0,
    hipotesis_pendientes:    (hipRes.data ?? []).length,
    hipotesis_alta_confianza:(hipRes.data ?? []).filter((h: any) => (h.confianza ?? 0) >= 80).length,
    nivel_riesgo:            riesgoRes.data?.nivel_riesgo      ?? null,
    nivel_riesgo_nota:       riesgoRes.data?.nivel_riesgo_nota ?? null,
    dias_sin_mensaje:        (() => {
      const last = ultimoMsgRes.data?.[0]?.created_at
      if (!last) return 999
      return Math.floor((Date.now() - new Date(last).getTime()) / 86400_000)
    })(),
    perfil_resumen:        perfilRes.data?.[0]?.resumen_ia || null,
    tps_perfil:            tpsRes.data ?? null,
    coach_tono:            tpsRes.data?.coach_tono ?? null,
  }
}

// Reglas OBLIGATORIAS de la voz Sailor Mentor (P5/P6). Se anteponen a TODA generación
// de coaching para que Gemini no se salga del personaje ni filtre lo interno.
const REGLAS_MENTOR = `[REGLAS DE SAILOR MENTOR — OBLIGATORIAS, NO LAS MENCIONES NI LAS CITES]
- Eres "Sailor Mentor", un mentor de ventas que acompaña por mensaje. Hablas en primera persona, cálido y cercano. Español latinoamericano neutro (sin voseo: usa "tú").
- NUNCA ofrezcas reuniones, llamadas, videollamadas ni "agendar un espacio/momento": acompañas por mensaje, no eres una persona que agenda. Si hace falta contacto humano, sugiere que su líder o supervisor lo acompañe.
- NUNCA nombres el perfil ni su clasificación: prohibido decir "Energético", "Sociable", "Relacional", "Reflexivo", "perfil", "estilo", o las letras E/S/R/A. Usa el perfil SOLO como guía interna de tu enfoque; habla de la persona por su conducta observable ("tú, que cierras rápido…", "tú, que cuidas el vínculo…").
- Nada de jerga técnica ni nombres de sistema ("motor IA", "cooldown", "hipótesis", "nivel de riesgo", "en_riesgo"). Habla humano.

`

function formatTpsPerfil(tps: any): string {
  if (!tps) return ''
  const NOMBRES: Record<string, string> = {
    E: 'Energético', S: 'Sociable', R: 'Relacional', A: 'Reflexivo', AMB: 'Ambivertido',
  }
  const FACTORES: Record<string, string> = {
    f1: 'Iniciativa Comercial', f2: 'Orientación al Cliente',
    f3: 'Disciplina de Proceso', f4: 'Estabilidad bajo Presión', f5: 'Apertura al Aprendizaje',
  }
  const nombre = NOMBRES[tps.perfil_base] ?? tps.perfil_base
  let out = `[PERFIL TPS — Evaluación Conductual v1.0]\n`
  out += `Perfil Base: ${nombre} (${tps.perfil_base}) | Confianza diagnóstico: ${tps.confianza_diagnostico}\n`
  out += `Eje Iniciativa (A): ${Number(tps.puntaje_a).toFixed(2)}/4.0 | Eje Calidez (B): ${Number(tps.puntaje_b).toFixed(2)}/4.0\n`
  if (tps.rasgos_comerciales && Object.keys(tps.rasgos_comerciales).length) {
    out += `Rasgos Comerciales:\n`
    for (const [k, v] of Object.entries(tps.rasgos_comerciales as Record<string, number>)) {
      const estrellas = v >= 20 ? '★★★' : v >= 15 ? '★★' : '★'
      out += `  · ${FACTORES[k] ?? k}: ${v}/25 ${estrellas}\n`
    }
  }
  if (tps.backup_style_activo) out += `⚠️ Señal Backup Style activa: tendencia a ceder bajo presión para evitar desaprobación.\n`
  if (tps.deseabilidad_social) out += `⚠️ Posible deseabilidad social detectada en Módulo C.\n`
  return out.trim()
}

/* ── Evaluar condición del trigger ──────────────────────────── */

function evalTrigger(triggerId: string, ctx: any): boolean {
  switch (triggerId) {
    case 'semana-sin-reporte-alerta': return esLunes() && ctx.semanas_sin_reporte >= 1
    case 'bajo-meta-miercoles':       return esMiercoles() && ctx.contactos_semana_actual < ctx.meta_contactos_semana * 0.5
    case 'paralisis-sostenida':        return ctx.persistencia_actual >= 3
    case 'hipotesis_acumuladas':       return ctx.hipotesis_pendientes >= 2 || ctx.hipotesis_alta_confianza >= 1
    case 'riesgo_elevado':             return ctx.nivel_riesgo === 'en_riesgo' || ctx.nivel_riesgo === 'critico'
    case 'sin_mensajes_recientes':     return ctx.dias_sin_mensaje >= 14
    case 'meta-superada':             return ctx.prospectos_mes >= ctx.meta_prospectos_mes
    case 'primer-lunes-mes':          return esPrimerLunesMes()
    default:                          return false
  }
}

/* ── Compile Template ───────────────────────────────────────── */

function compileTemplate(tpl: string, ctx: any): string {
  const perfil = ctx.perfil_conductual
    ? Object.entries(ctx.perfil_conductual as Record<string,number>).sort((a,b)=>b[1]-a[1])[0][0]
    : 'S'
  return tpl
    .replace(/\{\{nombre\}\}/g,            ctx.nombre                || '')
    .replace(/\{\{perfil\}\}/g,            perfil)
    .replace(/\{\{metaProspectos\}\}/g,        String(ctx.prospectos_mes          ?? ''))
    .replace(/\{\{meta\}\}/g,                 String(ctx.meta_prospectos_mes     ?? ''))
    .replace(/\{\{metaContactos\}\}/g,        String(ctx.meta_contactos_semana   ?? ''))
    .replace(/\{\{semanasSinReporte\}\}/g,    String(ctx.semanas_sin_reporte     ?? ''))
    .replace(/\{\{pcPromedio\}\}/g,           String(ctx.pc_promedio             ?? ''))
    .replace(/\{\{ingresoMes\}\}/g,           String(ctx.ingreso_mes_actual      ?? ''))
    .replace(/\{\{nodosActivos\}\}/g,         String(ctx.nodos_activos           ?? ''))
    .replace(/\{\{persistencia\}\}/g,         String(ctx.persistencia_actual     ?? ''))
    .replace(/\{\{metaVentas\}\}/g,           String(ctx.meta_ventas_mes         ?? ''))
    .replace(/\{\{metaIngresosMes\}\}/g,      String(ctx.meta_ingresos_mes       ?? ''))
    .replace(/\{\{prospectosMesAnterior\}\}/g,String(ctx.prospectos_mes_anterior ?? ''))
    .replace(/\{\{ingresosMesAnterior\}\}/g,  String(ctx.ingreso_mes_anterior    ?? ''))
    .replace(/\{\{esPrimerMes\}\}/g,          ctx.es_primer_mes ? 'sí' : 'no')
    .replace(/\{\{mes\}\}/g,                  ctx.mes_actual                     || '')
}

/* ── Email vía Resend ───────────────────────────────────────── */

async function sendEmail(asesor: string, asunto: string, cuerpo: string, remitente = 'Sailor Mentor (Proxis)'): Promise<void> {
  if (!RESEND_KEY) {
    console.log(`[DRY-RUN] Email a ${asesor}: ${cuerpo.slice(0, 100)}…`)
    return
  }
  const { data: credArr } = await sb.from('asesor_credentials').select('email').eq('asesor', asesor).eq('activo', true).limit(1)
  if (!credArr?.[0]?.email) throw new Error(`Sin email registrado para ${asesor}`)
  const emailArr = [{ email: credArr[0].email }]

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    `${remitente} <proxis@theprecisionselling.com>`,
      to:      emailArr[0].email,
      subject: asunto,
      text:    cuerpo
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(`Resend: ${err.message || res.status}`)
  }
}

/* ── Notificación supervisor — parálisis sostenida ──────────── */

async function notificarAdmin(asunto: string, cuerpo: string): Promise<void> {
  if (!RESEND_KEY) { console.log('[notificarAdmin DRY-RUN]', asunto); return }
  const { data: adminUsers } = await sb.from('org_usuarios')
    .select('email, nombre').eq('cargo', 'admin').eq('activo', true).limit(1)
  const adminEmail = adminUsers?.[0]?.email
  if (!adminEmail) { console.warn('[notificarAdmin] Sin usuario admin configurado'); return }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    `Sailor Mentor (Proxis) <proxis@theprecisionselling.com>`,
      to:      adminEmail,
      subject: asunto,
      text:    cuerpo,
    })
  })
}

async function notificarSupervisor(asesor: string, ctx: any, remitente: string, promptTid: string, asunto: string): Promise<void> {
  const { data: cred } = await sb.from('asesor_credentials')
    .select('org_nodo_id').eq('asesor', asesor).maybeSingle()
  if (!cred?.org_nodo_id) return

  const { data: sup } = await sb.from('org_usuarios')
    .select('nombre, email')
    .eq('org_nodo_id', cred.org_nodo_id)
    .in('cargo', ['supervisor', 'gerente_zonal', 'gerente_regional', 'admin'])
    .eq('activo', true)
    .limit(1)
    .maybeSingle()
  if (!sup?.email) return

  const { data: prompts } = await sb.from('prompts')
    .select('body').eq('trigger_id', promptTid).eq('activo', true).limit(1)
  if (!prompts?.length) return

  const compiled = compileTemplate(prompts[0].body, ctx)
  const tpsBlock = ctx.tps_perfil ? formatTpsPerfil(ctx.tps_perfil) + '\n\n' : ''
  const msg = await callAI(REGLAS_MENTOR + tpsBlock + compiled, {
    maxTokens:   2500,
    temperature: 0.7,
    componente:  'proxis-monitor',
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    `${remitente} <proxis@theprecisionselling.com>`,
      to:      sup.email,
      subject: asunto,
      text:    `Hola ${sup.nombre?.split(' ')[0] ?? sup.nombre},\n\n${msg}\n\n— Sailor Mentor\n(Confidencial, solo para ti como líder de tu equipo.)`
    })
  })
}

/* ── Email estático al supervisor (sin Gemini) ──────────────── */

async function emailSupervisorEstatico(asesor: string, remitente: string, asunto: string, cuerpo: string): Promise<void> {
  const { data: cred } = await sb.from('asesor_credentials')
    .select('org_nodo_id').eq('asesor', asesor).maybeSingle()
  if (!cred?.org_nodo_id) return
  const { data: sup } = await sb.from('org_usuarios')
    .select('nombre, email')
    .eq('org_nodo_id', cred.org_nodo_id)
    .in('cargo', ['supervisor', 'gerente_zonal', 'gerente_regional', 'admin'])
    .eq('activo', true).limit(1).maybeSingle()
  if (!sup?.email) return
  if (!RESEND_KEY) { console.log('[supEstatico DRY]', asunto); return }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${remitente} <proxis@theprecisionselling.com>`,
      to: sup.email, subject: asunto,
      text: `Hola ${sup.nombre},\n\n${cuerpo}`,
    }),
  })
}

/* ── Recordatorios de perfil TPS incompleto (24h asesor+supervisor / 48h supervisor) ── */

async function procesarPerfilesIncompletos(remitente: string, results: any[], dryRun = false): Promise<void> {
  const { data: cfg } = await sb.from('trigger_config')
    .select('trigger_id, activo, cooldown_dias')
    .in('trigger_id', ['perfil-incompleto-24h', 'perfil-incompleto-48h'])
  const cfgMap = new Map((cfg ?? []).map((c: any) => [c.trigger_id, c]))
  const activo24 = cfgMap.get('perfil-incompleto-24h')?.activo ?? true
  const activo48 = cfgMap.get('perfil-incompleto-48h')?.activo ?? true
  if (!activo24 && !activo48) return

  // Asesores que iniciaron el TPS pero no lo completaron (perfil_base aún null)
  const { data: incompletos } = await sb.from('tps_perfiles')
    .select('asesor, tps_progress, updated_at')
    .is('perfil_base', null)

  // Gate por institución (lista blanca, fail-closed): autz vacío ⇒ ningún asesor.
  const autz = await getAsesoresAutorizados(sb)

  for (const row of incompletos ?? []) {
    const asesor = row.asesor as string
    const horas  = (Date.now() - new Date(row.updated_at).getTime()) / 3600_000
    const prog   = row.tps_progress ?? 0
    const item: any = { asesor, trigger: 'perfil-incompleto' }
    if (!esAutorizado(asesor, autz)) { item.status = 'inst_no_autorizada'; results.push(item); continue }
    try {
      if (horas >= 48 && activo48) {
        const cd = cfgMap.get('perfil-incompleto-48h')?.cooldown_dias || 7
        if (!(await cooldownOk(asesor, 'perfil-incompleto-48h', cd))) { item.status = 'cooldown48'; results.push(item); continue }
        if (dryRun) { item.status = 'dry_run_48h'; item.prog = prog; results.push(item); continue }
        await emailSupervisorEstatico(asesor, remitente,
          `${asesor} dejó su evaluación a medias — ¿le das un empujón?`,
          `${asesor} empezó su evaluación pero la dejó a medias (${prog}%) y no la retomó en 48h. A veces una palabra tuya destraba más que la mía. ¿Le das un empujoncito?\n\n— Sailor Mentor (confidencial, solo para ti)`
        ).then(undefined, (e: any) => console.warn('[incompleto-48h]', e?.message))
        await sb.from('message_log').insert({
          asesor, trigger_id: 'perfil-incompleto-48h',
          body: `Perfil TPS incompleto (${prog}%, ${Math.round(horas)}h sin actividad) — alerta supervisor`,
          prompt_version: 0,
        }).then(undefined, () => {})
        item.status = 'supervisor_48h'; results.push(item); continue
      }
      if (horas >= 24 && activo24) {
        const cd = cfgMap.get('perfil-incompleto-24h')?.cooldown_dias || 1
        if (!(await cooldownOk(asesor, 'perfil-incompleto-24h', cd))) { item.status = 'cooldown24'; results.push(item); continue }
        if (dryRun) { item.status = 'dry_run_24h'; item.prog = prog; results.push(item); continue }
        const nombre = asesor.split(' ')[0]
        const cuerpo = `Hola ${nombre}, vi que empezaste tu evaluación y quedó a medias (${prog}% avanzado). Tu progreso está guardado: puedes retomarla justo donde la dejaste —te toma pocos minutos— desde la app Sailor.\n\nConocerte mejor me ayuda a acompañarte a tu medida. ¡Aquí te espero!\n\n— Sailor Mentor`
        await sb.from('sailor_messages').insert({
          asesor, origen: 'coach_ia', tipo: 'mensaje', contenido: cuerpo, leido: false,
        }).then(undefined, () => {})
        await sendEmail(asesor, 'Te quedó pendiente tu evaluación', cuerpo, remitente)
          .then(undefined, (e: any) => console.warn('[incompleto-24h email]', e?.message))
        await emailSupervisorEstatico(asesor, remitente,
          `${asesor} tiene su evaluación pendiente`,
          `${asesor} empezó su evaluación pero aún no la termina (${prog}%, sin moverla hace ~${Math.round(horas)}h). Un recordatorio tuyo puede ayudar.\n\n— Sailor Mentor (confidencial, solo para ti)`
        ).then(undefined, (e: any) => console.warn('[incompleto-24h sup]', e?.message))
        await sb.from('message_log').insert({
          asesor, trigger_id: 'perfil-incompleto-24h',
          body: `Recordatorio TPS (${prog}%) a asesor + copia supervisor`,
          prompt_version: 0,
        }).then(undefined, () => {})
        item.status = 'recordatorio_24h'; results.push(item); continue
      }
      item.status = 'skip'; results.push(item)
    } catch (e: any) {
      item.status = 'error'; item.error = e?.message; results.push(item)
    }
  }
}

/* ── Recordatorio al supervisor: mensajes del coach sin valorar ── */
// Nudge para que el supervisor valore de forma consistente. Apunta a la línea
// DIRECTA (cargo='supervisor') para no emailear a toda la cadena por los mismos
// mensajes; las gerencias lo ven en el informe semanal (proxis-informes).
async function procesarSupervisoresSinValorar(remitente: string, results: any[], dryRun = false): Promise<void> {
  const UMBRAL = 3
  const { data: cfg } = await sb.from('trigger_config')
    .select('activo, cooldown_dias').eq('trigger_id', 'supervisor-sin-valorar').maybeSingle()
  if (cfg && (cfg as any).activo === false) return
  const cooldownDias = (cfg as any)?.cooldown_dias || 4
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString()

  const { data: sups } = await sb.from('org_usuarios')
    .select('nombre, email, org_nodo_id').eq('cargo', 'supervisor').eq('activo', true)

  // Gate por institución (lista blanca, fail-closed): autz vacío ⇒ ningún supervisor.
  const autz = await getAsesoresAutorizados(sb)

  for (const sup of sups ?? []) {
    const item: any = { supervisor: sup.nombre, trigger: 'supervisor-sin-valorar' }
    if (!esAutorizado(sup.nombre, autz)) { item.status = 'inst_no_autorizada'; results.push(item); continue }
    try {
      if (!sup.email || !sup.org_nodo_id) { item.status = 'sin_email_o_nodo'; results.push(item); continue }

      const { data: subtree } = await sb.rpc('org_subtree', { nodo_raiz: sup.org_nodo_id })
      const nodoIds = (subtree ?? []).map((r: { id: string }) => r.id)
      if (!nodoIds.length) { item.status = 'sin_nodos'; results.push(item); continue }

      const { data: creds } = await sb.from('asesor_credentials')
        .select('asesor').eq('activo', true).in('org_nodo_id', nodoIds)
      const asesores = (creds ?? []).map((c: any) => c.asesor as string)
      if (!asesores.length) { item.status = 'sin_asesores'; results.push(item); continue }

      const { data: msgs } = await sb.from('message_log')
        .select('id').in('asesor', asesores).gte('created_at', since30d)
      const ids = (msgs ?? []).map((m: any) => m.id as string)
      if (!ids.length) { item.status = 'sin_mensajes'; results.push(item); continue }

      const { data: fb } = await sb.from('feedback').select('message_id').in('message_id', ids)
      const valorados = new Set((fb ?? []).map((f: any) => f.message_id))
      const pendientes = ids.filter(id => !valorados.has(id)).length
      item.pendientes = pendientes
      if (pendientes < UMBRAL) { item.status = 'bajo_umbral'; results.push(item); continue }

      if (!(await cooldownOk(sup.nombre, 'supervisor-sin-valorar', cooldownDias))) { item.status = 'cooldown'; results.push(item); continue }

      const nombre = sup.nombre.split(' ')[0]
      const cuerpo = `Hola ${nombre},\n\nTienes ${pendientes} mensaje(s) míos a tu equipo sin valorar. Marcar "oportuno / no era el momento" me toma segundos de aprender y me dice cuándo acerté con tu gente —así afino para la próxima.\n\nEntra a tu Portal de Equipo y mira los asesores marcados "sin valorar".\n\n— Sailor Mentor`

      if (dryRun || !RESEND_KEY) {
        console.log(`[sup-sin-valorar ${dryRun ? 'DRY' : 'NO-KEY'}] ${sup.nombre}: ${pendientes} pendientes`)
        item.status = dryRun ? 'dry_run' : 'sin_resend_key'; results.push(item); continue
      }

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    `${remitente} <proxis@theprecisionselling.com>`,
          to:      sup.email,
          subject: `Tienes ${pendientes} mensaje(s) míos sin valorar`,
          text:    cuerpo,
        }),
      })
      await sb.from('message_log').insert({
        asesor: sup.nombre, trigger_id: 'supervisor-sin-valorar',
        body: `Recordatorio: ${pendientes} mensajes del coach sin valorar`, prompt_version: 0,
      }).then(undefined, () => {})
      item.status = 'recordado'; results.push(item)
    } catch (e: any) {
      item.status = 'error'; item.error = e?.message; results.push(item)
    }
  }
}

/* ── Captura inmanente vía email ────────────────────────────── */

const PROB_CAPTURA_EMAIL = 0.25  // 25% de los mensajes llevan pregunta

async function decidirCapturaEmail(asesor: string): Promise<{
  capturar: boolean; pregunta?: string; preguntaTexto?: string; preguntaId?: string; dimension?: string
}> {
  if (Math.random() > PROB_CAPTURA_EMAIL) return { capturar: false }

  // Verificar que no se envió pregunta recientemente (cooldown 14 días)
  const since14 = new Date(Date.now() - 14 * 86400_000).toISOString()
  const { data: recent } = await sb
    .from('behavioral_signals')
    .select('id')
    .eq('asesor', asesor)
    .eq('fuente', 'email')
    .gte('created_at', since14)
    .limit(1)
  if (recent?.length) return { capturar: false }

  // Encontrar dimensión con menos señales
  const { data: senales } = await sb
    .from('behavioral_signals')
    .select('dimension_target')
    .eq('asesor', asesor)
    .limit(200)

  const conteo: Record<string, number> = {}
  for (const s of senales ?? []) {
    const d = s.dimension_target || 'otro'
    conteo[d] = (conteo[d] || 0) + 1
  }
  const DIMS = ['identidad_vendedora','relacion_prospeccion','modelos_mentales',
                'relacion_feedback','perfil_conductual_notas','contexto_situacional',
                'equilibrio_adaptativo','resiliencia']
  const sorted = DIMS.sort((a, b) => (conteo[a] || 0) - (conteo[b] || 0))
  const targetDim = sorted[0]

  // Buscar pregunta activa para esa dimensión
  const { data: cuesList } = await sb
    .from('cuestionarios')
    .select('id')
    .eq('activo', true)
    .limit(5)

  if (!cuesList?.length) return { capturar: false }

  const cueIds = cuesList.map((c: any) => c.id)
  const { data: pregs } = await sb
    .from('preguntas')
    .select('id, texto, tipo_respuesta, opciones')
    .in('cuestionario_id', cueIds)
    .eq('dimension_target', targetDim)
    .limit(5)

  if (!pregs?.length) return { capturar: false }

  const preg = pregs[Math.floor(Math.random() * pregs.length)]

  // Formatear la pregunta para email
  let pregTexto = `\n\n---\n💬 Pregunta rápida del coach:\n\n${preg.texto}\n`
  if (preg.tipo_respuesta === 'escala_4') {
    const labels = preg.opciones?.labels ?? ['Muy en desacuerdo','En desacuerdo','De acuerdo','Muy de acuerdo']
    pregTexto += labels.map((l: string, i: number) => `  ${i+1}. ${l}`).join('\n')
    pregTexto += '\n\nResponde simplemente con el número (1-4) respondiendo a este email.'
  } else if (preg.tipo_respuesta === 'si_no') {
    pregTexto += '\nResponde Sí o No respondiendo a este email.'
  } else if (preg.tipo_respuesta === 'alternativas' && preg.opciones?.items) {
    pregTexto += preg.opciones.items.map((item: any, i: number) =>
      `  ${i+1}. ${item.label ?? item}`
    ).join('\n')
    pregTexto += '\n\nResponde con el número de tu opción.'
  } else {
    pregTexto += '\nResponde con tus palabras respondiendo a este email.'
  }
  pregTexto += '\n\n(Esta es una pregunta opcional — puedes ignorarla si lo prefieres.)'

  return { capturar: true, pregunta: pregTexto, preguntaTexto: preg.texto, preguntaId: preg.id, dimension: targetDim }
}

/* ── Cooldown ───────────────────────────────────────────────── */

async function cooldownOk(asesor: string, triggerId: string, days: number): Promise<boolean> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const { data } = await sb.from('message_log')
    .select('id')
    .eq('asesor', asesor)
    .eq('trigger_id', triggerId)
    .gte('created_at', since)
    .limit(1)
  return !data?.length
}

/* ── Handler principal ──────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  try {
  const reqBody = await req.json().catch(() => ({})) as { only_reminders?: boolean; dry_run?: boolean }
  const onlyReminders = reqBody?.only_reminders === true
  const dryRun = reqBody?.dry_run === true
  const results: any[] = []

  // Remitente configurable
  const { data: configArr } = await sb.from('config').select('value').eq('key', 'remitente').limit(1)
  const remitente = configArr?.[0]?.value || 'Sailor Mentor (Proxis)'

  // Pasada principal de triggers (se omite en modo only_reminders → cron diario de recordatorios)
  if (!onlyReminders) {
  // 1. Triggers activos
  const { data: triggers } = await sb.from('trigger_config')
    .select('*').eq('activo', true)

  // 2. Todos los asesores (excluyendo el namespace de canarios __*)
  //    Gate por institución (lista blanca, fail-closed): autz vacío ⇒ ningún asesor.
  const autz = await getAsesoresAutorizados(sb)
  const { data: metasArr } = await sb.from('metas').select('asesor')
  const asesores = (metasArr || []).map((m: any) => m.asesor as string).filter(a => !a.startsWith('__') && autz.has(a))

  // 3. Trigger × asesor
  for (const trigger of (triggers ?? [])) {
    const tid = trigger.trigger_id
    const cooldown = trigger.cooldown_dias || 7
    for (const asesor of asesores) {
      const item: any = { asesor, trigger: tid }
      try {
        // Saturación: si hay ≥3 reacciones negativas en últimas 2 semanas → pausa y señal
        const since14 = new Date(Date.now() - 14 * 86400_000).toISOString()
        const { count: negCount } = await sb
          .from('behavioral_signals')
          .select('*', { count: 'exact', head: true })
          .eq('asesor', asesor)
          .eq('tipo', 'reaccion_negativa')
          .gte('created_at', since14)
        if ((negCount ?? 0) >= 3) {
          // Emitir señal de burnout (dedup: solo 1 por semana)
          const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
          const { data: burnoutRecent } = await sb
            .from('behavioral_signals')
            .select('id')
            .eq('asesor', asesor)
            .eq('tipo', 'riesgo_burnout_mensajes')
            .gte('created_at', since7)
            .limit(1)
          if (!burnoutRecent?.length) {
            await sb.from('behavioral_signals').insert({
              asesor, fuente: 'monitor', tipo: 'riesgo_burnout_mensajes',
              valor: String(negCount), dimension_target: 'relacion_feedback',
              confianza_hint: 85, procesada: false,
            })
          }
          item.status = 'saturacion'; results.push(item); continue
        }

        if (!(await cooldownOk(asesor, tid, cooldown))) {
          item.status = 'cooldown'; results.push(item); continue
        }

        const ctx = await buildContext(asesor)
        if (!evalTrigger(tid, ctx)) {
          item.status = 'skip'; results.push(item); continue
        }

        // Trigger interno — notifica al admin, NO al asesor
        if (tid === 'hipotesis_acumuladas') {
          const altaConf = ctx.hipotesis_alta_confianza >= 1
          const cuantas  = altaConf ? ctx.hipotesis_alta_confianza : ctx.hipotesis_pendientes
          const motivo = altaConf
            ? `Tengo ${cuantas} lectura(s) sobre ${asesor} que veo con bastante claridad y me gustaría que revisaras.`
            : `Tengo ${cuantas} lectura(s) sobre ${asesor} esperando tu mirada.`
          await notificarAdmin(
            `Tengo lecturas de ${asesor} para tu revisión`,
            `${motivo}\n\nLas dejé acá:\nhttps://proxis-dev-admin.vercel.app/admin/hipotesis\n\n— Sailor Mentor`
          ).catch(e => console.warn('[hipotesis_acumuladas]', e.message))
          await sb.from('message_log').insert({
            asesor, trigger_id: tid, body: motivo, prompt_version: 0
          }).then(undefined, () => {})
          item.status = 'admin_notified'; results.push(item); continue
        }

        // Trigger de riesgo — solo notifica al supervisor, NO al asesor
        if (tid === 'riesgo_elevado') {
          const esCritico   = ctx.nivel_riesgo === 'critico'
          const promptTid   = esCritico ? 'riesgo-critico-supervisor' : 'riesgo-elevado-supervisor'
          const asuntoSup   = esCritico
            ? `⚠️ URGENTE — ${asesor} requiere intervención inmediata`
            : `Atención requerida — ${asesor} está en riesgo`
          await notificarSupervisor(asesor, ctx, remitente, promptTid, asuntoSup)
            .catch(e => console.warn('[riesgo_elevado]', e.message))
          await sb.from('message_log').insert({
            asesor, trigger_id: tid,
            body: `Nivel de riesgo: ${ctx.nivel_riesgo}. Nota: ${ctx.nivel_riesgo_nota ?? 'sin nota'}`,
            prompt_version: 0
          }).then(undefined, () => {})
          item.status = 'supervisor_notified'; results.push(item); continue
        }

        // Trigger de diagnóstico del sistema — solo alerta al admin
        if (tid === 'sin_mensajes_recientes') {
          const dias = ctx.dias_sin_mensaje
          const cuerpo = `Quería avisarte: hace ${dias} días que no encuentro un buen motivo para escribirle a ${asesor}.\n\nPuede ser que todos sus temas estén en pausa, que me falten datos suyos, o que algo de mi lado dejó de correr. También vale revisar si estuvo de vacaciones o con permiso antes de hacer algo.\n\n¿Lo miramos?\nhttps://proxis-dev-admin.vercel.app/admin/dashboard\n\n— Sailor Mentor`
          await notificarAdmin(
            `Hace ${dias} días que no le escribo a ${asesor}`,
            cuerpo
          ).catch(e => console.warn('[sin_mensajes_recientes]', e.message))
          await sb.from('message_log').insert({
            asesor, trigger_id: tid,
            body: `Diagnóstico: ${dias} días sin mensajes enviados al asesor.`,
            prompt_version: 0
          }).then(undefined, () => {})
          item.status = 'admin_notified'; results.push(item); continue
        }

        const { data: prompts } = await sb.from('prompts')
          .select('*')
          .eq('trigger_id', tid)
          .eq('activo', true)
          .order('version', { ascending: false })
          .limit(1)

        if (!prompts?.length) {
          item.status = 'no_prompt'; results.push(item); continue
        }

        const compilado    = compileTemplate(prompts[0].body, ctx)
        const tpsBlock     = ctx.tps_perfil ? formatTpsPerfil(ctx.tps_perfil) + '\n\n' : ''
        const perfilBlock  = ctx.perfil_resumen
          ? `[PERFIL DEL ASESOR]\n${ctx.perfil_resumen}\n\n`
          : ''
        const TONOS: Record<string, string> = {
          cercano: '[TONO SOLICITADO] Cálido, cercano y empático. Habla de tú con calidez personal. Prioriza la conexión emocional antes del mensaje comercial.\n\n',
          directo: '[TONO SOLICITADO] Directo, claro y orientado a resultados. Sé conciso. Sin rodeos ni excesivos saludos.\n\n',
          formal:  '[TONO SOLICITADO] Profesional y respetuoso. Mantén una distancia apropiada y usa lenguaje formal.\n\n',
        }
        const tonoBlock = ctx.coach_tono ? (TONOS[ctx.coach_tono] ?? '') : ''
        const body         = await callAI(REGLAS_MENTOR + tonoBlock + tpsBlock + perfilBlock + compilado, {
          maxTokens:   2500,
          temperature: 0.7,
          componente:  'proxis-monitor',
        })

        // Captura inmanente: posiblemente adjuntar pregunta al email
        const captura = await decidirCapturaEmail(asesor)
        const bodyFinal = captura.capturar && captura.pregunta
          ? body + captura.pregunta
          : body

        await sb.from('message_log').insert({
          asesor,
          trigger_id:     tid,
          body:           bodyFinal,
          prompt_version: prompts[0].version
        })

        // Registrar envío en trigger_efectividad (período ISO semana)
        const hoy      = new Date()
        const thursday = new Date(hoy); thursday.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) + 3)
        const firstThu = new Date(thursday.getFullYear(), 0, 4)
        const wk       = String(1 + Math.round(((thursday.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7)).padStart(2, '0')
        const periodo  = `${thursday.getFullYear()}-W${wk}`
        await sb.from('trigger_efectividad').upsert(
          { trigger_id: tid, periodo, mensajes_enviados: 1, reacciones_positivas: 0, reacciones_negativas: 0 },
          { onConflict: 'trigger_id,periodo' }
        ).then(undefined, () => {})
        // Incremento atómico del contador de enviados
        await sb.rpc('incrementar_mensajes_enviados' as never, { p_trigger_id: tid, p_periodo: periodo } as never).then(undefined, () => {})

        // Insertar en sailor_messages para el feed de la app
        await sb.from('sailor_messages').insert({
          asesor,
          origen:    'coach_ia',
          tipo:      'mensaje',
          contenido: body,
          leido:     false,
        })

        // Si hay captura, también insertar la pregunta como mensaje separado en Sailor
        if (captura.capturar && captura.preguntaTexto) {
          await sb.from('sailor_messages').insert({
            asesor,
            origen:    'coach_ia',
            tipo:      'pregunta',
            contenido: captura.preguntaTexto,
            leido:     false,
          })
        }

        // Registrar señal pendiente de respuesta si se envió pregunta
        if (captura.capturar && captura.preguntaId) {
          await sb.from('behavioral_signals').insert({
            asesor,
            fuente:           'email',
            tipo:             'pregunta_enviada',
            valor:            captura.preguntaId,
            dimension_target: captura.dimension ?? null,
            procesada:        false,
          })
        }

        const asunto = trigger.asunto || 'Mensaje de tu coach Proxis'
        await sendEmail(asesor, asunto, bodyFinal, remitente)

        // Notificación al supervisor para triggers con doble disparo
        if (tid === 'paralisis-sostenida') {
          await notificarSupervisor(asesor, ctx, remitente, 'paralisis-supervisor',
            `Alerta coaching — ${asesor} necesita atención`
          ).catch(e => console.warn('[paralisis-supervisor]', e.message))
        }
        if (tid === 'meta-superada') {
          await notificarSupervisor(asesor, ctx, remitente, 'meta-superada-supervisor',
            `Logro destacado en tu equipo — ${asesor} superó su meta`
          ).catch(e => console.warn('[meta-superada-supervisor]', e.message))
        }

        item.status = 'sent'
      } catch (e: any) {
        item.status = 'error'
        item.error  = e.message
      }
      results.push(item)
    }
  }
  } // fin pasada principal de triggers (!onlyReminders)

  // Recordatorios de perfil TPS incompleto (corre SIEMPRE — pensado para cron diario)
  await procesarPerfilesIncompletos(remitente, results, dryRun)

  // Recordatorio al supervisor: mensajes del coach sin valorar (cron diario)
  await procesarSupervisoresSinValorar(remitente, results, dryRun)

  console.log(JSON.stringify({ ok: true, total: results.length, results }))
  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' }
  })
  } catch (e: any) {
    console.error('[proxis-monitor] FATAL:', e)
    await sb.from('error_log').insert({
      componente: 'proxis-monitor',
      severidad:  'error',
      mensaje:    e?.message ?? String(e),
      detalles:   { stack: e?.stack ?? '', timestamp: new Date().toISOString() },
    }).then(undefined, () => {})
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'Error interno' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
