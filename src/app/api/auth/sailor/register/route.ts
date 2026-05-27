import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const JWT_SECRET  = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'
const JWT_EXPIRES = '30d'
const INDIVIDUAL_GRUPO_ID = '00000000-0000-0000-0000-000000000002'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400, headers: cors })
  }

  const { nombre, email, password } = body
  if (!nombre?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: 'nombre, email y password son obligatorios' },
      { status: 400, headers: cors }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres' },
      { status: 400, headers: cors }
    )
  }

  const sb = supabaseAdmin()

  // Check for duplicate email
  const { data: existing } = await sb
    .from('asesor_credentials')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Ya existe una cuenta con ese email' },
      { status: 409, headers: cors }
    )
  }

  const password_hash = await bcrypt.hash(password, 10)
  const asesorNombre  = nombre.trim()

  const { data: cred, error: credErr } = await sb
    .from('asesor_credentials')
    .insert({
      asesor:        asesorNombre,
      email:         email.toLowerCase().trim(),
      password_hash,
      rol:           'asesor',
      activo:        true,
      grupo_id:      INDIVIDUAL_GRUPO_ID,
    })
    .select()
    .single()

  if (credErr) {
    return NextResponse.json({ error: credErr.message }, { status: 400, headers: cors })
  }

  // Default metas
  await sb.from('metas').insert({
    asesor:                asesorNombre,
    meta_contactos_semana: 3,
    meta_prospectos_mes:   15,
    meta_ingresos:         2_000_000,
  }).catch(() => {})

  const token = jwt.sign(
    { asesor: cred.asesor, email: cred.email, rol: cred.rol, id: cred.id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )

  return NextResponse.json({
    ok:                    true,
    token,
    asesor:                cred.asesor,
    email:                 cred.email,
    rol:                   cred.rol,
    terminos_aceptados_at: null,
  }, { headers: cors })
}
