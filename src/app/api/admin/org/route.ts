import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

function genToken() {
  return randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function GET() {
  const sb = supabaseAdmin()
  const [instRes, capasRes, nodosRes, usuariosRes, invRes] = await Promise.all([
    sb.from('instituciones').select('id, nombre, tipo, activo').order('nombre'),
    sb.from('org_capas').select('id, institucion_id, nivel, nombre_cargo').order('nivel'),
    sb.from('org_nodos').select('id, parent_id, institucion_id, capa_id, nombre, titulo_propio, activo').order('nombre'),
    sb.from('org_usuarios').select('id, nombre, email, org_nodo_id, activo, ultimo_login').order('nombre'),
    sb.from('org_invitaciones')
      .select('id, token, institucion_id, parent_nodo_id, nivel_sugerido, email_destino, usado, expira_at, created_at')
      .eq('usado', false)
      .gt('expira_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])
  return NextResponse.json({
    instituciones: instRes.data  ?? [],
    capas:         capasRes.data ?? [],
    nodos:         nodosRes.data ?? [],
    usuarios:      usuariosRes.data ?? [],
    invitaciones:  invRes.data  ?? [],
  })
}

export async function POST(req: NextRequest) {
  const sb  = supabaseAdmin()
  const body = await req.json()
  const { accion } = body

  if (accion === 'crear_institucion') {
    const { nombre, tipo = 'empresa' } = body
    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
    const { data, error } = await sb.from('instituciones').insert({ nombre, tipo }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  if (accion === 'crear_capa') {
    const { institucion_id, nivel, nombre_cargo } = body
    if (!institucion_id || !nivel || !nombre_cargo)
      return NextResponse.json({ error: 'faltan campos' }, { status: 400 })
    const { data, error } = await sb.from('org_capas')
      .upsert({ institucion_id, nivel, nombre_cargo }, { onConflict: 'institucion_id,nivel' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  if (accion === 'crear_nodo') {
    const { parent_id, institucion_id, capa_id, nombre, titulo_propio } = body
    if (!institucion_id || !nombre)
      return NextResponse.json({ error: 'faltan campos' }, { status: 400 })
    const { data, error } = await sb.from('org_nodos')
      .insert({ parent_id: parent_id || null, institucion_id, capa_id: capa_id || null, nombre, titulo_propio: titulo_propio || null })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  if (accion === 'crear_invitacion') {
    const { institucion_id, parent_nodo_id, nivel_sugerido, email_destino } = body
    if (!institucion_id)
      return NextResponse.json({ error: 'institucion_id requerido' }, { status: 400 })
    const token = genToken()
    const { data, error } = await sb.from('org_invitaciones')
      .insert({
        token,
        institucion_id,
        parent_nodo_id: parent_nodo_id || null,
        nivel_sugerido: nivel_sugerido || null,
        email_destino:  email_destino  || null,
      })
      .select('id, token, expira_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  if (accion === 'revocar_invitacion') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await sb.from('org_invitaciones').update({ usado: true }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (accion === 'asignar_asesor') {
    const { asesor, org_nodo_id } = body
    if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })
    const { error } = await sb.from('asesor_credentials')
      .update({ org_nodo_id: org_nodo_id || null })
      .eq('asesor', asesor)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (accion === 'importar_asesores') {
    const { rows } = body as { rows: { asesor: string; org_nodo_id: string }[] }
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: 'rows requerido' }, { status: 400 })
    let updated = 0
    for (const row of rows) {
      const { error } = await sb.from('asesor_credentials')
        .update({ org_nodo_id: row.org_nodo_id })
        .eq('asesor', row.asesor)
      if (!error) updated++
    }
    return NextResponse.json({ ok: true, updated })
  }

  if (accion === 'importar_usuarios') {
    const { rows } = body as { rows: { nombre: string; email: string; password: string; org_nodo_id: string }[] }
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: 'rows requerido' }, { status: 400 })
    const hashed = await Promise.all(
      rows.map(async r => ({
        nombre:        r.nombre.trim(),
        email:         r.email.toLowerCase().trim(),
        password_hash: await bcrypt.hash(r.password, 10),
        org_nodo_id:   r.org_nodo_id,
        activo:        true,
      }))
    )
    const { error } = await sb.from('org_usuarios').upsert(hashed, { onConflict: 'email' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, processed: hashed.length })
  }

  return NextResponse.json({ error: 'accion desconocida' }, { status: 400 })
}
