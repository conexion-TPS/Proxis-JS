import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const JWT_SECRET  = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'
const JWT_EXPIRES = '30d'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))

  if (!email || !password) {
    return NextResponse.json({ error: 'email y password requeridos' }, { status: 400 })
  }

  const sb = supabaseAdmin()
  const { data: cred, error } = await sb
    .from('asesor_credentials')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('activo', true)
    .single()

  if (error || !cred) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401, headers: corsHeaders(req.headers.get('origin')) })
  }

  const valid = await bcrypt.compare(password, cred.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401, headers: corsHeaders(req.headers.get('origin')) })
  }

  const token = jwt.sign(
    { asesor: cred.asesor, email: cred.email, rol: cred.rol, id: cred.id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )

  const origin = req.headers.get('origin')
  return NextResponse.json({
    ok:                    true,
    token,
    asesor:                cred.asesor,
    email:                 cred.email,
    rol:                   cred.rol,
    terminos_aceptados_at: cred.terminos_aceptados_at ?? null,
  }, { headers: corsHeaders(origin) })
}
