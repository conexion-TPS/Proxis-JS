import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

// Consentimiento del DATO SENSIBLE f4/resiliencia (§5.5), accionable por el asesor desde el Perfil.
// Registro autoritativo: tps_perfiles.consentimiento_estado. Distinto del consentimiento A/B
// (uso secundario, consentimiento_historial) — NO se mezclan.

// GET → estado del consentimiento + si el dato f4 está presente hoy.
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const sb = supabaseAdmin()
  const { data } = await sb.from('tps_perfiles')
    .select('consentimiento_estado, rasgos_comerciales')
    .eq('asesor', asesor).maybeSingle()

  const rasgos = (data?.rasgos_comerciales ?? {}) as Record<string, unknown>
  const tiene_f4 = rasgos.f4 !== undefined && rasgos.f4 !== null
  return NextResponse.json({ estado: data?.consentimiento_estado ?? null, tiene_f4 }, { headers: cors })
}

// PATCH { accion: 'revocar' } → revocación REAL §5.5: marca no_consentido y BORRA el f4 guardado
// en sus 4 ubicaciones. 'otorgar' NO se hace aquí: re-otorgar exige re-responder los ítems f4
// (la app manda al cuestionario; el consentimiento se re-fija al cerrar el Módulo C en tps-evaluar).
export async function PATCH(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const body = await req.json().catch(() => ({}))
  if (body?.accion !== 'revocar')
    return NextResponse.json(
      { error: "accion no soportada (use 'revocar'; otorgar = re-tomar la evaluación)" },
      { status: 400, headers: cors },
    )

  const sb = supabaseAdmin()

  // 1) tps_perfiles: quitar f4 del jsonb (read-modify-write) + marcar no_consentido.
  const { data: tp } = await sb.from('tps_perfiles')
    .select('rasgos_comerciales').eq('asesor', asesor).maybeSingle()
  const rasgos = { ...((tp?.rasgos_comerciales ?? {}) as Record<string, unknown>) }
  delete rasgos.f4
  const { error: e1 } = await sb.from('tps_perfiles')
    .update({ rasgos_comerciales: rasgos, consentimiento_estado: 'no_consentido', updated_at: new Date().toISOString() })
    .eq('asesor', asesor)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500, headers: cors })

  // 2) asesor_perfil: borrar el puente de resiliencia (texto "suma/base/n").
  await sb.from('asesor_perfil')
    .update({ resiliencia: null, updated_at: new Date().toISOString() })
    .eq('asesor', asesor)

  // 3) respuestas_cuestionario: borrar las crudas de los ítems f4 (dimension_target = 'tps_c_f4').
  const { data: pregsF4 } = await sb.from('preguntas').select('id').eq('dimension_target', 'tps_c_f4')
  const f4ids = (pregsF4 ?? []).map((p: { id: string }) => p.id)
  if (f4ids.length)
    await sb.from('respuestas_cuestionario').delete().eq('asesor', asesor).in('pregunta_id', f4ids)

  // 4) asesor_puntaje_dimension: borrar puntajes f4 de la balanza (defensivo; hoy 0 filas).
  await sb.from('asesor_puntaje_dimension').delete().eq('asesor', asesor).eq('dimension', 'tps_c_f4')

  return NextResponse.json({ ok: true, accion: 'revocado' }, { headers: cors })
}
