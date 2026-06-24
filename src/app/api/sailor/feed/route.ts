import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

// Feed del asesor (Sailor). RLS de sailor_messages sigue cerrada (admin_only);
// este endpoint sirve el feed con service_role tras VERIFICAR el JWT de Sailor y
// usar SIEMPRE el asesor del token (nunca del body/query) — así un token no puede
// leer ni marcar mensajes de otro asesor. Mismo patrón que /api/privacy/consent.

export async function OPTIONS(req: Request) { return handleOptions(req) }

const JWT_SECRET = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'

function authAsesor(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  try { return (jwt.verify(auth.slice(7), JWT_SECRET) as { asesor: string }).asesor } catch { return null }
}

// GET → mensajes del coach del asesor (origen='coach_ia'), más recientes primero.
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const sb = supabaseAdmin()
  const { data, error } = await sb.from('sailor_messages')
    .select('*')
    .eq('asesor', asesor)
    .eq('origen', 'coach_ia')
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors })

  return NextResponse.json({ mensajes: data ?? [] }, { headers: cors })
}

// POST { ids: string[] } → marca esos mensajes como leído, SIEMPRE acotado al
// asesor del token (el body no decide el destinatario; solo qué ids dentro de lo suyo).
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const body = await req.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).filter(x => typeof x === 'string') as string[] : []
  if (ids.length === 0) return NextResponse.json({ ok: true, updated: 0 }, { headers: cors })

  const sb = supabaseAdmin()
  const { error } = await sb.from('sailor_messages')
    .update({ leido: true })
    .in('id', ids)
    .eq('asesor', asesor)          // candado: solo marca lo del propio asesor del token
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors })

  return NextResponse.json({ ok: true, updated: ids.length }, { headers: cors })
}
