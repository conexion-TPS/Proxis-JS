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
        .map((fecha) => ({ esFantasma: !repPorFecha[fecha], reporte: repPorFecha[fecha] ?? null }))
    : reportes.map((r) => ({ esFantasma: false, reporte: r }))

  const semanas = fuentes.map(({ esFantasma, reporte }) => {
    if (esFantasma || !reporte) return { contactos: 0, reuniones: 0, prospectos: 0, potencial: 0, vinc: {} as Record<string, number> }
    const cs = reporte.contactos || []
    const contactos = cs.length
    const reuniones = cs.filter((c) => c.reunion).length
    const prospectos = cs.reduce((a, c) => a + (c.prospectos || 0), 0)
    const vinc: Record<string, number> = {}
    cs.forEach((c) => { const v = c.vinculo || '—'; vinc[v] = (vinc[v] || 0) + (c.prospectos || 0) })
    return { contactos, reuniones, prospectos, potencial: contactos * 5, vinc }
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

  const identidad = { nombre: id.nombre, institucion: id.institucion_nombre, via: id.via }

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
    avances: { avMes, avC, avIng },
  })
}
