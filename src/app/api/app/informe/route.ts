import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * GET /api/app/informe?mes=YYYY-MM
 * "Mi Informe" (solo tarjetas KPI) — lee de proxis_dev por persona_id (NO por nombre, NO Viña).
 * KPIs calculados server-side (portado fiel de calcIndicadores() del legacy).
 */

const DEFAULT_META = { meta_contactos_semana: 3, meta_prospectos_mes: 15, meta_ventas_mes: 5, meta_ingresos: 2_000_000 }
const MESES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function mesSiguiente(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

type Contacto = { vinculo: string | null; llamo: boolean; reunion: boolean; prospectos: number }
type Reporte = { id: string; semana_inicio: string; confirmado: boolean; contactos: Contacto[] }

// ── Portado fiel de calcIndicadores() (plataforma-core.js). Incluye "semanas fantasma"
//    (lunes del mes ya pasados sin reporte) para que semanasCount = paridad con el legacy. ──
function calcKpis(reportes: Reporte[], mes: string) {
  const _SEM1 = new Date('2026-03-30')
  const semNum = (fechaISO: string) => Math.round((+new Date(fechaISO) - +_SEM1) / (7 * 24 * 60 * 60 * 1000)) + 1
  function getLunesDelMes(mesISO: string): string[] {
    if (!mesISO) return []
    const [y, m] = mesISO.split('-').map(Number)
    const lunes: string[] = []
    const primerDia = new Date(y, m - 1, 1)
    const dow = primerDia.getDay() // 0=Dom
    const daysBack = dow === 0 ? 6 : dow - 1
    let d = new Date(y, m - 1, 1 - daysBack)
    while (d < new Date(y, m, 1)) {
      lunes.push(d.toISOString().split('T')[0])
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
    }
    return lunes
  }

  const mesISO = mes || reportes[0]?.semana_inicio?.slice(0, 7) || ''
  const repPorFecha: Record<string, Reporte> = {}
  reportes.forEach((r) => { repPorFecha[r.semana_inicio] = r })

  const hoy = new Date()
  const lunesHoyISO = new Date().toISOString().split('T')[0]
  const lunesDelMes = getLunesDelMes(mesISO)
  const fuentes = lunesDelMes.length > 0
    ? lunesDelMes
        .filter((f) => {
          const esPasado = new Date(f) <= hoy
          const esHoySinReporte = f === lunesHoyISO && !repPorFecha[f]
          return esPasado && !esHoySinReporte
        })
        .map((fecha) => ({ esFantasma: !repPorFecha[fecha], reporte: repPorFecha[fecha] ?? null, fecha }))
    : reportes.map((r) => ({ esFantasma: false, reporte: r, fecha: r.semana_inicio }))

  const semanas = fuentes.map(({ esFantasma, reporte, fecha }) => {
    if (esFantasma || !reporte) {
      return { semana: semNum(fecha), fecha, contactos: 0, reuniones: 0, prospectos: 0, potencial: 0, prom: 0, esFantasma: true, confirmado: false, vinc: {} as Record<string, number> }
    }
    const cs = reporte.contactos || []
    const contactos = cs.length
    const reuniones = cs.filter((c) => c.reunion).length
    const prospectos = cs.reduce((a, c) => a + (c.prospectos || 0), 0)
    const vinc: Record<string, number> = {}
    cs.forEach((c) => { const v = c.vinculo || '—'; vinc[v] = (vinc[v] || 0) + (c.prospectos || 0) })
    return {
      semana: semNum(reporte.semana_inicio), fecha: reporte.semana_inicio,
      contactos, reuniones, prospectos, potencial: contactos * 5,
      prom: contactos ? +(prospectos / contactos).toFixed(1) : 0,
      esFantasma: false, confirmado: reporte.confirmado, vinc,
    }
  })

  const totC = semanas.reduce((a, s) => a + s.contactos, 0)
  const totR = semanas.reduce((a, s) => a + s.reuniones, 0)
  const totP = semanas.reduce((a, s) => a + s.prospectos, 0)
  const totPot = semanas.reduce((a, s) => a + s.potencial, 0)
  const vincAcum: Record<string, number> = {}
  semanas.forEach((s) => Object.entries(s.vinc).forEach(([v, n]) => { vincAcum[v] = (vincAcum[v] || 0) + n }))
  const mejorV = Object.entries(vincAcum).sort((a, b) => b[1] - a[1])[0] ?? null

  return {
    semanasCount: semanas.length,
    totC, totR, totP, totPot,
    promG: totC ? +(totP / totC).toFixed(1) : 0,
    tasaReu: totC ? Math.round((totR / totC) * 100) : 0,
    efic: totPot ? Math.round((totP / totPot) * 100) : 0,
    brecha: totPot - totP,
    prospReu: totR ? +(totP / totR).toFixed(1) : 0,
    mejorV: mejorV as [string, number] | null,
    // Datos por-semana (tabla "Evolución semanal") y acumulado por vínculo (card "Productividad").
    // Se EXPONEN tal cual los computa este mismo cálculo; los agregados KPI de arriba no cambian.
    semanas: semanas.map((s) => ({
      semana: s.semana, fecha: s.fecha, contactos: s.contactos, reuniones: s.reuniones,
      prospectos: s.prospectos, potencial: s.potencial, prom: s.prom,
      esFantasma: s.esFantasma, confirmado: s.confirmado,
    })),
    vincAcum,
  }
}

export async function GET(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })

  const mes = new URL(req.url).searchParams.get('mes') || mesActual()
  const nextM = mesSiguiente(mes)
  const sb = supabaseAdmin()

  // META — por persona_id (defaults si no hay fila; Consorcio aún no tiene metas migradas)
  const { data: metaRows } = await sb
    .from('metas')
    .select('meta_contactos_semana, meta_prospectos_mes, meta_ventas_mes, meta_ingresos')
    .eq('persona_id', id.persona_id)
    .limit(1)
  const meta = metaRows?.[0] ?? DEFAULT_META

  // REPORTES del mes — por persona_id. (semana_inicio es TEXT ISO → rango por string es válido.)
  const { data: repRows } = await sb
    .from('reportes')
    .select('id, semana_inicio, semana_num, confirmado, sin_actividad')
    .eq('persona_id', id.persona_id)
    .gte('semana_inicio', `${mes}-01`)
    .lt('semana_inicio', `${nextM}-01`)
    .order('semana_inicio', { ascending: true })
  const reportes = repRows ?? []

  const identidad = { nombre: id.nombre, institucion: id.institucion_nombre, via: id.via, tipo: id.tipo }

  if (reportes.length === 0) {
    return NextResponse.json({ mes, hasReportes: false, semanasCount: 0, identidad })
  }

  // CONTACTOS de esos reportes — por reporte_id (los reportes ya están acotados a la persona)
  const repIds = reportes.map((r) => r.id)
  const { data: conRows } = await sb
    .from('contactos')
    .select('reporte_id, vinculo, llamo, reunion, prospectos')
    .in('reporte_id', repIds)
  const porReporte: Record<string, Contacto[]> = {}
  for (const c of conRows ?? []) (porReporte[c.reporte_id] ??= []).push(c)
  const reportesConContactos: Reporte[] = reportes.map((r) => ({
    id: r.id, semana_inicio: r.semana_inicio, confirmado: r.confirmado, contactos: porReporte[r.id] ?? [],
  }))

  // INGRESO del mes — por persona_id + mes
  const { data: ingRows } = await sb
    .from('ingresos')
    .select('ingreso_real')
    .eq('persona_id', id.persona_id)
    .eq('mes', mes)
    .limit(1)
  const ingreso = ingRows?.[0]?.ingreso_real ?? 0

  // ── NODOS (card "Nodos activos") — datos all-time por persona_id (calco de getNodos + getNodosChartData) ──
  const { data: nodoRows } = await sb
    .from('nodos')
    .select('nombre, activaciones, total_prospectos, fecha_conversion')
    .eq('persona_id', id.persona_id)
    .order('activaciones', { ascending: false })
  const nodoLista = (nodoRows ?? []).map((n) => ({
    nombre: n.nombre as string,
    activaciones: (n.activaciones as number) ?? 0,
    total_prospectos: (n.total_prospectos as number) ?? 0,
    fecha_conversion: (n.fecha_conversion as string | null) ?? null,
  }))

  const { data: actRows } = await sb
    .from('activaciones_nodo')
    .select('semana_inicio, nodo_id, prospectos')
    .eq('persona_id', id.persona_id)
    .order('semana_inicio', { ascending: true })

  // Agregación mensual del gráfico. repByMonth se arma SOLO con los reportes del mes seleccionado
  // (matiz exacto del legacy: loadNodosEnInforme recibe los reportes del mes).
  const byMes: Record<string, { nodos: Set<string>; prospNodos: number }> = {}
  for (const a of actRows ?? []) {
    const mo = (a.semana_inicio as string | null)?.slice(0, 7); if (!mo) continue
    if (!byMes[mo]) byMes[mo] = { nodos: new Set(), prospNodos: 0 }
    byMes[mo].nodos.add(a.nodo_id as string)
    byMes[mo].prospNodos += (a.prospectos as number) ?? 0
  }
  const repByMonth: Record<string, number> = {}
  for (const r of reportesConContactos) {
    const mo = r.semana_inicio.slice(0, 7)
    repByMonth[mo] = (repByMonth[mo] ?? 0) + r.contactos.reduce((s, c) => s + (c.prospectos || 0), 0)
  }
  const mesesNodos = Object.keys(byMes).sort()
  let acumN = 0
  const nLabels: string[] = [], dAcum: number[] = [], dNuevos: number[] = [], dProspNodos: number[] = [], dProspTotal: number[] = [], dPct: number[] = []
  for (const mo of mesesNodos) {
    const nuevos = byMes[mo].nodos.size
    acumN += nuevos
    const prospNodos = byMes[mo].prospNodos
    const prospTotal = repByMonth[mo] ?? 0
    dAcum.push(acumN); dNuevos.push(nuevos); dProspNodos.push(prospNodos); dProspTotal.push(prospTotal)
    dPct.push(prospTotal > 0 ? Math.round((prospNodos / prospTotal) * 100) : 0)
    const [y, mm] = mo.split('-')
    nLabels.push(MESES_NOM[parseInt(mm) - 1].slice(0, 3) + ' ' + y.slice(2))
  }
  const nodos = {
    count: nodoLista.length,
    totalActs: nodoLista.reduce((s, n) => s + n.activaciones, 0),
    totalProsp: nodoLista.reduce((s, n) => s + n.total_prospectos, 0),
    ultPct: dPct.length ? dPct[dPct.length - 1] : 0,
    lista: nodoLista,
    chart: { labels: nLabels, dAcum, dNuevos, dProspNodos, dProspTotal, dPct },
  }

  const k = calcKpis(reportesConContactos, mes)
  const metaP = Math.max(meta.meta_prospectos_mes || 15, 5)
  const avMes = Math.round((k.totP / metaP) * 100)
  const avC = meta.meta_contactos_semana && k.semanasCount
    ? Math.round((k.totC / (meta.meta_contactos_semana * k.semanasCount)) * 100)
    : null
  const avIng = ingreso && meta.meta_ingresos ? Math.round((ingreso / meta.meta_ingresos) * 100) : null

  return NextResponse.json({
    mes,
    hasReportes: true,
    semanasCount: k.semanasCount,
    identidad,
    meta,
    ingreso,
    kpis: {
      totC: k.totC, totR: k.totR, totP: k.totP, totPot: k.totPot,
      promG: k.promG, tasaReu: k.tasaReu, efic: k.efic, brecha: k.brecha,
      prospReu: k.prospReu, mejorV: k.mejorV,
    },
    semanas: k.semanas,
    vincAcum: k.vincAcum,
    nodos,
    avances: { avMes, avC, avIng },
  })
}
