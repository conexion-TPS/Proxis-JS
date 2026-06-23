import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// F4 — Serie de desempeño del equipo del supervisor (N4) para G1 (trayectoria) y G2 (matriz).
// Fuente: RPC indicadores_desempeno_asesor(persona_id, mes, 'indice') — UNA llamada por (asesor, mes).
// CONSOLIDADO DEL EQUIPO por Σnumerador/Σdenominador (NUNCA promedio de ratios); el índice de
// equipo se RECOMPUTA desde los componentes agregados con los mismos pesos de la RPC (F3b).

const PESOS = { hab: 0.40, cal: 0.35, vol: 0.25 } as const  // deben coincidir con la RPC

function mesesRango(desde: string, hasta: string): string[] {
  const out: string[] = []
  let [y, m] = desde.split('-').map(Number)
  const [hy, hm] = hasta.split('-').map(Number)
  while (y < hy || (y === hy && m <= hm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

type IndicadorRPC = {
  persona_id: string; asesor: string; mes: string
  volumen_contactos: number; volumen_meta: number; volumen: number | null
  habito_semanas_cumplidas: number; habito_semanas: number; habito: number | null
  calidad_num: number; calidad_den: number; calidad: number | null
  resultado_obtenido: number | null; resultado_meta: number | null; resultado: number | null
  indice_actividad: number | null; actividad: number | null; cuadrante: string
}

const r4 = (x: number | null) => (x === null ? null : Math.round(x * 10000) / 10000)

function clasificar(indice: number | null, resultado: number | null): string {
  if (indice === null || resultado === null) return 'sin datos'
  if (indice >= 0.50 && resultado >= 0.85) return 'Sólido'
  if (indice >= 0.50 && resultado <  0.85) return 'Revisar técnica'
  if (indice <  0.50 && resultado >= 0.85) return 'Frágil'
  return 'Prioridad disciplina'
}

export async function GET(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sb = supabaseAdmin()
  const q = req.nextUrl.searchParams
  const desde = /^\d{4}-\d{2}$/.test(q.get('desde') ?? '') ? q.get('desde')! : '2026-01'
  const hasta = /^\d{4}-\d{2}$/.test(q.get('hasta') ?? '') ? q.get('hasta')! : '2026-06'
  const meses = mesesRango(desde, hasta)

  // 1) Subárbol del supervisor → asesores (mismo patrón que dashboard/captura-ingreso).
  let nodoIds: string[] = []
  if (session.cargo === 'admin') {
    const { data } = await sb.from('org_nodos').select('id').eq('activo', true)
    nodoIds = (data ?? []).map(r => r.id)
  } else if (session.org_nodo_id) {
    const { data } = await sb.rpc('org_subtree', { nodo_raiz: session.org_nodo_id })
    nodoIds = (data ?? []).map((r: { id: string }) => r.id)
  }
  if (!nodoIds.length) return NextResponse.json({ meses, asesores: [], equipo: [] })

  const { data: creds } = await sb.from('asesor_credentials')
    .select('asesor, org_nodo_id').eq('activo', true).in('org_nodo_id', nodoIds)
  const asesores = [...new Set((creds ?? []).map(c => c.asesor as string))]
  if (!asesores.length) return NextResponse.json({ meses, asesores: [], equipo: [] })

  // 2) Mapeo asesor→persona_id (reuso del patrón de captura-ingreso: nombre + instituciones del subárbol).
  const { data: nodosInst } = await sb.from('org_nodos').select('institucion_id').in('id', nodoIds)
  const instIds = [...new Set((nodosInst ?? []).map(n => n.institucion_id).filter(Boolean))] as string[]
  const { data: personas } = await sb.from('persona')
    .select('id, nombre').eq('tipo', 'asesor').in('nombre', asesores)
    .in('institucion_id', instIds.length ? instIds : ['__none__'])
  const pidPorNombre = new Map<string, string>()
  for (const p of personas ?? []) if (!pidPorNombre.has(p.nombre)) pidPorNombre.set(p.nombre, p.id)

  const roster = asesores
    .map(a => ({ asesor: a, persona_id: pidPorNombre.get(a) ?? null }))
    .filter(r => r.persona_id) as { asesor: string; persona_id: string }[]

  // 3) 36 llamadas (roster × meses) a la RPC EXISTENTE. Sin nueva RPC.
  const resultados = await Promise.all(
    roster.flatMap(r => meses.map(async mes => {
      const { data } = await sb.rpc('indicadores_desempeno_asesor', {
        p_persona_id: r.persona_id, p_mes: mes, p_eje_actividad: 'indice',
      })
      return { asesor: r.asesor, mes, row: (data?.[0] ?? null) as IndicadorRPC | null }
    })),
  )

  // 4) Serie por asesor. Máscara "sin actividad": si no hay reportes ni contactos ese mes,
  //    el índice se reporta null (no 0) para que G1 deje hueco en vez de una línea plana engañosa.
  const porAsesor = new Map<string, { asesor: string; persona_id: string; serie: SerieItem[] }>()
  type SerieItem = { mes: string; indice: number | null; resultado: number | null; cuadrante: string }
  for (const r of roster) porAsesor.set(r.asesor, { asesor: r.asesor, persona_id: r.persona_id, serie: [] })
  for (const x of resultados) {
    const row = x.row
    const hayActividad = !!row && (row.habito_semanas > 0 || row.volumen_contactos > 0)
    porAsesor.get(x.asesor)!.serie.push({
      mes: x.mes,
      indice:    hayActividad ? r4(row!.indice_actividad) : null,
      resultado: r4(row?.resultado ?? null),
      cuadrante: row?.cuadrante ?? 'sin datos',
    })
  }
  for (const a of porAsesor.values()) a.serie.sort((p, q) => p.mes.localeCompare(q.mes))

  // 5) ══════════ CONSOLIDADO DEL EQUIPO — Σnum/Σden (NO promedio de ratios) ══════════
  const equipo = meses.map(mes => {
    const filas = resultados.filter(r => r.mes === mes && r.row).map(r => r.row!) as IndicadorRPC[]
    const sum = (f: (r: IndicadorRPC) => number | null) =>
      filas.reduce((s, r) => s + (Number(f(r)) || 0), 0)

    // Numeradores y denominadores agregados de cada indicador:
    const vol_num = sum(r => r.volumen_contactos),        vol_den = sum(r => r.volumen_meta)
    const hab_num = sum(r => r.habito_semanas_cumplidas), hab_den = sum(r => r.habito_semanas)
    const cal_num = sum(r => r.calidad_num),              cal_den = sum(r => r.calidad_den)
    const res_num = sum(r => r.resultado_obtenido),       res_den = sum(r => r.resultado_meta)

    const ratio = (n: number, d: number) => (d > 0 ? n / d : null)
    const volumen   = ratio(vol_num, vol_den)   // Σcontactos / Σmeta_contactos_mes
    const habito    = ratio(hab_num, hab_den)   // Σsemanas_cumplidas / Σsemanas_con_reporte
    const calidad   = ratio(cal_num, cal_den)   // Σcalidad_num / Σcalidad_den
    const resultado = ratio(res_num, res_den)   // Σingreso_obtenido / Σmeta_ingreso_mes

    // Índice de EQUIPO recomputado desde los componentes agregados (mismos pesos que la RPC).
    const vol_idx = Math.min(volumen ?? 0, 1)
    const hab_idx = habito ?? 0
    let indice: number | null
    if (filas.length === 0 || (hab_den === 0 && vol_num === 0)) indice = null            // sin actividad → hueco
    else if (calidad === null) indice = (PESOS.hab * hab_idx + PESOS.vol * vol_idx) / (PESOS.hab + PESOS.vol) // renormaliza
    else indice = PESOS.hab * hab_idx + PESOS.cal * calidad + PESOS.vol * vol_idx

    return {
      mes, n_asesores: filas.length,
      indice: r4(indice), resultado: r4(resultado),
      volumen: r4(volumen), habito: r4(habito), calidad: r4(calidad),
      // num/den expuestos para auditar la agregación desde el front si hace falta
      num_den: { vol_num, vol_den, hab_num, hab_den, cal_num, cal_den, res_num, res_den },
      cuadrante: clasificar(indice, resultado),
    }
  })

  return NextResponse.json({
    meses, nodo: session.org_nodo_id ?? null,
    asesores: [...porAsesor.values()],
    equipo,
  })
}
