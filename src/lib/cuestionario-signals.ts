import { SupabaseClient } from '@supabase/supabase-js'

type Pregunta = {
  id: string; texto: string; tipo_respuesta: string | null
  dimension_target: string | null; perfil_hint: string | null
}
type Respuesta = {
  id: string; asesor: string; pregunta_id: string; respuesta: string | null; contexto: unknown
}

function confianzaForTipo(tipo: string | null): number {
  switch (tipo) {
    case 'escala_5':     return 75
    case 'escala_4':     return 70
    case 'alternativas': return 65
    case 'si_no':        return 60
    case 'abierta':      return 45
    default:             return 55
  }
}

function normalizeValor(respuesta: string | null, tipo: string | null): string {
  if (!respuesta) return '0'
  const n = parseInt(respuesta)
  if (isNaN(n)) return respuesta
  if (tipo === 'escala_4') return String(Math.round(n * 25))
  if (tipo === 'escala_5') return String(Math.round(n * 20))
  return respuesta
}

export async function generarSenalesDeRespuestas(
  sb: SupabaseClient,
  respuestas: Respuesta[],
  preguntasMap: Map<string, Pregunta>,
  cuestionarioCtx: { id: string; nombre: string; tipo: string | null },
): Promise<number> {
  const signals: Array<{
    asesor: string; fuente: string; tipo: string; valor: string
    dimension_target: string | null; perfil_hint: string | null
    confianza_hint: number; procesada: boolean; contexto: unknown
  }> = []
  const processedIds: string[] = []

  for (const r of respuestas) {
    const pregunta = preguntasMap.get(r.pregunta_id)
    if (!pregunta?.dimension_target) continue

    signals.push({
      asesor:           r.asesor,
      fuente:           'cuestionario',
      tipo:             `cuestionario_${cuestionarioCtx.tipo ?? 'respuesta'}`,
      valor:            normalizeValor(r.respuesta, pregunta.tipo_respuesta),
      dimension_target: pregunta.dimension_target,
      perfil_hint:      pregunta.perfil_hint ?? null,
      confianza_hint:   confianzaForTipo(pregunta.tipo_respuesta),
      procesada:        false,
      contexto: {
        pregunta:       pregunta.texto,
        cuestionario:   cuestionarioCtx.nombre,
        respuesta_raw:  r.respuesta,
        respuesta_id:   r.id,
      },
    })
    processedIds.push(r.id)
  }

  if (!signals.length) return 0

  await sb.from('behavioral_signals').insert(signals)
  await sb.from('respuestas_cuestionario').update({ procesado: true }).in('id', processedIds)

  return signals.length
}
