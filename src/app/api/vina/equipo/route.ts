import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseVina, EMPRESA_VINA } from '@/lib/supabaseVina'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SECRET = process.env.VINA_JWT_SECRET ?? process.env.SAILOR_JWT_SECRET ?? 'proxis-vina-secret'

type Sesion = { asesor: string; email: string; empresa: string; rol?: string }

// Solo un token de SUPERVISOR de empresa 'consorcio' puede ver el roster del equipo.
function verifySupervisor(req: NextRequest): Sesion | null {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    const s = jwt.verify(token, SECRET) as Sesion
    if (s.empresa !== EMPRESA_VINA) return null
    if (s.rol !== 'supervisor') return null
    return s
  } catch {
    return null
  }
}

// ── GET: roster del equipo (asesores) — solo nombres, NUNCA hashes ──
// La tabla vina_credentials tiene RLS cerrado al anon; por eso el navegador
// no puede armar el roster solo y debe pedirlo aquí (service-role).
export async function GET(req: NextRequest) {
  const s = verifySupervisor(req)
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sb = supabaseVina()
  const { data, error } = await sb
    .from('vina_credentials')
    .select('asesor')
    .eq('rol', 'asesor')
    .eq('activo', true)
    .order('asesor', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const asesores = (data ?? []).map(r => r.asesor)
  return NextResponse.json({ supervisor: s.asesor, asesores })
}
