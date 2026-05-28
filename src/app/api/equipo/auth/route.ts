import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'

const SECRET  = process.env.SAILOR_JWT_SECRET ?? 'proxis-equipo-secret'
const EXPIRES = '7d'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password)
    return NextResponse.json({ error: 'email y password requeridos' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: usuario, error } = await sb
    .from('org_usuarios')
    .select('id, nombre, email, password_hash, org_nodo_id, activo')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !usuario || !usuario.activo)
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })

  const valid = await bcrypt.compare(password, usuario.password_hash)
  if (!valid)
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })

  await sb.from('org_usuarios').update({ ultimo_login: new Date().toISOString() }).eq('id', usuario.id)

  const token = jwt.sign(
    { usuario_id: usuario.id, org_nodo_id: usuario.org_nodo_id, email: usuario.email, nombre: usuario.nombre },
    SECRET,
    { expiresIn: EXPIRES }
  )

  return NextResponse.json({ ok: true, token, nombre: usuario.nombre, org_nodo_id: usuario.org_nodo_id, usuario_id: usuario.id, email: usuario.email })
}

export function verifyEquipoToken(req: NextRequest): { usuario_id: string; org_nodo_id: string | null; email: string; nombre: string } | null {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    return jwt.verify(token, SECRET) as { usuario_id: string; org_nodo_id: string | null; email: string; nombre: string }
  } catch {
    return null
  }
}
