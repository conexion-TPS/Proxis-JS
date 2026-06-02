import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabaseVina } from '@/lib/supabaseVina'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Mismo patrón que Sailor/equipo: bcrypt + JWT. Tabla: vina_credentials (proyecto A).
const SECRET  = process.env.VINA_JWT_SECRET ?? process.env.SAILOR_JWT_SECRET ?? 'proxis-vina-secret'
const EXPIRES = '30d'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password)
    return NextResponse.json({ error: 'email y password requeridos' }, { status: 400 })

  const sb = supabaseVina()
  const { data: cred, error } = await sb
    .from('vina_credentials')
    .select('*')
    .eq('email', String(email).toLowerCase().trim())
    .eq('activo', true)
    .single()

  if (error || !cred)
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })

  const valid = await bcrypt.compare(password, cred.password_hash)
  if (!valid)
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })

  const token = jwt.sign(
    { asesor: cred.asesor, email: cred.email, empresa: 'vina' },
    SECRET,
    { expiresIn: EXPIRES }
  )

  return NextResponse.json({ ok: true, token, asesor: cred.asesor, email: cred.email })
}
