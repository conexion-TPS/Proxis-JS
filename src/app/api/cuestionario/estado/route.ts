import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'
import { esPerfilComputado } from '@/lib/tipo-catalogo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

// Completado = perfil computado (tolerante a letra o id_tipo ERRIM); sentinels
// ('pendiente'/'canary'/'provisional') y null → NO completado. Ver tipo-catalogo.

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

  const completado = esPerfilComputado(data?.perfil_base)
  return NextResponse.json({ completado }, { headers: cors })
}
