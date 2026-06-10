import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * GET /api/app/equipo?mes=YYYY-MM&periodos=N
 * Tracker supervisor — panel "Equipo completo". Lee proxis_dev por institucion_id
 * (NO Viña, NO empQ), roster = persona(tipo='asesor') de la institución.
 * KPIs/gaps/tabla/gráficos calculados server-side: transcripción literal de
 * calcIndicadores() + los derivados de equipo de renderEquipo() (plataforma-core.js).
 * READ-ONLY (el panel Equipo completo no escribe; guardarMeta es huérfano — ver DISENO).
 * Espeja el patrón de /api/app/informe.
 */

const DEFAULT_META = { meta_contactos_semana: 3, meta_prospectos_mes: 15, meta_ventas_mes: 5, meta_ingresos: 2_000_000 }
const MESES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const getMesLabel = (m: string) => { const [y, mo] = m.split('-'); return `${MESES_NOM[parseInt(mo) - 1]} ${y}` }
const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

type Contacto = { vinculo: string | null; llamo: boolean; reunion: boolean; prospectos: number }
type Reporte = { id: string; persona_id: string; semana_inicio: string; confirmado: boolean; contactos: Contacto[] }

// ── Transcripción literal de calcIndicadores() (plataforma-core.js:374-437). PURA, sin DOM.
//    Incluye "semanas fantasma" (lunes del mes ya pasados sin reporte). ──
function calcIndicadores(reportes: Reporte[], mes: string) {
  const _SEM1 = new Date('2026-03-30')
  const semNum = (fechaISO: string) => Math.round((+new Date(fechaISO) - +_SEM1) / (7 * 24 * 60 * 60 * 1000)) + 1
  function getLunesDelMes(mesISO: string): string[] {
    if (!mesISO) return []
    const [y, m] = mesISO.split('-').map(Number)
    const lunes: string[] = []
    const primerDia = new Date(y, m - 1, 1)
    const dow = primerDia.getDay()
    const daysBack = dow === 0 ? 6 : dow - 1
    let d = new Date(y, m - 1, 1 - daysBack)
    while (d < new Date(y, m, 1)) { lunes.push(d.toISOString().split('T')[0]); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) }
    return lunes
  }
  const mesISO = mes || reportes[0]?.semana_inicio?.slice(0, 7) || ''
  const repPorFecha: Record<string, Reporte> = {}
  reportes.forEach((r) => { repPorFecha[r.semana_inicio] = r })
  const hoy = new Date()
  const lunesHoyISO = new Date().toISOString().split('T')[0]
  const lunesDelMes = getLunesDelMes(mesISO)
  const fuentes = lunesDelMes.length > 0
    ? lunesDelMes.filter((f) => {
        const esPasado = new Date(f) <= hoy
        const esHoySinReporte = f === lunesHoyISO && !repPorFecha[f]
        return esPasado && !esHoySinReporte
      }).map((fecha) => ({ esFantasma: !repPorFecha[fecha], reporte: repPorFecha[fecha] ?? null, fecha }))
    : reportes.map((r) => ({ esFantasma: false, reporte: r, fecha: r.semana_inicio }))
  const semanas = fuentes.map(({ esFantasma, reporte, fecha }) => {
    if (esFantasma || !reporte) {
      return { semana: semNum(fecha), fecha, contactos: 0, reuniones: 0, prospectos: 0, potencial: 0, prom: 0, esFantasma: true }
    }
    const cs = reporte.contactos || []
    const contactos = cs.length
    const reuniones = cs.filter((c) => c.reunion).length
    const prospectos = cs.reduce((a, c) => a + (c.prospectos || 0), 0)
    return {
      semana: semNum(reporte.semana_inicio), fecha: reporte.semana_inicio,
      contactos, reuniones, prospectos, potencial: contactos * 5,
      prom: contactos ? +(prospectos / contactos).toFixed(1) : 0, esFantasma: false,
    }
  })
  const totC = semanas.reduce((a, s) => a + s.contactos, 0)
  const totR = semanas.reduce((a, s) => a + s.reuniones, 0)
  const totP = semanas.reduce((a, s) => a + s.prospectos, 0)
  const totPot = semanas.reduce((a, s) => a + s.potencial, 0)
  return {
    semanas, totC, totR, totP, totPot,
    promG: totC ? +(totP / totC).toFixed(1) : 0,
    efic: totPot ? Math.round((totP / totPot) * 100) : 0,
    brecha: totPot - totP,
  }
}

