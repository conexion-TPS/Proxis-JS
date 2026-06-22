import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'
import { asesorEnSubarbol } from '@/lib/equipoSubarbol'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// F2b — Captura mensual del ingreso por el supervisor (portal /equipo, NO Sailor).
// Semántica: a inicio de M se informa M-1 (mes cerrado). El default es M-1; se puede pedir
// cualquier 'YYYY-MM' (en el banco, ej. 2026-05).

// Mes anterior (M-1) en horario Chile (UTC-3).
function mesAnterior(): string {
  const chile = new Date(Date.now() - 3 * 3600_000)
  const mi = chile.getUTCMonth()                 // 0-11 del mes ACTUAL
  const py = mi === 0 ? chile.getUTCFullYear() - 1 : chile.getUTCFullYear()
  const pm = mi === 0 ? 12 : mi                  // 1-based del mes ANTERIOR
  return `${py}-${String(pm).padStart(2, '0')}`
}

const ES_MES = (s: string | null): s is string => !!s && /^\d{4}-\d{2}$/.test(s)

// ── GET ?mes=YYYY-MM → la COLA del supervisor: un ítem por asesor de SU SUBÁRBOL (org_subtree),
//    no de toda la institución. Estado derivado: 'respondida' (hay fila histórico para el mes)
//    o 'pendiente'. Sin tabla de estado.
export async function GET(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sb  = supabaseAdmin()
  const mes = ES_MES(req.nextUrl.searchParams.get('mes')) ? req.nextUrl.searchParams.get('mes')! : mesAnterior()

  // 1) IDs del SUBÁRBOL del supervisor (mismo patrón que /api/equipo/dashboard y el roster):
  //    admin ve todo; el resto, su org_subtree. Fail-closed.
  let nodoIds: string[] = []
  if (session.cargo === 'admin') {
    const { data } = await sb.from('org_nodos').select('id').eq('activo', true)
    nodoIds = (data ?? []).map(r => r.id)
  } else if (session.org_nodo_id) {
    const { data } = await sb.rpc('org_subtree', { nodo_raiz: session.org_nodo_id })
    nodoIds = (data ?? []).map((r: { id: string }) => r.id)
  }
  if (!nodoIds.length) return NextResponse.json({ mes, items: [] })

  // 2) Asesores activos del subárbol.
  const { data: creds } = await sb.from('asesor_credentials')
    .select('asesor, org_nodo_id').eq('activo', true).in('org_nodo_id', nodoIds)
  const asesores = (creds ?? []).map(c => c.asesor as string)
  if (!asesores.length) return NextResponse.json({ mes, items: [] })

  // 3) persona_id de cada asesor (la captura keyea por persona_id). Por nombre + instituciones
  //    del subárbol (evita homónimos de otra empresa).
  const { data: nodosInst } = await sb.from('org_nodos').select('institucion_id').in('id', nodoIds)
  const instIds = [...new Set((nodosInst ?? []).map(n => n.institucion_id).filter(Boolean))] as string[]
  const { data: personas } = await sb.from('persona')
    .select('id, nombre').eq('tipo', 'asesor').in('nombre', asesores)
    .in('institucion_id', instIds.length ? instIds : ['__none__'])
  const personaIdPorNombre = new Map<string, string>()
  for (const p of personas ?? []) if (!personaIdPorNombre.has(p.nombre)) personaIdPorNombre.set(p.nombre, p.id)

  // 4) Histórico ya informado para ese mes (= 'respondida').
  const { data: hist } = await sb.from('historico_cumplimiento_ingreso')
    .select('asesor, ingreso_obtenido, meta_ingreso_mes, cumplio, diferencia')
    .eq('mes', mes).in('asesor', asesores)
  const histPorAsesor = new Map((hist ?? []).map(h => [h.asesor as string, h]))

  // 5) Ítems de la cola.
  const items = asesores.map(asesor => {
    const h = histPorAsesor.get(asesor)
    return {
      asesor,
      persona_id: personaIdPorNombre.get(asesor) ?? null,   // null → no se puede capturar (falta persona)
      estado: h ? 'respondida' : 'pendiente',
      ingreso_obtenido: h?.ingreso_obtenido ?? null,
      meta_ingreso_mes: h?.meta_ingreso_mes ?? null,
      cumplio:          h?.cumplio ?? null,
      diferencia:       h?.diferencia ?? null,
    }
  }).sort((a, b) => (a.estado === b.estado ? a.asesor.localeCompare(b.asesor) : a.estado === 'pendiente' ? -1 : 1))

  return NextResponse.json({ mes, items })
}

// ── POST { persona_id, mes, ingreso_obtenido } → captura idempotente.
//    Autorización horizontal: el asesor debe estar en el SUBÁRBOL del supervisor.
//    IDEMPOTENCIA: NO se hace ningún insert manual acá — se delega TODO en la RPC
//    guardar_ingreso_mes, que upserta por (persona_id, mes) con ON CONFLICT DO UPDATE.
//    ⇒ re-informar el mismo asesor/mes SOBREESCRIBE la fila, no la duplica.
export async function POST(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { persona_id, mes, ingreso_obtenido } = await req.json().catch(() => ({}))
  if (!persona_id || !ES_MES(mes) || typeof ingreso_obtenido !== 'number' || ingreso_obtenido < 0)
    return NextResponse.json({ error: 'persona_id, mes (YYYY-MM) e ingreso_obtenido (>=0) requeridos' }, { status: 400 })

  const sb = supabaseAdmin()

  // Resolver el nombre del asesor y validar que esté en el subárbol del supervisor.
  const { data: persona } = await sb.from('persona').select('nombre').eq('id', persona_id).maybeSingle()
  if (!persona) return NextResponse.json({ error: 'persona no encontrada' }, { status: 404 })
  if (!await asesorEnSubarbol(sb, session, persona.nombre as string))
    return NextResponse.json({ error: 'Asesor fuera de tu equipo' }, { status: 403 })

  // Doble escritura atómica (histórico + ingresos) en la RPC. Upsert por (persona_id, mes).
  const { data, error } = await sb.rpc('guardar_ingreso_mes', {
    p_persona_id:    persona_id,
    p_mes:           mes,
    p_monto:         ingreso_obtenido,
    p_informado_por: session.nombre,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data && (data as { ok?: boolean }).ok === false)
    return NextResponse.json({ error: (data as { error?: string }).error ?? 'No se pudo guardar' }, { status: 400 })

  return NextResponse.json(data)
}
