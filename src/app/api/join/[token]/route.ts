import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const sb = supabaseAdmin()

  const { data: inv, error } = await sb
    .from('org_invitaciones')
    .select('id, usado, expira_at, nivel_sugerido, parent_nodo_id, institucion_id')
    .eq('token', token)
    .single()

  if (error || !inv)   return NextResponse.json({ error: 'Invitación no válida' }, { status: 404 })
  if (inv.usado)       return NextResponse.json({ error: 'Esta invitación ya fue utilizada' }, { status: 410 })
  if (new Date(inv.expira_at) < new Date()) return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 })

  return NextResponse.json({ ok: true, nivel: inv.nivel_sugerido, parent_nodo_id: inv.parent_nodo_id })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { nombre, email: emailBody, titulo_cargo, password } = await req.json().catch(() => ({}))

  if (!nombre?.trim() || !password)
    return NextResponse.json({ error: 'nombre y password requeridos' }, { status: 400 })

  const sb = supabaseAdmin()

  const { data: inv, error } = await sb
    .from('org_invitaciones')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !inv)   return NextResponse.json({ error: 'Invitación no válida' }, { status: 404 })
  if (inv.usado)       return NextResponse.json({ error: 'Invitación ya utilizada' }, { status: 410 })
  if (new Date(inv.expira_at) < new Date()) return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 })

  // Create the org_nodo for this user
  const { data: nodo, error: nodoErr } = await sb
    .from('org_nodos')
    .insert({
      parent_id:      inv.parent_nodo_id ?? null,
      institucion_id: inv.institucion_id,
      nombre:         nombre.trim(),
      titulo_propio:  titulo_cargo?.trim() || null,
    })
    .select('id')
    .single()

  if (nodoErr || !nodo) return NextResponse.json({ error: 'Error al crear nodo' }, { status: 500 })

  // Email: prefer admin-set, then user-provided, then auto-generated
  const email = inv.email_destino ?? emailBody?.toLowerCase?.() ?? `nodo-${nodo.id}@proxis.internal`
  const password_hash = await bcrypt.hash(password, 12)

  const { error: userErr } = await sb.from('org_usuarios').insert({
    nombre:       nombre.trim(),
    email:        email.toLowerCase(),
    password_hash,
    org_nodo_id:  nodo.id,
  })

  if (userErr) {
    await sb.from('org_nodos').delete().eq('id', nodo.id)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }

  // Mark invitation as used
  await sb.from('org_invitaciones').update({ usado: true }).eq('id', inv.id)

  return NextResponse.json({ ok: true })
}
