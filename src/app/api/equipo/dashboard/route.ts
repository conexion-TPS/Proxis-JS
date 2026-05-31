import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'

export async function GET(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sb = supabaseAdmin()
  const { org_nodo_id, cargo } = session

  // Tipo de vista según cargo (director ve árbol de equipos; supervisor ve su lista)
  const tipoMap: Record<string, string> = {
    gerente_regional: 'director', gerente_zonal: 'director', admin: 'director',
    supervisor: 'supervisor', asesor: 'supervisor',
  }

  // IDs de los nodos visibles: admin ve todo; el resto, su subárbol
  let subtreeIds: string[] = []
  if (cargo === 'admin') {
    const { data: allNodos } = await sb.from('org_nodos').select('id').eq('activo', true)
    subtreeIds = (allNodos ?? []).map(r => r.id)
  } else if (org_nodo_id) {
    const { data: subtree } = await sb.rpc('org_subtree', { nodo_raiz: org_nodo_id })
    subtreeIds = (subtree ?? []).map((r: { id: string }) => r.id)
  }
  const inIds = subtreeIds.length ? subtreeIds : ['__none__']

  // Metadatos del subárbol: nodos (para el navegador), capas (etiqueta de cargo)
  // y titulares de cada nodo (supervisor/gerente) para mostrar quién lidera cada equipo
  const [{ data: subtreeNodos }, { data: capasData }, { data: orgUsersData }, { data: creds }] = await Promise.all([
    sb.from('org_nodos').select('id, parent_id, nombre, titulo_propio, capa_id').in('id', inIds).eq('activo', true),
    sb.from('org_capas').select('id, nombre_cargo'),
    sb.from('org_usuarios').select('id, nombre, org_nodo_id, cargo, activo').in('org_nodo_id', inIds).eq('activo', true),
    sb.from('asesor_credentials').select('asesor, org_nodo_id').eq('activo', true).in('org_nodo_id', inIds),
  ])

  const capaName: Record<string, string> = {}
  for (const c of capasData ?? []) capaName[c.id] = c.nombre_cargo
  const nodos = (subtreeNodos ?? []).map(n => ({
    id: n.id, parent_id: n.parent_id, nombre: n.nombre,
    titulo_propio: n.titulo_propio,
    cargo_nombre: n.capa_id ? (capaName[n.capa_id] ?? null) : null,
  }))
  const supervisores = (orgUsersData ?? []).map(u => ({
    id: u.id, nombre: u.nombre, org_nodo_id: u.org_nodo_id, cargo: u.cargo,
  }))

  const hijos = nodos.filter(n => n.parent_id === org_nodo_id).length
  const tipo = tipoMap[cargo ?? ''] ?? (hijos > 0 ? 'director' : 'supervisor')

  const asesores = (creds ?? []).map(c => c.asesor)
  if (asesores.length === 0) {
    return NextResponse.json({ tipo, cargo: cargo ?? 'supervisor', rootId: org_nodo_id ?? null, nodos, supervisores, asesores: [] })
  }

  // Último mensaje por asesor
  const { data: lastMsgs } = await sb
    .from('message_log').select('asesor, created_at').in('asesor', asesores)
    .order('created_at', { ascending: false })
  const lastByAsesor: Record<string, string> = {}
  for (const m of lastMsgs ?? []) if (!lastByAsesor[m.asesor]) lastByAsesor[m.asesor] = m.created_at

  // Mensajes últimos 7 días
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data: recentMsgs } = await sb
    .from('message_log').select('asesor').in('asesor', asesores).gte('created_at', since7d)
  const msgCount7d: Record<string, number> = {}
  for (const m of recentMsgs ?? []) msgCount7d[m.asesor] = (msgCount7d[m.asesor] ?? 0) + 1

  const now = Date.now()
  const nodoByAsesor: Record<string, string | null> = {}
  for (const c of creds ?? []) nodoByAsesor[c.asesor] = c.org_nodo_id

  const resultado = asesores.map(asesor => {
    const lastMsg   = lastByAsesor[asesor]
    const daysSince = lastMsg ? Math.floor((now - new Date(lastMsg).getTime()) / 86400_000) : 99
    const msgs7d    = msgCount7d[asesor] ?? 0
    const urgency   = daysSince * 3 + Math.max(0, 7 - msgs7d)
    const nodoId    = nodoByAsesor[asesor] ?? null
    const nodoNombre = nodos.find(n => n.id === nodoId)?.nombre ?? null
    return { asesor, daysSince, msgs7d, urgency, lastMsg: lastMsg ?? null, nodo: nodoNombre, nodo_id: nodoId }
  }).sort((a, b) => b.urgency - a.urgency)

  return NextResponse.json({ tipo, cargo: cargo ?? 'supervisor', rootId: org_nodo_id ?? null, nodos, supervisores, asesores: resultado })
}
