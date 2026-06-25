import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'
import { asesorEnSubarbol } from '@/lib/equipoSubarbol'

export async function POST(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { message_id, score } = await req.json().catch(() => ({}))
  if (!message_id || ![-1, 1].includes(score))
    return NextResponse.json({ error: 'message_id y score (1 ó -1) requeridos' }, { status: 400 })

  const sb = supabaseAdmin()

  // Etapa 3 — autorización horizontal: resolver el asesor del mensaje y validar subárbol.
  const { data: msg } = await sb
    .from('message_log').select('asesor').eq('id', message_id).maybeSingle()
  if (!msg || !await asesorEnSubarbol(sb, session, msg.asesor as string))
    return NextResponse.json({ error: 'No autorizado para este mensaje' }, { status: 403 })

  const { data: existing } = await sb
    .from('feedback').select('id').eq('message_id', message_id).maybeSingle()

  if (existing) {
    await sb.from('feedback').update({ score }).eq('id', existing.id)
  } else {
    await sb.from('feedback').insert({ message_id, score, correccion: '[supervisor]' })
  }

  // F1 — reconexión: además del feedback (cimiento de H10, intacto arriba), registramos
  // la valoración de oportunidad como señal conductual, que es la tabla que /admin/senales
  // SÍ lee (la tabla feedback no se muestra allí). tipo propio 'feedback_oportunidad'.
  // (Capa simple: una señal por valoración; el ciclo de reenviar/repreguntar es AD-4, diferido.)
  await sb.from('behavioral_signals').insert({
    asesor:           msg.asesor as string,
    fuente:           'supervisor',
    tipo:             'feedback_oportunidad',
    valor:            score === 1 ? 'oportuno' : 'no_era_el_momento',
    dimension_target: 'relacion_feedback',
    procesada:        false,
    contexto:         { message_id, supervisor: session.nombre, score },
  }).then(undefined, () => { /* no romper el feedback si la señal falla */ })

  return NextResponse.json({ ok: true })
}
