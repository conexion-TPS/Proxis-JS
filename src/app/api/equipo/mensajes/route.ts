import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'

export async function GET(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const asesor = req.nextUrl.searchParams.get('asesor')
  if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })

  const sb = supabaseAdmin()

  const [msgsRes, triggersRes] = await Promise.all([
    sb.from('message_log')
      .select('id, trigger_id, body, created_at')
      .eq('asesor', asesor)
      .order('created_at', { ascending: false })
      .limit(3),
    sb.from('trigger_config').select('trigger_id, descripcion'),
  ])

  const trigMap: Record<string, string> = {}
  for (const t of triggersRes.data ?? []) trigMap[t.trigger_id] = t.descripcion ?? t.trigger_id

  const ids = (msgsRes.data ?? []).map(m => m.id)
  const { data: feedbacks } = ids.length
    ? await sb.from('feedback').select('message_id, score').in('message_id', ids)
    : { data: [] }

  const fbMap: Record<string, number> = {}
  for (const f of feedbacks ?? []) fbMap[f.message_id] = f.score

  return NextResponse.json({
    mensajes: (msgsRes.data ?? []).map(m => ({
      id:          m.id,
      trigger_id:  m.trigger_id,
      descripcion: m.trigger_id ? (trigMap[m.trigger_id] ?? m.trigger_id) : 'Mensaje del coach',
      cuerpo:      (m.body as string) ?? '',
      fecha:       m.created_at,
      score:       fbMap[m.id] ?? null,
    })),
  })
}
