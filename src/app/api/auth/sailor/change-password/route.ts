import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const JWT_SECRET = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'

function verifyToken(req: NextRequest): { asesor: string; id: string } | null {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET) as any
  } catch {
    return null
  }
}

export async function PUT(req: NextRequest) {
  const payload = verifyToken(req)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}))
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'currentPassword y newPassword requeridos' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const sb = supabaseAdmin()
  const { data: cred } = await sb
    .from('asesor_credentials')
    .select('password_hash')
    .eq('id', payload.id)
    .single()

  if (!cred) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, cred.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 })
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await sb
    .from('asesor_credentials')
    .update({ password_hash: newHash, updated_at: new Date().toISOString() })
    .eq('id', payload.id)

  return NextResponse.json({ ok: true }, { headers: corsHeaders(req.headers.get('origin')) })
}
