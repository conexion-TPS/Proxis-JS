import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'
import { esPerfilComputado } from '@/lib/tipo-catalogo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

type Modulo = 'A' | 'B' | 'C' | 'D'
const MODULOS: Modulo[] = ['A', 'B', 'C', 'D']

function moduloDe(dim: string | null | undefined): Modulo | null {
  if (dim === 'tps_a') return 'A'
  if (dim === 'tps_b') return 'B'
  if (dim === 'tps_d') return 'D'
  if (dim && dim.startsWith('tps_c_')) return 'C'
  return null
}

// GET /api/cuestionario/estado-modulos
// → { asesor, modulos:{A,B,C,D:{respondidas,total,completo}}, todos_completos, perfil_listo,
//     terminos_aceptados_at, dias_desde_terminos }
// Solo lectura. Alimenta notificaciones (aviso en Bitácora, email supervisor, badge Sailor).
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const sb = supabaseAdmin()

  const [cuesRes, progresoRes, perfilRes, credRes] = await Promise.all([
    sb.from('cuestionarios').select('id')
      .eq('nombre', 'Instrumento TPS v1.0').eq('activo', true).maybeSingle(),
    sb.from('progreso_cuestionario').select('modulo').eq('asesor', asesor),
    sb.from('tps_perfiles').select('perfil_base').eq('asesor', asesor).maybeSingle(),
    sb.from('asesor_credentials').select('terminos_aceptados_at').eq('asesor', asesor).maybeSingle(),
  ])

  // Totales reales del instrumento activo (no hardcodeados: el instrumento es la fuente de verdad)
  const totales: Record<Modulo, number> = { A: 0, B: 0, C: 0, D: 0 }
  if (cuesRes.data?.id) {
    const { data: preguntas } = await sb
      .from('preguntas').select('dimension_target')
      .eq('cuestionario_id', cuesRes.data.id)
    for (const p of preguntas ?? []) {
      const m = moduloDe(p.dimension_target)
      if (m) totales[m]++
    }
  }

  // Respondidas por módulo desde progreso_cuestionario
  const respondidas: Record<Modulo, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const r of progresoRes.data ?? []) {
    const m = r.modulo as Modulo
    if (m in respondidas) respondidas[m]++
  }

  const modulos = MODULOS.reduce((acc, m) => {
    const total = totales[m]
    const resp  = respondidas[m]
    acc[m] = { respondidas: resp, total, completo: total > 0 && resp >= total }
    return acc
  }, {} as Record<Modulo, { respondidas: number; total: number; completo: boolean }>)

  const todos_completos = MODULOS.every(m => modulos[m].completo)
  const perfil_listo    = esPerfilComputado(perfilRes.data?.perfil_base)

  const terminos_aceptados_at = credRes.data?.terminos_aceptados_at ?? null
  const dias_desde_terminos   = terminos_aceptados_at
    ? Math.floor((Date.now() - new Date(terminos_aceptados_at).getTime()) / 86_400_000)
    : null

  return NextResponse.json({
    asesor,
    modulos,
    todos_completos,
    perfil_listo,
    terminos_aceptados_at,
    dias_desde_terminos,
  }, { headers: cors })
}
