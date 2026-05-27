import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'

export async function GET(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sb = supabaseAdmin()
  const { org_nodo_id } = session

  // Get all nodo IDs in this supervisor's subtree
  let subtreeIds: string[] = []
  if (org_nodo_id) {
    const { data: subtree } = await sb.rpc('org_subtree', { nodo_raiz: org_nodo_id })
    subtreeIds = (subtree ?? []).map((r: { id: string }) => r.id)
  }

  // Direct child nodos (to detect if this is a director-level view)
  const { data: childNodos } = await sb
    .from('org_nodos')
    .select('id, nombre, titulo_propio')
    .eq('parent_id', org_nodo_id ?? '')
    .eq('activo', true)

  // Asesores in subtree
  const { data: creds } = await sb
    .from('asesor_credentials')
    .select('asesor, org_nodo_id')
    .eq('activo', true)
    .in('org_nodo_id', subtreeIds.length ? subtreeIds : ['__none__'])

  const asesores = (creds ?? []).map(c => c.asesor)

  if (asesores.length === 0) {
    return NextResponse.json({ tipo: 'supervisor', asesores: [], equipos: [] })
  }

  // Last message per asesor
  const { data: lastMsgs } = await sb
    .from('message_log')
    .select('asesor, created_at')
    .in('asesor', asesores)
    .order('created_at', { ascending: false })

  const lastByAsesor: Record<string, string> = {}
  for (const m of lastMsgs ?? []) {
    if (!lastByAsesor[m.asesor]) lastByAsesor[m.asesor] = m.created_at
  }

  // Message count last 7 days
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data: recentMsgs } = await sb
    .from('message_log')
    .select('asesor')
    .in('asesor', asesores)
    .gte('created_at', since7d)

  const msgCount7d: Record<string, number> = {}
  for (const m of recentMsgs ?? []) msgCount7d[m.asesor] = (msgCount7d[m.asesor] ?? 0) + 1

  // Unprocessed behavioral signals per asesor
  const { data: signals } = await sb
    .from('behavioral_signals')
    .select('asesor')
    .in('asesor', asesores)
    .eq('procesada', false)

  const signalCount: Record<string, number> = {}
  for (const s of signals ?? []) signalCount[s.asesor] = (signalCount[s.asesor] ?? 0) + 1

  const now = Date.now()

  const resultado = asesores.map(asesor => {
    const lastMsg     = lastByAsesor[asesor]
    const daysSince   = lastMsg ? Math.floor((now - new Date(lastMsg).getTime()) / 86400_000) : 99
    const msgs7d      = msgCount7d[asesor] ?? 0
    const signals7d   = signalCount[asesor] ?? 0
    const urgency     = daysSince * 3 + signals7d * 2 + Math.max(0, 7 - msgs7d)

    const nodoId = creds?.find(c => c.asesor === asesor)?.org_nodo_id
    const nodoNombre = (childNodos ?? []).find(n => n.id === nodoId)?.nombre ?? null

    return { asesor, daysSince, msgs7d, signals7d, urgency, lastMsg: lastMsg ?? null, nodo: nodoNombre }
  }).sort((a, b) => b.urgency - a.urgency)

  // If this supervisor manages child nodos (director view), also aggregate by equipo
  let equipos: { nodo: string; nodo_id: string; total: number; urgenciaPromedio: number }[] = []
  if ((childNodos ?? []).length > 0) {
    const byNodo: Record<string, typeof resultado> = {}
    for (const r of resultado) {
      const nodoId = creds?.find(c => c.asesor === r.asesor)?.org_nodo_id ?? '__none__'
      if (!byNodo[nodoId]) byNodo[nodoId] = []
      byNodo[nodoId].push(r)
    }
    equipos = (childNodos ?? []).map(n => {
      const miembros = byNodo[n.id] ?? []
      return {
        nodo: n.titulo_propio ?? n.nombre,
        nodo_id: n.id,
        total: miembros.length,
        urgenciaPromedio: miembros.length
          ? Math.round(miembros.reduce((s, m) => s + m.urgency, 0) / miembros.length)
          : 0,
      }
    }).sort((a, b) => b.urgenciaPromedio - a.urgenciaPromedio)
  }

  const tipo = (childNodos ?? []).length > 0 && resultado.some(r => r.nodo) ? 'director' : 'supervisor'
  return NextResponse.json({ tipo, asesores: resultado, equipos })
}
