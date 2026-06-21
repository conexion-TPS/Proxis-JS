import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

// GET /api/cuestionario/instrumento → { cuestionario_id, preguntas[] }
// Contenido NO sensible (ítems del instrumento), pero igualmente detrás del JWT Sailor:
// post-lockdown no queda ninguna lectura anon directa a la base.
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const sb = supabaseAdmin()
  const { data: cues } = await sb
    .from('cuestionarios')
    .select('id')
    .eq('nombre', 'Instrumento TPS v1.0')
    .eq('activo', true)
    .maybeSingle()

  if (!cues) return NextResponse.json({ error: 'Instrumento no encontrado' }, { status: 404, headers: cors })

  const { data: preguntas } = await sb
    .from('preguntas')
    .select('id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones')
    .eq('cuestionario_id', cues.id)
    .order('orden')

  if (!preguntas?.length) return NextResponse.json({ error: 'Sin preguntas' }, { status: 404, headers: cors })

  return NextResponse.json({ cuestionario_id: cues.id, preguntas }, { headers: cors })
}
