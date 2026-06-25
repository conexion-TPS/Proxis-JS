// proxis-accion — Ejecuta REALMENTE la acción recomendada de una hipótesis.
// Antes, "Ejecutar acción" en /admin/hipotesis solo ponía accion_ejecutada=true
// sin enviar nada (cosmético). Esta función envía de verdad:
//   - 'trigger'            → mensaje de coaching al ASESOR (email + Sailor)
//   - 'escalar_supervisor' → aviso con contexto al SUPERVISOR (email)
// Y registra la entrega en message_log (para que sea auditable / verificable).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callAI } from '../_shared/ai-client.ts'
import { getAsesoresAutorizados, esAutorizado } from '../_shared/tenant.ts'
import { REGLAS_MENTOR, tonoBlock } from '../_shared/mentor.ts'

const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY = Deno.env.get('RESEND_KEY') ?? ''

const sb = createClient(SB_URL, SB_KEY)

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}

// REGLAS_MENTOR y tonoBlock viven en ../_shared/mentor.ts (fuente única, compartida
// con proxis-monitor). Incluyen la lista negra de muletillas/clichés (B4).

async function enviarEmail(to: string, subject: string, text: string, remitente: string): Promise<void> {
  if (!RESEND_KEY) { console.log(`[DRY] email a ${to}: ${subject}`); return }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${remitente} <proxis@theprecisionselling.com>`, to, subject, text }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as any
    throw new Error(`Resend: ${e.message || res.status}`)
  }
}

Deno.serve(async (req: Request) => {
  try {
    const { deduction_id, dry_run } = await req.json().catch(() => ({}))
    if (!deduction_id) return json({ error: 'deduction_id requerido' }, 400)
    // dry_run (canario A7): recorre TODO el camino real —resuelve destinatario y compone
    // el mensaje con la IA— pero NO envía email, NO inserta en Sailor/message_log y NO
    // marca la acción como ejecutada. Sirve para verificar que la función entrega de verdad
    // (caza una regresión al no-op cosmético) sin molestar a un usuario real.
    const dryRun = dry_run === true

    const { data: d } = await sb.from('deductions_log')
      .select('id, asesor, accion_tipo, accion_descripcion, hipotesis, dimension_afectada')
      .eq('id', deduction_id).maybeSingle()
    if (!d) return json({ error: 'hipótesis no encontrada' }, 404)

    const { data: cfgArr } = await sb.from('config').select('value').eq('key', 'remitente').limit(1)
    const remitente = cfgArr?.[0]?.value || 'Sailor Mentor (Proxis)'
    const now = new Date().toISOString()
    const asesor = d.asesor as string

    // Gate por institución (lista blanca, fail-closed). Antes de cualquier envío/insert.
    // El carve-out de canarios vive dentro de esAutorizado, así que __canary__ sigue pasando.
    const autz = await getAsesoresAutorizados(sb)
    if (!esAutorizado(asesor, autz)) {
      return json({ ok: false, skipped: 'institucion_no_autorizada', asesor }, 200)
    }

    // ── trigger → mensaje de coaching al asesor ──────────────────────────────
    if (d.accion_tipo === 'trigger') {
      // En dry_run no exigimos activo=true: el asesor sintético del canario es inactivo a propósito.
      let credQuery = sb.from('asesor_credentials').select('email').eq('asesor', asesor)
      if (!dryRun) credQuery = credQuery.eq('activo', true)
      const { data: cred } = await credQuery.maybeSingle()
      if (!cred?.email) return json({ error: `${asesor} sin email registrado` }, 400)

      const prompt = `${REGLAS_MENTOR}${tonoBlock()}
Escribe un mensaje breve (máximo 110 palabras) para ${asesor}, accionable y motivador, no un diagnóstico.
Basa el mensaje en esta acción que recomiendo: "${d.accion_descripcion ?? d.hipotesis}".
Contexto interno (NO lo cites textual ni reveles jerga/perfil): "${d.hipotesis}".
Este mensaje se entrega también por correo, que NO recibe respuestas: NO lo cierres con una pregunta ni invites a responder; cierra con una afirmación o un siguiente paso concreto.
Devuelve SOLO el texto del mensaje, sin encabezados ni firma.`
      const mensaje = (await callAI(prompt, { maxTokens: 1200, temperature: 0.6, componente: 'proxis-accion' })).trim() || (d.accion_descripcion ?? 'Sigo acompañándote esta semana; cuenta conmigo para lo que necesites.')

      if (dryRun)
        return json({ ok: true, dry_run: true, tipo: 'trigger', destinatario: asesor, canal: 'email + Sailor', mensaje })

      await sb.from('sailor_messages').insert({
        asesor, origen: 'coach_ia', tipo: 'mensaje', contenido: mensaje, leido: false,
      }).then(undefined, () => {})
      await enviarEmail(cred.email, 'Un mensaje de Sailor Mentor', mensaje, remitente)
      await sb.from('message_log').insert({
        asesor, trigger_id: 'hipotesis-accion', body: mensaje, prompt_version: 0,
      }).then(undefined, () => {})
      await sb.from('deductions_log').update({ accion_ejecutada: true, accion_ejecutada_at: now }).eq('id', d.id)

      return json({ ok: true, tipo: 'trigger', destinatario: asesor, canal: 'email + Sailor' })
    }

    // ── escalar_supervisor → aviso al supervisor ─────────────────────────────
    if (d.accion_tipo === 'escalar_supervisor') {
      const { data: cred } = await sb.from('asesor_credentials')
        .select('org_nodo_id').eq('asesor', asesor).maybeSingle()
      if (!cred?.org_nodo_id) return json({ error: `${asesor} sin nodo asignado — no se puede ubicar supervisor` }, 400)

      const { data: sup } = await sb.from('org_usuarios')
        .select('nombre, email')
        .eq('org_nodo_id', cred.org_nodo_id)
        .in('cargo', ['supervisor', 'gerente_zonal', 'gerente_regional', 'admin'])
        .eq('activo', true).limit(1).maybeSingle()
      if (!sup?.email) return json({ error: `Sin supervisor con email para el equipo de ${asesor}` }, 400)

      // Generamos la nota al supervisor con la IA + guardrails: NO volcamos la hipótesis
      // cruda (puede nombrar el perfil o usar jerga). Fallback genérico si la IA no responde.
      const promptSup = `${REGLAS_MENTOR}

Le escribes a ${sup.nombre?.split(' ')[0] ?? 'su líder'}, que lidera a ${asesor}, para pedirle que lo acompañe. Tono de colega que acompaña al líder, breve (máx 90 palabras).
Basa el mensaje en esta acción que recomiendo: "${d.accion_descripcion ?? d.hipotesis}".
Contexto interno (NO lo cites ni reveles jerga/perfil): "${d.hipotesis}".
Deja claro que es una lectura provisional, no un veredicto. Devuelve SOLO el texto, sin encabezado ni firma.`
      let nota = ''
      try { nota = (await callAI(promptSup, { maxTokens: 1200, temperature: 0.6, componente: 'proxis-accion' })).trim() } catch (_) { /* fallback abajo */ }
      if (!nota) nota = `Tengo una lectura sobre el trabajo de ${asesor} que creo te puede servir. ¿La acompañas esta semana? La dejo a tu criterio, es provisional.`

      const cuerpo = `Hola ${sup.nombre?.split(' ')[0] ?? ''},

${nota}

Lo puedes seguir desde tu Portal de Equipo.

— Sailor Mentor (confidencial, solo para ti)`
      await enviarEmail(sup.email, `Algo de ${asesor} que podría necesitar tu mano`, cuerpo, remitente)
      await sb.from('message_log').insert({
        asesor, trigger_id: 'hipotesis-escalar-supervisor',
        body: nota.slice(0, 500), prompt_version: 0,
      }).then(undefined, () => {})
      await sb.from('deductions_log').update({ accion_ejecutada: true, accion_ejecutada_at: now }).eq('id', d.id)

      return json({ ok: true, tipo: 'escalar_supervisor', destinatario: sup.nombre, canal: 'email' })
    }

    return json({ error: `accion_tipo '${d.accion_tipo}' no requiere envío (usar el flujo del panel)` }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    try { await sb.from('error_log').insert({ componente: 'proxis-accion', severidad: 'error', mensaje: msg }) } catch (_) { /**/ }
    return json({ ok: false, error: msg }, 500)
  }
})
