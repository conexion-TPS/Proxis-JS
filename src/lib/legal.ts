import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

/* Utilidades de cumplimiento legal (Ley 21.719) compartidas por los 17 ítems
   de automatización. Log centralizado inmutable + hashing + días hábiles chilenos. */

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function hashIp(req: Request): string | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip') ?? null
  return ip ? sha256(ip) : null
}

export type EventType =
  | 'TERMS_ACCEPTED' | 'TERMS_COPY_SENT'
  | 'CONSENT_GRANTED' | 'CONSENT_REVOKED'
  | 'ACCOUNT_DELETION_REQUESTED' | 'ANONYMIZATION_COMPLETED'
  | 'ANONYMIZATION_FAILED' | 'ANONYMIZATION_RETRIED'
  | 'ARCOP_REQUEST_RECEIVED' | 'ARCOP_REQUEST_RESOLVED'
  | 'ARCOP_REQUEST_OVERDUE' | 'ARCOP_EXTENSION_GRANTED'
  | 'SUBPROCESSOR_CHANGE_NOTIFIED' | 'CONTRACT_TERMINATED'
  | 'SUPPRESSION_CERTIFIED' | 'SECURITY_BREACH_REGISTERED'
  | 'BREACH_NOTIFIED_APDP' | 'SUPERVISOR_REACCEPTANCE'
  | 'TERMS_VERSION_PUBLISHED' | 'TERMS_CHANGE_NOTIFIED'
  | 'VERIFICATION_PASSED' | 'VERIFICATION_FAILED'
  | 'AUDIT_REPORT_GENERATED'

type LegalEvent = {
  event_type: EventType
  actor_type: 'USER' | 'ADMIN' | 'SYSTEM' | 'CRON'
  actor_id_hash?: string | null
  affected_entity?: string
  event_summary?: string
  legal_reference?: string
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  metadata?: Record<string, unknown>
}

/* Inserta un evento en legal_event_log calculando el chain_hash a partir del
   último registro (encadenamiento para integridad). Best-effort: nunca lanza
   (no debe romper el flujo de negocio que lo invoca). */
export async function logLegalEvent(e: LegalEvent): Promise<void> {
  try {
    const sb = supabaseAdmin()
    const { data: prev } = await sb
      .from('legal_event_log')
      .select('chain_hash')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ts = new Date().toISOString()
    const chain_hash = sha256(
      (prev?.chain_hash ?? 'GENESIS') + e.event_type + ts +
      (e.actor_id_hash ?? '') + (e.event_summary ?? '')
    )

    await sb.from('legal_event_log').insert({
      event_type: e.event_type,
      event_timestamp: ts,
      actor_type: e.actor_type,
      actor_id_hash: e.actor_id_hash ?? null,
      affected_entity: e.affected_entity ?? null,
      event_summary: e.event_summary ?? null,
      legal_reference: e.legal_reference ?? null,
      risk_level: e.risk_level ?? 'LOW',
      metadata: e.metadata ?? {},
      chain_hash,
    })
  } catch (err) {
    console.error('logLegalEvent failed', err)
  }
}

// ── Días hábiles chilenos (excluye sáb, dom y feriados de feriados_chile) ──────

export async function getChileanHolidays(): Promise<Set<string>> {
  const sb = supabaseAdmin()
  const { data } = await sb.from('feriados_chile').select('fecha')
  return new Set((data ?? []).map(f => f.fecha as string))
}

/* Días hábiles entre dos fechas ISO (yyyy-mm-dd). Negativo si to < from. */
export function businessDaysBetween(fromISO: string, toISO: string, holidays: Set<string>): number {
  let from = new Date(fromISO + 'T00:00:00Z')
  let to = new Date(toISO + 'T00:00:00Z')
  let sign = 1
  if (to < from) { const t = from; from = to; to = t; sign = -1 }
  let count = 0
  const d = new Date(from)
  while (d < to) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6 && !holidays.has(d.toISOString().slice(0, 10))) count++
  }
  return sign * count
}

/* Suma N días hábiles chilenos a una fecha y devuelve la fecha resultante (ISO). */
export function addChileanBusinessDays(startISO: string, n: number, holidays: Set<string>): string {
  const d = new Date(startISO + 'T00:00:00Z')
  let added = 0
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6 && !holidays.has(d.toISOString().slice(0, 10))) added++
  }
  return d.toISOString().slice(0, 10)
}
