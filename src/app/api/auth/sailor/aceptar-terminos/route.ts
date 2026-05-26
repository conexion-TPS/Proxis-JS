import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const JWT_SECRET = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const auth   = req.headers.get('authorization') ?? ''

  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: corsHeaders(origin) })
  }

  let payload: { asesor: string } & Record<string, unknown>
  try {
    payload = jwt.verify(auth.slice(7), JWT_SECRET) as typeof payload
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401, headers: corsHeaders(origin) })
  }

  const sb  = supabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await sb
    .from('asesor_credentials')
    .update({ terminos_aceptados_at: now, updated_at: now })
    .eq('asesor', payload.asesor)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders(origin) })
  }

  return NextResponse.json({ ok: true, terminos_aceptados_at: now }, { headers: corsHeaders(origin) })
}
