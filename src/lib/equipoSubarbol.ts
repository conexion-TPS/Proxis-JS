import type { SupabaseClient } from '@supabase/supabase-js'

// Etapa 3 — Autorización horizontal del portal equipo.
// Replica el patrón de equipo/dashboard:18-36: el supervisor solo puede operar sobre
// asesores de SU subárbol (org_subtree del nodo del token). cargo='admin' ve todo.
// Fail-closed: sin asesor, sin nodo raíz o sin subárbol → false.
// Nota: org_subtree es una RPC en la DB (no versionada — misma deuda que proxis-informes);
// acá solo se consume, no se crea.

export async function asesorEnSubarbol(
  sb: SupabaseClient,
  session: { org_nodo_id: string | null; cargo: string },
  asesorId: string | null,
): Promise<boolean> {
  if (!asesorId) return false
  if (session.cargo === 'admin') return true
  if (!session.org_nodo_id) return false                       // fail-closed: sin nodo raíz

  const { data: subtree } = await sb.rpc('org_subtree', { nodo_raiz: session.org_nodo_id })
  const ids = (subtree ?? []).map((r: { id: string }) => r.id)
  if (ids.length === 0) return false                           // fail-closed: sin subárbol

  const { data } = await sb
    .from('asesor_credentials')
    .select('asesor')
    .eq('activo', true)
    .eq('asesor', asesorId)
    .in('org_nodo_id', ids)
    .maybeSingle()
  return !!data
}
