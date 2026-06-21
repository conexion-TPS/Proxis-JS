import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const PERFILES_VALIDOS = new Set(['E', 'S', 'R', 'A', 'AMB'])

// GET /api/cuestionario/resultado → { resultado } del PROPIO asesor (token).
// Decisión (a): el asesor ve su propio f4 (vive en rasgos_comerciales). NO se devuelve
// consentimiento_estado (metadato interno del gate, no es dato de salida del asesor).
// Mismo shape que devuelve tps-evaluar, para que la pantalla `listo` sea consistente.
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const sb = supabaseAdmin()
  const { data } = await sb
    .from('tps_perfiles')
    .select('perfil_base, confianza_diagnostico, puntaje_a, puntaje_b, rasgos_comerciales, deseabilidad_social')
    .eq('asesor', asesor)
    .maybeSingle()

  if (!data || !PERFILES_VALIDOS.has(data.perfil_base as string))
    return NextResponse.json({ error: 'Sin resultado' }, { status: 404, headers: cors })

  const resultado = {
    perfil_base:         data.perfil_base,
    confianza:           data.confianza_diagnostico,
    puntaje_a:           data.puntaje_a,
    puntaje_b:           data.puntaje_b,
    rasgos_comerciales:  data.rasgos_comerciales ?? {},
    deseabilidad_social: data.deseabilidad_social,
  }
  return NextResponse.json({ resultado }, { headers: cors })
}
