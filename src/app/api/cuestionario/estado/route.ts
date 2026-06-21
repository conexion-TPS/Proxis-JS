import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

// Perfiles reales (completado). 'pendiente'/''/null son placeholders de siembra → NO completado.
const PERFILES_VALIDOS = new Set(['E', 'S', 'R', 'A', 'AMB'])

// GET /api/cuestionario/estado → { completado } SOLO el booleano (no expone perfil ni sensibles).
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const sb = supabaseAdmin()
  const { data } = await sb
    .from('tps_perfiles')
    .select('perfil_base')
    .eq('asesor', asesor)
    .maybeSingle()

  const completado = !!data?.perfil_base && PERFILES_VALIDOS.has(data.perfil_base as string)
  return NextResponse.json({ completado }, { headers: cors })
}
