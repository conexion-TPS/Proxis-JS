// supabase/functions/_shared/proyeccion-segura.ts
// Etapa 3 — Proyección segura hacia el SUPERVISOR: quita del row los campos cuyo
// id_dimension está marcado sensible=true en dimension_catalogo (lectura runtime).
// El filtrado es a nivel de DATO (se elimina el campo del objeto ANTES de armar
// cualquier prompt o texto), no una instrucción redaccional al LLM.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Mapa explícito campo_real → id_dimension. Necesario porque los nombres NO coinciden:
// la dimensión sensible vive con otro nombre en cada tabla/objeto.
const CAMPO_PERFIL: Record<string, string> = {
  resiliencia:           'resiliencia',           // columna de asesor_perfil
  equilibrio_adaptativo: 'equilibrio_adaptativo', // Corrección A — 🔒 reclasificada sensible (F7)
}
const CAMPO_TPS_BOOL: Record<string, string> = {
  backup_style_activo: 'tps_d8',       // columna boolean de tps_perfiles
}
const RASGO_TPS: Record<string, string> = {
  f4: 'tps_c_f4',                      // sub-key del jsonb tps_perfiles.rasgos_comerciales
}

// Fail-closed: si dimension_catalogo no responde (error o vacío), se asume que los
// campos del mapa conocido SON sensibles y se quitan igual (no exponer por defecto).
const SENSIBLES_FALLBACK = new Set<string>(['resiliencia', 'equilibrio_adaptativo', 'tps_c_f4', 'tps_d8'])

async function getSensibles(sb: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await sb
      .from('dimension_catalogo')
      .select('id_dimension')
      .eq('sensible', true)
    if (error || !data || data.length === 0) return new Set(SENSIBLES_FALLBACK)
    return new Set(data.map((r: { id_dimension: string }) => r.id_dimension))
  } catch (_) {
    return new Set(SENSIBLES_FALLBACK)
  }
}

// Alias de columna (nombres reales en filas/objetos) → id_dimension de catálogo.
// Fuente ÚNICA para resolver dimension_afectada de deductions_log, que mezcla ids de
// catálogo (p.ej. 'resiliencia') con nombres de columna (p.ej. 'equilibrio_adaptativo').
// Se compone de los mismos mapas que ya usa la proyección — no se duplica ninguna lista.
export const ALIAS_DIMENSION: Record<string, string> = {
  ...CAMPO_PERFIL,    // resiliencia→resiliencia, equilibrio_adaptativo→equilibrio_adaptativo
  ...CAMPO_TPS_BOOL,  // backup_style_activo→tps_d8
  ...RASGO_TPS,       // f4→tps_c_f4
}

// Construye —con UNA lectura del catálogo— un predicado que decide si una
// dimension_afectada es ELEGIBLE para mostrarse al supervisor.
// FAIL-CLOSED: elegible SOLO si resuelve con certeza a una dimensión sensible=false del
// catálogo. Cualquier valor desconocido/nulo/no mapeado, o catálogo inaccesible ⇒ NO elegible
// (omitir una neutra de más es aceptable; dejar pasar una sensible no lo es).
export async function construirFiltroDimensionParaSupervisor(
  sb: SupabaseClient,
): Promise<(dimAfectada: string | null | undefined) => boolean> {
  let sensiblePorId = new Map<string, boolean>()
  try {
    const { data, error } = await sb.from('dimension_catalogo').select('id_dimension, sensible')
    if (!error && data) {
      sensiblePorId = new Map(
        data.map((r: { id_dimension: string; sensible: boolean }) => [r.id_dimension, r.sensible]),
      )
    }
  } catch (_) {
    sensiblePorId = new Map() // catálogo inaccesible ⇒ fail-closed (nada elegible)
  }
  return (dimAfectada) => {
    if (!dimAfectada) return false
    const id = ALIAS_DIMENSION[dimAfectada] ?? dimAfectada
    return sensiblePorId.get(id) === false // elegible solo si el catálogo lo marca explícitamente no-sensible
  }
}

// asesor_perfil → copia sin las columnas sensibles (hoy: resiliencia).
export async function proyectarPerfilParaSupervisor(
  sb: SupabaseClient,
  perfilRow: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!perfilRow) return perfilRow
  const sensibles = await getSensibles(sb)
  const out = { ...perfilRow }
  for (const [campo, idDim] of Object.entries(CAMPO_PERFIL)) {
    if (sensibles.has(idDim)) delete out[campo]
  }
  return out
}

// tps_perfiles → copia sin booleanos sensibles (backup_style_activo→tps_d8) y sin
// la sub-key sensible del jsonb (rasgos_comerciales.f4→tps_c_f4). Además quita
// deseabilidad_social por REGLA APARTE (metadato de validez del test, no es dato de salida).
// Describe la OPERACIÓN (quitar sensibles), no el destinatario: la usan el camino del
// supervisor (elimina) y el del asesor (que luego interpreta el crudo aparte).
export async function proyectarTpsSinSensibles(
  sb: SupabaseClient,
  tpsRow: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!tpsRow) return tpsRow
  const sensibles = await getSensibles(sb)
  const out: Record<string, unknown> = { ...tpsRow }

  // Columnas booleanas sensibles
  for (const [campo, idDim] of Object.entries(CAMPO_TPS_BOOL)) {
    if (sensibles.has(idDim)) delete out[campo]
  }

  // Sub-keys sensibles dentro del jsonb rasgos_comerciales (copia, no muta el original)
  const rasgos = out.rasgos_comerciales
  if (rasgos && typeof rasgos === 'object') {
    const copia = { ...(rasgos as Record<string, unknown>) }
    for (const [subKey, idDim] of Object.entries(RASGO_TPS)) {
      if (sensibles.has(idDim)) delete copia[subKey]
    }
    out.rasgos_comerciales = copia
  }

  // Regla aparte (no por catálogo): validez del test → nunca es dato de salida.
  delete out.deseabilidad_social

  return out
}
