import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logLegalEvent, sha256 } from '@/lib/legal'

/* Módulo A — Centro de derechos ARCOP+ (Ley 21.719). Plazo legal: 30 días hábiles.
   La fecha límite se calcula con la función SQL calcular_dias_habiles (excluye
   sábados, domingos y feriados chilenos). Los días hábiles restantes se computan
   aquí contra la tabla feriados_chile. */

const PLAZO_DIAS = 30

function bizDaysBetween(fromISO: string, toISO: string, holidays: Set<string>): number {
  let from = new Date(fromISO + 'T00:00:00Z')
  let to   = new Date(toISO + 'T00:00:00Z')
  let sign = 1
  if (to < from) { const t = from; from = to; to = t; sign = -1 }
  let count = 0
  const d = new Date(from)
  while (d < to) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    const key = d.toISOString().slice(0, 10)
    if (dow !== 0 && dow !== 6 && !holidays.has(key)) count++
  }
  return sign * count
}

const DERECHO_TO_TIPO: Record<string, string> = {
  acceso: 'exportar', portabilidad: 'exportar', cancelacion: 'eliminar',
  rectificacion: 'rectificar', oposicion: 'revocar_secundario',
  bloqueo: 'revocar_secundario', revision_humana: 'revocar_secundario',
}

export async function GET() {
  const sb = supabaseAdmin()
  const [{ data: rows }, { data: fer }] = await Promise.all([
    sb.from('derechos_solicitudes').select('*').order('created_at', { ascending: false }),
    sb.from('feriados_chile').select('fecha'),
  ])
  const holidays = new Set((fer ?? []).map(f => f.fecha as string))
  const today = new Date().toISOString().slice(0, 10)

  const solicitudes = (rows ?? []).map(r => {
    const cerrada = ['completado', 'rechazado'].includes(r.estado)
    const restantes = r.fecha_limite ? bizDaysBetween(today, r.fecha_limite as string, holidays) : null
    return {
      ...r,
      dias_habiles_restantes: cerrada ? null : restantes,
      semaforo: cerrada ? 'cerrada'
        : restantes === null ? 'gris'
        : restantes < 8 ? 'rojo'
        : restantes <= 15 ? 'amarillo' : 'verde',
    }
  })

  const abiertas = solicitudes.filter(s => !['completado', 'rechazado'].includes(s.estado))
  const kpis = {
    total: solicitudes.length,
    abiertas: abiertas.length,
    por_vencer: abiertas.filter(s => s.dias_habiles_restantes !== null && (s.dias_habiles_restantes as number) < 8).length,
    vencidas: abiertas.filter(s => s.dias_habiles_restantes !== null && (s.dias_habiles_restantes as number) < 0).length,
  }
  return NextResponse.json({ solicitudes, kpis, plazo_dias: PLAZO_DIAS })
}

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin()
  const b = await req.json()
  if (!b.derecho || !b.email || !b.nombre_completo)
    return NextResponse.json({ error: 'derecho, email y nombre_completo son requeridos' }, { status: 400 })

  const { data: fl } = await sb.rpc('calcular_dias_habiles', {
    p_inicio: new Date().toISOString().slice(0, 10), p_dias: PLAZO_DIAS,
  })

  const { data, error } = await sb.from('derechos_solicitudes').insert({
    tipo: DERECHO_TO_TIPO[b.derecho] ?? 'exportar',
    derecho: b.derecho,
    estado: 'recibida',
    email: b.email,
    nombre_completo: b.nombre_completo,
    asesor: b.asesor || null,
    canal: b.canal || 'admin',
    responsable: b.responsable || null,
    detalle: b.detalle || null,
    fecha_limite: fl,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logLegalEvent({
    event_type: 'ARCOP_REQUEST_RECEIVED', actor_type: 'ADMIN', actor_id_hash: sha256(b.email),
    affected_entity: 'ARCOP_REQUEST', event_summary: `Solicitud ARCOP+ recibida: ${b.derecho}`,
    legal_reference: 'Ley 21.719 ARCOP+', risk_level: 'MEDIUM', metadata: { id: data.id, derecho: b.derecho, fecha_limite: fl, canal: b.canal || 'admin' },
  })
  return NextResponse.json({ ok: true, id: data.id, fecha_limite: fl })
}

export async function PATCH(req: NextRequest) {
  const sb = supabaseAdmin()
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (b.accion === 'prorrogar') {
    if (!b.prorroga_motivo) return NextResponse.json({ error: 'motivo requerido' }, { status: 400 })
    const { data: nuevaFecha } = await sb.rpc('calcular_dias_habiles', {
      p_inicio: new Date().toISOString().slice(0, 10), p_dias: PLAZO_DIAS,
    })
    patch.estado = 'prorrogada'
    patch.prorroga_motivo = b.prorroga_motivo
    patch.prorroga_at = new Date().toISOString()
    patch.prorroga_por = b.prorroga_por || 'admin'
    patch.fecha_limite = nuevaFecha
  } else if (b.accion === 'resolver') {
    patch.estado = b.estado === 'rechazado' ? 'rechazado' : 'completado'
    patch.respuesta = b.respuesta || null
    patch.resuelto_at = new Date().toISOString()
  } else {
    if (b.estado) patch.estado = b.estado
    if (b.responsable !== undefined) patch.responsable = b.responsable
  }

  const { error } = await sb.from('derechos_solicitudes').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (b.accion === 'prorrogar') {
    await logLegalEvent({
      event_type: 'ARCOP_EXTENSION_GRANTED', actor_type: 'ADMIN', affected_entity: 'ARCOP_REQUEST',
      event_summary: 'Prórroga de solicitud ARCOP+ otorgada', legal_reference: 'Ley 21.719 ARCOP+', risk_level: 'MEDIUM',
      metadata: { id: b.id, motivo: b.prorroga_motivo },
    })
  } else if (b.accion === 'resolver') {
    await logLegalEvent({
      event_type: 'ARCOP_REQUEST_RESOLVED', actor_type: 'ADMIN', affected_entity: 'ARCOP_REQUEST',
      event_summary: `Solicitud ARCOP+ ${patch.estado === 'rechazado' ? 'rechazada' : 'resuelta'}`, legal_reference: 'Ley 21.719 ARCOP+', risk_level: 'LOW',
      metadata: { id: b.id, estado: patch.estado },
    })
  }
  return NextResponse.json({ ok: true })
}
