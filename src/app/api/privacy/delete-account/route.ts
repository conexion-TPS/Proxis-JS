import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEliminacionCuenta, sendLegalEmail } from '@/lib/resend'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { logLegalEvent, sha256 } from '@/lib/legal'
import { isAdminGoTrueSession } from '@/lib/adminAuth'

const ADMIN_ALERT_EMAIL = process.env.PRIVACY_ADMIN_EMAIL ?? 'privacidad@theprecisionselling.com'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const JWT_SECRET = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'

/* POST /api/privacy/delete-account
   Flujo de eliminación de cuenta + anonimización real (spec doc 7, Parte 2).
   - Autoservicio (Sailor): requiere JWT del asesor.
   - Admin: { asesor } en el body + Authorization Bearer de la sesión admin GoTrue (app_metadata.cargo=admin).
   La anonimización corre en una sola transacción SQL (RPC anonimizar_asesor). */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)
  const sb     = supabaseAdmin()

  // ── Resolver el asesor objetivo y autorizar ──────────────────────────────
  let asesor: string | null = null
  let canal: 'sailor' | 'admin' = 'sailor'

  // Canal admin: solo sesión GoTrue admin (Bearer). x-admin-key eliminado tras R4.
  const viaGoTrueAdmin = await isAdminGoTrueSession(req.headers.get('authorization'))
  const body = await req.json().catch(() => ({} as Record<string, unknown>))

  if (viaGoTrueAdmin) {
    asesor = typeof body.asesor === 'string' ? body.asesor : null
    canal  = 'admin'
    if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400, headers: cors })
  } else {
    const auth = req.headers.get('authorization') ?? ''
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })
    }
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { asesor: string }
      asesor = payload.asesor
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401, headers: cors })
    }
  }

  // ── Capturar identidad ANTES de borrar (para el email de confirmación) ────
  const { data: cred } = await sb
    .from('asesor_credentials')
    .select('asesor, email')
    .eq('asesor', asesor)
    .single()

  if (!cred) {
    return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404, headers: cors })
  }
  const email  = cred.email as string
  const nombre = cred.asesor as string
  const actorHash = sha256(nombre)

  // Ítem 3 (PASO 1) — registro del inicio de la solicitud de eliminación.
  await logLegalEvent({
    event_type: 'ACCOUNT_DELETION_REQUESTED', actor_type: canal === 'admin' ? 'ADMIN' : 'USER',
    actor_id_hash: actorHash, affected_entity: 'USER_ACCOUNT',
    event_summary: `Solicitud de eliminación de cuenta (${canal})`, legal_reference: 'Ley 21.719 art.2k', risk_level: 'MEDIUM',
    metadata: { canal },
  })

  // ── Registrar la solicitud (trazabilidad ARCOP+ — cancelación/supresión) ──
  const { data: solicitud } = await sb
    .from('derechos_solicitudes')
    .insert({
      tipo: 'eliminar', derecho: 'cancelacion', estado: 'procesando',
      asesor: nombre, email, nombre_completo: nombre, canal,
    })
    .select('id')
    .single()

  // ── Anonimización atómica ─────────────────────────────────────────────────
  const { data: result, error: rpcError } = await sb.rpc('anonimizar_asesor', { p_asesor: nombre })

  if (rpcError || !result?.success) {
    if (solicitud?.id) {
      await sb.from('derechos_solicitudes')
        .update({ estado: 'pendiente', respuesta: `Fallo de anonimización: ${rpcError?.message ?? 'desconocido'}` })
        .eq('id', solicitud.id)
    }
    // Registro de auditoría del fallo (sin datos personales)
    const failHash = sha256(nombre + Date.now() + 'ANONYMIZATION')
    await sb.from('anonymization_audit_log').insert({
      event_hash: failHash,
      action_type: 'ACCOUNT_DELETION_ANONYMIZATION',
      records_processed: 0,
      process_status: 'FAILED',
      reidentification_check: 'FAILED',
    })
    // Ítems 4/16 — logs de fallo y verificación.
    await logLegalEvent({
      event_type: 'ANONYMIZATION_FAILED', actor_type: 'SYSTEM', actor_id_hash: actorHash,
      affected_entity: 'USER_ACCOUNT', event_summary: 'Fallo en el proceso de anonimización; solicitud marcada PENDING_RETRY',
      legal_reference: 'Ley 21.719 art.2k', risk_level: 'HIGH', metadata: { event_hash: failHash, error: rpcError?.message ?? 'desconocido' },
    })
    await logLegalEvent({
      event_type: 'VERIFICATION_FAILED', actor_type: 'SYSTEM', actor_id_hash: actorHash,
      affected_entity: 'USER_ACCOUNT', event_summary: 'Verificación de no-reidentificación no superada', legal_reference: 'Ley 21.719 art.2k', risk_level: 'CRITICAL',
    })
    // Ítem 7 — alerta inmediata al administrador.
    try {
      await sendLegalEmail({
        to: ADMIN_ALERT_EMAIL,
        subject: '⚠️ Fallo de anonimización — requiere reintento',
        bodyHtml: `<p><strong>Un proceso de anonimización falló.</strong></p>
          <p>Evento: <code>${failHash}</code><br/>Error: ${rpcError?.message ?? 'desconocido'}</p>
          <p>La solicitud quedó marcada como <strong>PENDING_RETRY</strong>. Revisa el panel de Privacidad → Anonimizaciones para reintentar.</p>`,
      })
    } catch { /* no bloquea */ }
    return NextResponse.json({ error: 'No se pudo completar la eliminación. Intenta nuevamente.' }, { status: 500, headers: cors })
  }

  const eventHash = result.event_hash as string

  // ── Cerrar la solicitud ───────────────────────────────────────────────────
  if (solicitud?.id) {
    await sb.from('derechos_solicitudes')
      .update({ estado: 'completado', respuesta: `Anonimización exitosa. Evento: ${eventHash}`, resuelto_at: new Date().toISOString() })
      .eq('id', solicitud.id)
  }

  // Ítems 16 / 4 — verificación de no-reidentificación y cierre del proceso.
  await logLegalEvent({
    event_type: 'VERIFICATION_PASSED', actor_type: 'SYSTEM', actor_id_hash: actorHash,
    affected_entity: 'USER_ACCOUNT', event_summary: 'Verificación de no-reidentificación superada (cero residuo)',
    legal_reference: 'Ley 21.719 art.2k', risk_level: 'LOW', metadata: { event_hash: eventHash },
  })
  await logLegalEvent({
    event_type: 'ANONYMIZATION_COMPLETED', actor_type: 'SYSTEM', actor_id_hash: actorHash,
    affected_entity: 'USER_ACCOUNT', event_summary: 'Anonimización irreversible completada y datos de identidad suprimidos',
    legal_reference: 'Ley 21.719 art.2k', risk_level: 'MEDIUM',
    metadata: { event_hash: eventHash, canal, email_confirmacion: true },
  })

  // ── Email de confirmación (best-effort, no bloquea la respuesta) ──────────
  try {
    await sendEliminacionCuenta({ to: email, nombre, eventHash })
  } catch { /* el dato ya fue eliminado; el envío es informativo */ }

  return NextResponse.json({ ok: true, event_hash: eventHash }, { headers: cors })
}
