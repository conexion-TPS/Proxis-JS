// supabase/functions/_shared/proyeccion-segura.ts
// Etapa 3 — Proyección segura hacia el SUPERVISOR: quita del row los campos cuyo
// id_dimension está marcado sensible=true en dimension_catalogo (lectura runtime).
// El filtrado es a nivel de DATO (se elimina el campo del objeto ANTES de armar
// cualquier prompt o texto), no una instrucción redaccional al LLM.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Mapa explícito campo_real → id_dimension. Necesario porque los nombres NO coinciden:
// la dimensión sensible vive con otro nombre en cada tabla/objeto.
const CAMPO_PERFIL: Record<string, string> = {
  resiliencia:      'resiliencia',     // columna de asesor_perfil
  backup_style_doc: 'tps_d8',          // columna de asesor_perfil: descripción textual de la necesidad de aprobación (d8)
}
const CAMPO_TPS_BOOL: Record<string, string> = {
  backup_style_activo: 'tps_d8',       // columna boolean de tps_perfiles
}
const RASGO_TPS: Record<string, string> = {
  f4: 'tps_c_f4',                      // sub-key del jsonb tps_perfiles.rasgos_comerciales
}

// Fail-closed: si dimension_catalogo no responde (error o vacío), se asume que los
// campos del mapa conocido SON sensibles y se quitan igual (no exponer por defecto).
const SENSIBLES_FALLBACK = new Set<string>(['resiliencia', 'tps_c_f4', 'tps_d8'])

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
// deseabilidad_social por REGLA APARTE (metadato de validez del test, no va al supervisor).
export async function proyectarTpsParaSupervisor(
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

  // Regla aparte (no por catálogo): validez del test → nunca al supervisor.
  delete out.deseabilidad_social

  return out
}
