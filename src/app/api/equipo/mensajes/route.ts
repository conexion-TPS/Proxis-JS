import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'
import { asesorEnSubarbol } from '@/lib/equipoSubarbol'

// Triggers que son ALERTA INTERNA AL ADMIN — nunca deben aparecer en el portal del
// supervisor (antes se filtraban y se veía hasta "no al asesor ni al supervisor").
const SOLO_ADMIN = new Set(['hipotesis_acumuladas', 'sin_mensajes_recientes'])

// Etiqueta HUMANA por trigger para el portal. NO usar trigger_config.descripcion
// (son notas internas de ingeniería: "motor IA", "cooldown 7d", etc.). Voz Sailor Mentor.
const ETIQUETA: Record<string, string> = {
  'bajo-meta-miercoles':        'Aliento a media semana',
  'meta-superada':              '¡Felicitación por la meta!',
  'paralisis-sostenida':        'Acompañamiento en una racha difícil',
  'primer-lunes-mes':           'Arranque de mes',
  'semana-sin-reporte-alerta':  'Recordatorio de reporte',
  'perfil-incompleto-24h':      'Recordatorio de evaluación',
  'perfil-incompleto-48h':      'Evaluación pendiente — tu apoyo',
  'riesgo_elevado':             'Señal de alerta — conviene tu atención',
  'supervisor-sin-valorar':     'Mensajes por valorar',
  'hipotesis-accion':           'Sugerencia de Sailor Mentor',
  'hipotesis-escalar-supervisor': 'Algo que necesita tu mano',
}

// El body de algunos triggers internos guarda nomenclatura cruda (enums, diagnóstico).
// Lo traducimos a una frase para un líder, en voz Sailor Mentor.
function humanizarCuerpo(triggerId: string | null, body: string): string {
  if (triggerId === 'riesgo_elevado') {
    const nota = (body.match(/Nota:\s*([\s\S]*)$/)?.[1] ?? '').trim()
    const base = /critico/i.test(body)
      ? 'Vengo viendo señales que necesitan tu atención cuanto antes.'
      : 'Vengo viendo señales de alerta que conviene mirar con tiempo.'
    return nota && nota.toLowerCase() !== 'sin nota' ? `${base} ${nota}` : base
  }
  return body
}

export async function GET(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const asesor = req.nextUrl.searchParams.get('asesor')
  if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })

  const sb = supabaseAdmin()

  // Etapa 3 — autorización horizontal: el asesor debe estar en el subárbol del token.
  if (!await asesorEnSubarbol(sb, session, asesor))
    return NextResponse.json({ error: 'No autorizado para este asesor' }, { status: 403 })

  // Traemos algunos de más y filtramos los solo-admin en memoria, para no mostrar
  // menos de 3 cuando los últimos sean internos.
  const { data: msgsRaw } = await sb.from('message_log')
    .select('id, trigger_id, body, created_at')
    .eq('asesor', asesor)
    .order('created_at', { ascending: false })
    .limit(12)

  const msgs = (msgsRaw ?? [])
    .filter(m => !SOLO_ADMIN.has(m.trigger_id ?? ''))
    .slice(0, 3)

  const ids = msgs.map(m => m.id)
  const { data: feedbacks } = ids.length
    ? await sb.from('feedback').select('message_id, score').in('message_id', ids)
    : { data: [] }

  const fbMap: Record<string, number> = {}
  for (const f of feedbacks ?? []) fbMap[f.message_id] = f.score

  return NextResponse.json({
    mensajes: msgs.map(m => ({
      id:          m.id,
      trigger_id:  m.trigger_id,
      descripcion: m.trigger_id ? (ETIQUETA[m.trigger_id] ?? 'Mensaje de Sailor Mentor') : 'Mensaje de Sailor Mentor',
      cuerpo:      humanizarCuerpo(m.trigger_id, (m.body as string) ?? ''),
      fecha:       m.created_at,
      score:       fbMap[m.id] ?? null,
    })),
  })
}