export async function GET(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })
  // Gate de supervisor (calco del legacy /api/vina/equipo: rol==='supervisor'). persona.tipo: 'asesor' | 'mando'.
  if (id.tipo === 'asesor') return NextResponse.json({ error: 'Solo supervisores' }, { status: 403 })

  const url = new URL(req.url)
  const mes = url.searchParams.get('mes') || mesActual()
  const periodos = Math.max(1, parseInt(url.searchParams.get('periodos') || '1'))
  const sb = supabaseAdmin()

  // Rango de meses (calco renderEquipo:1785-1793)
  const [y, m] = mes.split('-').map(Number)
  const meses: string[] = []
  for (let i = periodos - 1; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const mesInicio = meses[0] + '-01'
  const [yF, mF] = meses[meses.length - 1].split('-').map(Number)
  const mesFin = mF === 12 ? `${yF + 1}-01-01` : `${yF}-${String(mF + 1).padStart(2, '0')}-01`

  // Roster = personas asesor de la institución (calco de roster(); NO Viña)
  const { data: roster } = await sb.from('persona')
    .select('id, nombre').eq('institucion_id', id.institucion_id).eq('tipo', 'asesor').eq('activo', true)
    .order('nombre', { ascending: true })
  const asesores = roster ?? []

  // BULK por institucion_id
  const { data: repRows } = await sb.from('reportes')
    .select('id, persona_id, semana_inicio, confirmado')
    .eq('institucion_id', id.institucion_id).gte('semana_inicio', mesInicio).lt('semana_inicio', mesFin)
    .order('semana_inicio', { ascending: true })
  const reportes = repRows ?? []
  const repIds = reportes.map((r) => r.id)

  let contactos: { reporte_id: string; vinculo: string | null; llamo: boolean; reunion: boolean; prospectos: number }[] = []
  if (repIds.length > 0) {
    const { data } = await sb.from('contactos').select('reporte_id, vinculo, llamo, reunion, prospectos').in('reporte_id', repIds)
    contactos = data ?? []
  }
  const porReporte: Record<string, Contacto[]> = {}
  for (const c of contactos) (porReporte[c.reporte_id] ??= []).push(c)
  const reportesC: Reporte[] = reportes.map((r) => ({ id: r.id, persona_id: r.persona_id, semana_inicio: r.semana_inicio, confirmado: r.confirmado, contactos: porReporte[r.id] ?? [] }))

  const { data: metaRows } = await sb.from('metas').select('persona_id, meta_contactos_semana, meta_prospectos_mes, meta_ventas_mes, meta_ingresos').eq('institucion_id', id.institucion_id)
  const metaMap: Record<string, typeof DEFAULT_META> = {}
  for (const mm of metaRows ?? []) if (mm.persona_id) metaMap[mm.persona_id] = mm as unknown as typeof DEFAULT_META

  const { data: ingRows } = await sb.from('ingresos').select('persona_id, mes, ingreso_real').eq('institucion_id', id.institucion_id).gte('mes', meses[0]).lte('mes', meses[meses.length - 1])
  const ingMap: Record<string, Record<string, number>> = {}
  for (const ig of ingRows ?? []) { if (!ig.persona_id) continue; (ingMap[ig.persona_id] ??= {})[ig.mes] = ig.ingreso_real || 0 }

  const { data: nodoRows } = await sb.from('nodos').select('persona_id').eq('institucion_id', id.institucion_id)
  const nodosPorPersona: Record<string, number> = {}
  for (const n of nodoRows ?? []) if (n.persona_id) nodosPorPersona[n.persona_id] = (nodosPorPersona[n.persona_id] || 0) + 1
  const teamNodos = (nodoRows ?? []).length

  const { data: actRows } = await sb.from('activaciones_nodo').select('semana_inicio, nodo_id, prospectos').eq('institucion_id', id.institucion_id).order('semana_inicio', { ascending: true })

  // ── Stats por asesor (calco renderEquipo:1827-1837) ──
  const asesorStats = asesores.map((a) => {
    const reps = reportesC.filter((r) => r.persona_id === a.id)
    const meta = metaMap[a.id] || DEFAULT_META
    const { semanas, totC, totR, totP, totPot, promG, efic, brecha } = calcIndicadores(reps, meses[0])
    const sinReporte = semanas.filter((s) => s.contactos === 0).length
    const ingrTot = meses.reduce((s, mo) => s + ((ingMap[a.id] || {})[mo] || 0), 0)
    const metaIng = (meta.meta_ingresos || 2_000_000) * periodos
    const metaCont = (meta.meta_contactos_semana || 3) * meses.length * 4
    const metaP = Math.max(meta.meta_prospectos_mes || 15, 5)
    const avMes = metaP ? Math.round(totP / (metaP * meses.length) * 100) : 0
    return { nombre: a.nombre, totC, totR, totP, totPot, promG, efic, brecha, sinReporte, ingrTot, metaIng, metaCont, avMes, nodos: nodosPorPersona[a.id] || 0 }
  })

  // ── Totales de equipo + índice (calco renderEquipo:1840-1855) ──
  const teamC = asesorStats.reduce((s, x) => s + x.totC, 0)
  const teamP = asesorStats.reduce((s, x) => s + x.totP, 0)
  const teamPot = asesorStats.reduce((s, x) => s + x.totPot, 0)
  const teamSR = asesorStats.reduce((s, x) => s + x.sinReporte, 0)
  const teamMetaC = asesorStats.reduce((s, x) => s + x.metaCont, 0)
  const teamGapC = teamC - teamMetaC
  const teamGapP = teamP - teamPot
  const teamPromG = teamC ? +(teamP / teamC).toFixed(1) : 0
  const teamPromGap = +(teamPromG - 5).toFixed(1)
  const totalPossible = asesores.length * meses.length * 4
  const indice = Math.round(
    (Math.min(teamC / Math.max(teamPot / 5, 1), 1) * 40) +
    (Math.min(teamPromG / 5, 1) * 40) +
    (totalPossible > 0 ? (totalPossible - teamSR) / totalPossible * 20 : 0)
  )
  const periodoLabel = periodos === 1 ? getMesLabel(mes) : `${getMesLabel(meses[0])} – ${getMesLabel(mes)}`

  // ── KPIs[5] (calco renderEquipo:1865-1873) ──
  const kpis = [
    { lbl: 'Prospectos reales', val: teamP, sub: `${meses.length} mes${meses.length > 1 ? 'es' : ''} · ${asesores.length} asesores`, cls: '' },
    { lbl: 'Contactos totales', val: teamC, sub: 'Potencial de red activada', cls: '' },
    { lbl: 'Prom. prosp./contacto', val: teamPromG, sub: 'Meta: 5.0 por contacto', cls: teamPromG >= 4 ? 'ok' : teamPromG >= 2.5 ? 'warn' : 'bad' },
    { lbl: '✦ Nodos equipo', val: teamNodos, sub: `en ${asesores.length} asesores`, cls: 'nodos' },
    { lbl: 'Índice efectividad', val: `${indice}/100`, sub: 'Actividad + P/C + cobertura', cls: indice >= 60 ? 'ok' : indice >= 40 ? 'warn' : 'bad', thermo: true },
  ]

  // ── Gaps[4] (calco renderEquipo:1882-1885) ──
  const gaps = [
    { lbl: 'Gap prospectos', val: teamGapP, sub: `Real ${teamP} vs potencial ${teamPot}`, desc: 'Prospectos no obtenidos' },
    { lbl: 'Gap contactos', val: teamGapC, sub: `Real ${teamC} vs meta ${teamMetaC}`, desc: 'Contactos bajo la meta' },
    { lbl: 'Gap P/C promedio', val: teamPromGap.toFixed(1), sub: `Real ${teamPromG} vs meta 5.0`, desc: 'Calidad de solicitud de referidos' },
    { lbl: 'Sem. sin reporte', val: teamSR, sub: `de ${totalPossible} posibles (${totalPossible > 0 ? Math.round(teamSR / totalPossible * 100) : 0}%)`, desc: 'Inactividad documentada' },
  ]

  // ── Filas de la tabla (valores crudos; las pills/colores son presentación en T2b) ──
  const filas = asesorStats.map((s) => ({
    nombre: s.nombre, totC: s.totC, gapC: s.totC - s.metaCont, totP: s.totP, brecha: s.brecha,
    promG: s.promG, avMes: s.avMes, nodos: s.nodos, ingrTot: s.ingrTot, metaIng: s.metaIng,
    gapIng: s.ingrTot - s.metaIng, sinReporte: s.sinReporte,
  }))

  // ── Gráfico tendencia mensual (calco renderEquipo:2010-2013) ──
  const tendLabels = meses.map((mo) => getMesLabel(mo).split(' ')[0])
  const trendC = meses.map((mo) => reportesC.filter((r) => r.semana_inicio?.startsWith(mo)).reduce((s, r) => s + (r.contactos?.length || 0), 0))
  const trendP = meses.map((mo) => reportesC.filter((r) => r.semana_inicio?.startsWith(mo)).reduce((s, r) => s + (r.contactos || []).reduce((x, c) => x + (c.prospectos || 0), 0), 0))
  const trendPC = trendC.map((c, i) => (c ? +(trendP[i] / c).toFixed(1) : 0))

  // ── Gráfico ranking (calco renderEquipo:2028-2032) ──
  const ranking = [...asesorStats].sort((a, b) => b.totP - a.totP).map((s) => ({
    name: s.nombre.split(' ')[0] + ' ' + ((s.nombre.split(' ')[1] || '').charAt(0) + '.' || ''),
    val: s.totP, sinDatos: s.totP === 0,
  }))

  // ── Gráfico nodos del equipo (calco renderEquipo:1974-1999) ──
  const byMes: Record<string, { nodos: Set<string>; prospNodos: number }> = {}
  for (const a of actRows ?? []) {
    const mo = (a.semana_inicio as string | null)?.slice(0, 7); if (!mo) continue
    if (!byMes[mo]) byMes[mo] = { nodos: new Set(), prospNodos: 0 }
    byMes[mo].nodos.add(a.nodo_id as string); byMes[mo].prospNodos += (a.prospectos as number) || 0
  }
  const repByMonth: Record<string, number> = {}
  for (const r of reportesC) { const mo = r.semana_inicio.slice(0, 7); repByMonth[mo] = (repByMonth[mo] || 0) + r.contactos.reduce((s, c) => s + (c.prospectos || 0), 0) }
  const mesesNodos = Object.keys(byMes).sort()
  let ac = 0
  const nLabels: string[] = [], dAcum: number[] = [], dNuevos: number[] = [], dProspNodos: number[] = [], dProspTotal: number[] = [], dPct: number[] = []
  for (const mo of mesesNodos) {
    const nv = byMes[mo].nodos.size; ac += nv
    const pn = byMes[mo].prospNodos, pt = repByMonth[mo] || 0
    dAcum.push(ac); dNuevos.push(nv); dProspNodos.push(pn); dProspTotal.push(pt); dPct.push(pt > 0 ? Math.round(pn / pt * 100) : 0)
    const [yy, mm] = mo.split('-'); nLabels.push(MESES_NOM[parseInt(mm) - 1].slice(0, 3) + ' ' + yy.slice(2))
  }

  return NextResponse.json({
    periodoLabel,
    meta: { meses: meses.length, asesores: asesores.length, reportes: repIds.length },
    kpis, gaps, filas, indice,
    charts: {
      nodos: { labels: nLabels, dAcum, dNuevos, dProspNodos, dProspTotal, dPct },
      tendencia: { labels: tendLabels, trendC, trendP, trendPC },
      ranking,
    },
  })
}
