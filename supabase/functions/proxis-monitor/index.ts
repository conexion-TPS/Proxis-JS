// proxis-monitor — Edge Function
// Cron: 0 8 * * 1,3  (lunes y miércoles, 8:00 AM UTC-3 → 11:00 UTC)
// Evalúa cada trigger activo × cada asesor y dispara mensajes cuando
// la condición se cumple y el cooldown ha expirado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL      = Deno.env.get('SUPABASE_URL')!
const SB_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY  = Deno.env.get('GEMINI_KEY')  ?? ''
const RESEND_KEY  = Deno.env.get('RESEND_KEY')  ?? ''

const sb = createClient(SB_URL, SB_KEY)

/* ── Helpers de fecha ───────────────────────────────────────── */

function getMesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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

function calcZProyectados(reportes: any[]): number {
  if (!reportes.length) return 0
  const total = reportes.reduce((s: number, r: any) =>
    s + (r.contactos || []).reduce((a: number, c: any) => a + (c.prospectos || 0), 0), 0)
  return Math.round((total / reportes.length) * 4)
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
  const next   = m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`

  const [metaRes, reportesRes, ingresoRes] = await Promise.all([
    sb.from('metas').select('*').eq('asesor', asesor),
    sb.from('reportes').select('*')
      .eq('asesor', asesor)
      .gte('semana_inicio', `${mes}-01`)
      .lt('semana_inicio', `${next}-01`)
      .order('semana_inicio', { ascending: false }),
    sb.from('ingresos').select('*').eq('asesor', asesor).eq('mes', mes)
  ])

  const meta     = metaRes.data?.[0]     || {}
  const reportes = reportesRes.data      || []
  const ultimas4 = reportes.slice(0, 4)

  for (const r of ultimas4) {
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
    z_proyectados:         calcZProyectados(ultimas4),
    persistencia_actual:   calcPersistencia(ultimas4, meta.meta_contactos_semana || 3)
  }
}

/* ── Evaluar condición del trigger ──────────────────────────── */

function evalTrigger(triggerId: string, ctx: any): boolean {
  switch (triggerId) {
    case 'semana-sin-reporte-alerta': return ctx.semanas_sin_reporte >= 1
    case 'bajo-meta-miercoles':       return esMiercoles() && ctx.pc_promedio < ctx.meta_contactos_semana
    case 'persistencia-umbral':       return ctx.persistencia_actual >= 2
    case 'meta-superada':             return ctx.z_proyectados >= ctx.meta_prospectos_mes
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
    .replace(/\{\{zPuntos\}\}/g,           String(ctx.z_proyectados  ?? ''))
    .replace(/\{\{meta\}\}/g,              String(ctx.meta_prospectos_mes   ?? ''))
    .replace(/\{\{metaContactos\}\}/g,     String(ctx.meta_contactos_semana ?? ''))
    .replace(/\{\{semanasSinReporte\}\}/g, String(ctx.semanas_sin_reporte   ?? ''))
    .replace(/\{\{pcPromedio\}\}/g,        String(ctx.pc_promedio    ?? ''))
    .replace(/\{\{ingresoMes\}\}/g,        String(ctx.ingreso_mes_actual     ?? ''))
    .replace(/\{\{nodosActivos\}\}/g,      String(ctx.nodos_activos  ?? ''))
    .replace(/\{\{persistencia\}\}/g,      String(ctx.persistencia_actual    ?? ''))
    .replace(/\{\{mes\}\}/g,              ctx.mes_actual            || '')
}

/* ── Gemini ─────────────────────────────────────────────────── */

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_KEY) return '[GEMINI_KEY no configurada — mensaje de prueba generado]'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
      })
    }
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

/* ── Email vía Resend ───────────────────────────────────────── */

async function sendEmail(asesor: string, asunto: string, cuerpo: string): Promise<void> {
  if (!RESEND_KEY) {
    console.log(`[DRY-RUN] Email a ${asesor}: ${cuerpo.slice(0, 100)}…`)
    return
  }
  const { data: emailArr } = await sb.from('asesor_emails').select('email').eq('asesor', asesor)
  if (!emailArr?.length) throw new Error(`Sin email registrado para ${asesor}`)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Proxis Coach <proxis@theprecisionselling.com>',
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

/* ── Subject por trigger ────────────────────────────────────── */

function subjectForTrigger(triggerId: string): string {
  const map: Record<string, string> = {
    'semana-sin-reporte-alerta': 'Tu actividad semanal necesita atención',
    'bajo-meta-miercoles':       'Chequeo de mitad de semana — tu coach Proxis',
    'persistencia-umbral':       'Hay algo que quiero conversar contigo',
    'meta-superada':             '¡Vas muy bien este mes!',
    'primer-lunes-mes':          'Arrancamos un nuevo mes — tu coach Proxis',
  }
  return map[triggerId] || 'Mensaje de tu coach Proxis'
}

/* ── Handler principal ──────────────────────────────────────── */

Deno.serve(async (_req: Request) => {
  const results: any[] = []

  // 1. Triggers activos
  const { data: triggers, error: tErr } = await sb.from('trigger_config')
    .select('*').eq('activo', true)
  if (tErr) return new Response(JSON.stringify({ ok: false, error: tErr.message }), { status: 500 })
  if (!triggers?.length)
    return new Response(JSON.stringify({ ok: true, msg: 'Sin triggers activos' }), { status: 200 })

  // 2. Todos los asesores
  const { data: metasArr } = await sb.from('metas').select('asesor')
  const asesores = (metasArr || []).map((m: any) => m.asesor as string)

  // 3. Trigger × asesor
  for (const trigger of triggers) {
    const tid = trigger.trigger_id
    const cooldown = trigger.cooldown_dias || 7
    for (const asesor of asesores) {
      const item: any = { asesor, trigger: tid }
      try {
        if (!(await cooldownOk(asesor, tid, cooldown))) {
          item.status = 'cooldown'; results.push(item); continue
        }

        const ctx = await buildContext(asesor)
        if (!evalTrigger(tid, ctx)) {
          item.status = 'skip'; results.push(item); continue
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

        const compilado = compileTemplate(prompts[0].body, ctx)
        const body      = await callGemini(compilado)

        await sb.from('message_log').insert({
          asesor,
          trigger_id:     trigger.id,
          body,
          prompt_version: prompts[0].version
        })

        await sendEmail(asesor, subjectForTrigger(tid), body)

        item.status = 'sent'
      } catch (e: any) {
        item.status = 'error'
        item.error  = e.message
      }
      results.push(item)
    }
  }

  console.log(JSON.stringify({ ok: true, total: results.length, results }))
  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
