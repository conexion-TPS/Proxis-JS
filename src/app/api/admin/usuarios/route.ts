import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

// GET — lista todos los asesores con credenciales + metas
export async function GET() {
  const sb = supabaseAdmin()
  const [credsRes, metasRes] = await Promise.all([
    sb.from('asesor_credentials').select('id,asesor,email,rol,activo,created_at').order('asesor'),
    sb.from('metas').select('asesor,supervisor,meta_contactos_semana,meta_prospectos_mes,meta_ingresos').order('asesor'),
  ])
  const creds = credsRes.data ?? []
  const metas = metasRes.data ?? []
  const users = creds.map(c => ({
    ...c,
    meta: metas.find(m => m.asesor === c.asesor) ?? null,
  }))
  return NextResponse.json({ ok: true, users })
}

// POST — crear nuevo asesor
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { nombre, email, password, supervisor, meta_contactos_semana, meta_prospectos_mes, meta_ingresos } = body

  if (!nombre?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'nombre, email y password son obligatorios' }, { status: 400 })
  }

  const sb = supabaseAdmin()
  const password_hash = await bcrypt.hash(password, 10)

  const { error: credErr } = await sb.from('asesor_credentials').insert({
    asesor:        nombre.trim(),
    email:         email.toLowerCase().trim(),
    password_hash,
    rol:           'asesor',
    activo:        true,
  })
  if (credErr) return NextResponse.json({ error: credErr.message }, { status: 400 })

  await sb.from('metas').insert({
    asesor:                nombre.trim(),
    supervisor:            supervisor?.trim() || null,
    meta_contactos_semana: meta_contactos_semana || 3,
    meta_prospectos_mes:   meta_prospectos_mes   || 15,
    meta_ingresos:         meta_ingresos         || 2_000_000,
  })

  return NextResponse.json({ ok: true })
}

// PATCH — editar supervisor/metas o toggle activo
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { asesor, activo, supervisor, meta_contactos_semana, meta_prospectos_mes, meta_ingresos } = body

  if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })

  const sb = supabaseAdmin()

  if (activo !== undefined) {
    await sb.from('asesor_credentials')
      .update({ activo, updated_at: new Date().toISOString() })
      .eq('asesor', asesor)
  }

  const metaUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (supervisor            !== undefined) metaUpdates.supervisor            = supervisor?.trim() || null
  if (meta_contactos_semana !== undefined) metaUpdates.meta_contactos_semana = meta_contactos_semana
  if (meta_prospectos_mes   !== undefined) metaUpdates.meta_prospectos_mes   = meta_prospectos_mes
  if (meta_ingresos         !== undefined) metaUpdates.meta_ingresos         = meta_ingresos

  if (Object.keys(metaUpdates).length > 1) {
    await sb.from('metas').update(metaUpdates).eq('asesor', asesor)
  }

  return NextResponse.json({ ok: true })
}
