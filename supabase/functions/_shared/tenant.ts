// supabase/functions/_shared/tenant.ts
// Gate por institución (lista blanca, fail-closed). Único lugar de la capa edge
// que "sabe" de institución — espejo de src/lib/identity.ts en Next.
// Método único de resolución: instituciones(ia_activa) -> org_nodos -> personas.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Carve-out: el arnés de canarios (__canary__, __*) nunca se gatea.
export const esCanary = (n: string): boolean => n.startsWith('__')

// 1) Instituciones con IA habilitada.
export async function getInstitucionesAutorizadas(sb: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await sb.from('instituciones').select('id').eq('ia_activa', true)
  if (error || !data) return new Set()          // fail-closed: error/columna ausente -> nadie
  return new Set(data.map((r: { id: string }) => r.id))
}

// 2) Nombres de personas (asesores + mando) de esas instituciones, VÍA org_nodos.
export async function getAsesoresAutorizados(sb: SupabaseClient): Promise<Set<string>> {
  const insts = await getInstitucionesAutorizadas(sb)
  if (insts.size === 0) return new Set()        // fail-closed: sin instituciones -> vacío

  const { data: nodos } = await sb.from('org_nodos').select('id').in('institucion_id', [...insts])
  const nodoIds = (nodos ?? []).map((n: { id: string }) => n.id)
  if (nodoIds.length === 0) return new Set()    // fail-closed: sin nodos -> vacío

  const [{ data: cred }, { data: mando }] = await Promise.all([
    sb.from('asesor_credentials').select('asesor').in('org_nodo_id', nodoIds),
    sb.from('org_usuarios').select('nombre').in('org_nodo_id', nodoIds),
  ])

  const set = new Set<string>()
  for (const c of cred ?? [])  if (c.asesor) set.add(c.asesor as string)
  for (const m of mando ?? []) if (m.nombre) set.add(m.nombre as string)
  return set
}

// Helpers de filtrado (con carve-out de canarios).
export function filtrarAutorizados(nombres: string[], autz: Set<string>): string[] {
  return nombres.filter(n => esCanary(n) || autz.has(n))
}

export function esAutorizado(nombre: string, autz: Set<string>): boolean {
  return esCanary(nombre) || autz.has(nombre)
}
