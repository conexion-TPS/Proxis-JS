// supabase/functions/_shared/log-uso-sensible.ts
// Etapa 3 §5.6(b) — Logger del uso del dato sensible (f4/d8) → tabla uso_dato_sensible.
// Se llama desde los CALLERS de los módulos puros (interpretacion-asesor / proyeccion-segura),
// no dentro de ellos: así el log tiene asesor/actor/finalidad en contexto y las funciones
// puras siguen sin efectos secundarios.
//
// Granularidad: una fila por (asesor, dimension, salida, actor) por cada lectura.
// consentimiento_estado se resuelve SIEMPRE desde tps_perfiles (mig 053) por nombre de
// asesor, incluso cuando la lectura origen fue asesor_perfil (join lógico por `asesor`).
//
// Best-effort: el log de auditoría NUNCA debe tumbar el flujo del consumidor → todo va
// envuelto en try/catch silencioso.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type UsoSensibleEvento = {
  asesor:    string
  dimension: 'f4' | 'd8'
  salida:    string
  finalidad: string
  actor:     string
}

// consentimiento_estado vive SOLO en tps_perfiles. Lookup por asesor (una vez por asesor).
async function consentimientoDe(sb: SupabaseClient, asesor: string): Promise<string | null> {
  try {
    const { data } = await sb
      .from('tps_perfiles')
      .select('consentimiento_estado')
      .eq('asesor', asesor)
      .limit(1)
      .maybeSingle()
    return (data?.consentimiento_estado as string | null) ?? null
  } catch (e) {
    // No rompe el flujo, pero NO en silencio: el campo queda null y debe ser visible.
    console.error(`[uso_dato_sensible] lookup consentimiento falló para asesor="${asesor}":`, e)
    return null
  }
}

// Registra una fila por evento. Resuelve consentimiento_estado una sola vez por asesor.
export async function logUsoSensible(
  sb: SupabaseClient,
  eventos: UsoSensibleEvento[],
): Promise<void> {
  if (!eventos.length) return
  try {
    const asesores = [...new Set(eventos.map((e) => e.asesor))]
    const consent = new Map<string, string | null>()
    for (const a of asesores) consent.set(a, await consentimientoDe(sb, a))

    const filas = eventos.map((e) => ({
      asesor:                e.asesor,
      dimension:             e.dimension,
      salida:                e.salida,
      finalidad:             e.finalidad,
      actor:                 e.actor,
      consentimiento_estado: consent.get(e.asesor) ?? null,
    }))
    await sb.from('uso_dato_sensible').insert(filas)
  } catch (e) {
    // best-effort: la auditoría no debe romper el pipeline, pero TAMPOCO fallar en silencio
    // (un insert perdido es un agujero de auditoría). Se emite a stderr de la edge function.
    console.error(
      `[uso_dato_sensible] FALLO al registrar ${eventos.length} uso(s) sensible(s) ` +
      `[actor=${eventos[0]?.actor ?? '?'}]:`, e,
    )
  }
}
