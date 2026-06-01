import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEliminacionCuenta } from '@/lib/resend'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const JWT_SECRET = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'

/* POST /api/privacy/delete-account
   Flujo de eliminación de cuenta + anonimización real (spec doc 7, Parte 2).
   - Autoservicio (Sailor): requiere JWT del asesor.
   - Admin: { asesor } en el body + header x-admin-key con la clave admin.
   La anonimización corre en una sola transacción SQL (RPC anonimizar_asesor). */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)
  const sb     = supabaseAdmin()

  // ── Resolver el asesor objetivo y autorizar ──────────────────────────────
  let asesor: string | null = null
  let canal: 'sailor' | 'admin' = 'sailor'

  const adminKey = req.headers.get('x-admin-key')
  const body = await req.json().catch(() => ({} as Record<string, unknown>))

  if (adminKey && adminKey === (process.env.ADMIN_PASSWORD ?? 'proxis-admin-2026')) {
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
    await sb.from('anonymization_audit_log').insert({
      event_hash: 'FAILED-' + Date.now(),
      action_type: 'ACCOUNT_DELETION_ANONYMIZATION',
      records_processed: 0,
      process_status: 'FAILED',
    })
    return NextResponse.json({ error: 'No se pudo completar la eliminación. Intenta nuevamente.' }, { status: 500, headers: cors })
  }

  const eventHash = result.event_hash as string

  // ── Cerrar la solicitud ───────────────────────────────────────────────────
  if (solicitud?.id) {
    await sb.from('derechos_solicitudes')
      .update({ estado: 'completado', respuesta: `Anonimización exitosa. Evento: ${eventHash}`, resuelto_at: new Date().toISOString() })
      .eq('id', solicitud.id)
  }

  // ── Email de confirmación (best-effort, no bloquea la respuesta) ──────────
  try {
    await sendEliminacionCuenta({ to: email, nombre, eventHash })
  } catch { /* el dato ya fue eliminado; el envío es informativo */ }

  return NextResponse.json({ ok: true, event_hash: eventHash }, { headers: cors })
}
