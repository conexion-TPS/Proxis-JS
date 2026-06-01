import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/* Módulo E — Registro de brechas de seguridad. Plazo APDP: 72 horas desde detección. */
export async function GET() {
  const sb = supabaseAdmin()
  const { data, error } = await sb.from('seguridad_brechas').select('*').order('deteccion_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const brechas = (data ?? []).map(b => {
    const det = new Date(b.deteccion_at as string).getTime()
    const horasRestantes = 72 - (now - det) / 3.6e6
    const cerrada = ['notificado_apdp', 'notificado_titulares', 'cerrado'].includes(b.estado as string)
    return { ...b, horas_restantes_apdp: cerrada ? null : Math.round(horasRestantes * 10) / 10 }
  })
  return NextResponse.json({ brechas })
}

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin()
  const b = await req.json()
  if (!b.deteccion_at || !b.descripcion)
    return NextResponse.json({ error: 'deteccion_at y descripcion requeridos' }, { status: 400 })

  const { data, error } = await sb.from('seguridad_brechas').insert({
    deteccion_at: b.deteccion_at,
    descripcion: b.descripcion,
    categorias_datos: b.categorias_datos || null,
    n_afectados: b.n_afectados ?? null,
    consecuencias: b.consecuencias || null,
    medidas: b.medidas || null,
    estado: 'detectado',
    registrado_por: b.registrado_por || 'admin',
    historial: [{ estado: 'detectado', at: new Date().toISOString(), por: b.registrado_por || 'admin' }],
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(req: NextRequest) {
  const sb = supabaseAdmin()
  const b = await req.json()
  if (!b.id || !b.estado) return NextResponse.json({ error: 'id y estado requeridos' }, { status: 400 })

  const { data: actual } = await sb.from('seguridad_brechas').select('historial').eq('id', b.id).single()
  const historial = Array.isArray(actual?.historial) ? actual!.historial : []
  historial.push({ estado: b.estado, at: new Date().toISOString(), por: b.por || 'admin' })

  const patch: Record<string, unknown> = { estado: b.estado, updated_at: new Date().toISOString(), historial }
  if (b.estado === 'notificado_apdp') patch.notificado_apdp_at = new Date().toISOString()
  if (b.estado === 'notificado_titulares') patch.notificado_titulares_at = new Date().toISOString()

  const { error } = await sb.from('seguridad_brechas').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
