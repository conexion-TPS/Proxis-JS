import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logLegalEvent, getChileanHolidays, businessDaysBetween } from '@/lib/legal'
import { sendLegalEmail } from '@/lib/resend'

/* Cron diario consolidado de cumplimiento legal (ítems 11-14, spec doc 7).
   Un solo cron (Hobby de Vercel limita la cantidad). Corre ~00:01 UTC.
   - 11: recalcula días hábiles restantes de cada solicitud ARCOP+ abierta.
   - 12: alerta de vencimiento próximo (≤8 hábiles; escala a admin si ≤3).
   - 13: solicitudes vencidas (≤0) → alerta crítica.
   - 14: recordatorio anual de aceptación a supervisores (bloqueo si excede). */

const ADMIN_EMAIL = process.env.PRIVACY_ADMIN_EMAIL ?? 'privacidad@theprecisionselling.com'
const DASHBOARD = 'https://proxis-dev-admin.vercel.app/admin/privacy'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // sin secreto configurado: permitido (igual que el resto del proyecto)
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const sb = supabaseAdmin()
  const holidays = await getChileanHolidays()
  const today = new Date().toISOString().slice(0, 10)
  const resumen = { arcop_actualizadas: 0, arcop_por_vencer: 0, arcop_vencidas: 0, supervisores_recordados: 0, supervisores_bloqueados: 0 }

  // ── Ítems 11-13: ARCOP+ ────────────────────────────────────────────────────
  const { data: solicitudes } = await sb.from('derechos_solicitudes')
    .select('id, derecho, email, responsable, fecha_limite, estado, days_remaining')
    .not('estado', 'in', '(completado,rechazado)')

  for (const s of solicitudes ?? []) {
    if (!s.fecha_limite) continue
    const restantes = businessDaysBetween(today, s.fecha_limite as string, holidays)
    if (restantes !== s.days_remaining) {
      await sb.from('derechos_solicitudes').update({ days_remaining: restantes }).eq('id', s.id)
      resumen.arcop_actualizadas++
    }

    if (restantes < 0) {
      // Ítem 13 — vencida
      resumen.arcop_vencidas++
      await logLegalEvent({
        event_type: 'ARCOP_REQUEST_OVERDUE', actor_type: 'CRON', affected_entity: 'ARCOP_REQUEST',
        event_summary: `Solicitud ARCOP+ VENCIDA sin resolución (${s.derecho ?? ''})`, legal_reference: 'Ley 21.719 ARCOP+', risk_level: 'CRITICAL',
        metadata: { id: s.id, dias_vencida: Math.abs(restantes) },
      })
      await sendLegalEmail({ to: ADMIN_EMAIL, subject: '🔴 Solicitud ARCOP+ VENCIDA', bodyHtml: `<p>La solicitud <code>${s.id}</code> (${s.derecho ?? ''}) está <strong>vencida</strong> hace ${Math.abs(restantes)} días hábiles. El vencimiento no exime de resolver. <a href="${DASHBOARD}">Abrir panel</a>.</p>` }).catch(() => {})
    } else if (restantes <= 8) {
      // Ítem 12 — por vencer
      resumen.arcop_por_vencer++
      await logLegalEvent({
        event_type: 'ARCOP_REQUEST_RECEIVED', actor_type: 'CRON', affected_entity: 'ARCOP_REQUEST',
        event_summary: `Solicitud ARCOP+ próxima a vencer (${restantes} días hábiles)`, legal_reference: 'Ley 21.719 ARCOP+', risk_level: 'HIGH',
        metadata: { id: s.id, dias_restantes: restantes },
      })
      const escala = restantes <= 3 ? ` Copia al admin principal (≤3 días).` : ''
      await sendLegalEmail({
        to: ADMIN_EMAIL, subject: `⏳ ARCOP+ por vencer — ${restantes} días hábiles`,
        bodyHtml: `<p>La solicitud <code>${s.id}</code> (${s.derecho ?? ''}) vence en <strong>${restantes} días hábiles</strong>.${escala}</p>
          <p>Responsable: ${s.responsable ?? '—'}. El incumplimiento del plazo es sancionable por la APDP (Ley N° 21.719). <a href="${DASHBOARD}">Resolver</a>.</p>`,
      }).catch(() => {})
    }
  }

  // ── Ítem 14: recordatorio anual a supervisores ─────────────────────────────
  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString()
  const blockThreshold = new Date(Date.now() - 380 * 86400_000).toISOString()
  const { data: sups } = await sb.from('org_usuarios')
    .select('id, email, nombre, cargo, ultima_aceptacion_at, acceso_bloqueado')
    .eq('cargo', 'supervisor')

  for (const u of sups ?? []) {
    const last = (u.ultima_aceptacion_at as string | null) ?? null
    const necesitaRecordar = !last || last < yearAgo
    if (!necesitaRecordar) continue

    if (last && last < blockThreshold && !u.acceso_bloqueado) {
      await sb.from('org_usuarios').update({ acceso_bloqueado: true }).eq('id', u.id)
      resumen.supervisores_bloqueados++
      await logLegalEvent({
        event_type: 'SUPERVISOR_REACCEPTANCE', actor_type: 'CRON', affected_entity: 'USER_ACCOUNT',
        event_summary: 'Acceso de supervisor bloqueado por no re-aceptar en plazo', legal_reference: 'Ley 21.719', risk_level: 'MEDIUM', metadata: { org_usuario_id: u.id },
      })
    }
    if (u.email) {
      await sendLegalEmail({
        to: u.email as string, subject: 'Recordatorio: re-aceptación anual de los Términos de Supervisor',
        bodyHtml: `<p>Hola ${String(u.nombre ?? '').split(' ')[0]},</p>
          <p>Como supervisor, debes re-aceptar los Términos de Uso al menos una vez al año. <a href="https://proxis-dev-admin.vercel.app/equipo">Ingresar y aceptar</a>.</p>
          <p>Si no aceptas dentro de 15 días hábiles, tu acceso al Portal de Equipo se suspenderá temporalmente.</p>`,
      }).catch(() => {})
      resumen.supervisores_recordados++
    }
  }

  return NextResponse.json({ ok: true, fecha: today, resumen })
}
