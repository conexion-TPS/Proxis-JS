import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generarSenalesDeRespuestas } from '@/lib/cuestionario-signals'

export async function POST(req: NextRequest) {
  const { cuestionario_id } = await req.json().catch(() => ({}))
  if (!cuestionario_id) return NextResponse.json({ error: 'cuestionario_id requerido' }, { status: 400 })

  const sb = supabaseAdmin()

  const [cuestRes, respRes, pregRes] = await Promise.all([
    sb.from('cuestionarios').select('id, nombre, tipo').eq('id', cuestionario_id).single(),
    sb.from('respuestas_cuestionario').select('*').eq('cuestionario_id', cuestionario_id).eq('procesado', false),
    sb.from('preguntas').select('id, texto, tipo_respuesta, dimension_target, perfil_hint').eq('cuestionario_id', cuestionario_id),
  ])

  if (cuestRes.error || !cuestRes.data)
    return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })

  const respuestas  = respRes.data ?? []
  const preguntasMap = new Map((pregRes.data ?? []).map(p => [p.id, p]))

  if (!respuestas.length)
    return NextResponse.json({ created: 0, message: 'Sin respuestas nuevas por procesar' })

  const created = await generarSenalesDeRespuestas(sb, respuestas, preguntasMap, cuestRes.data)

  return NextResponse.json({ created, total_respuestas: respuestas.length })
}
