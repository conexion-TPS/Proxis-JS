import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * GET /api/app/bitacora?mes=YYYY-MM   ── SOLO LECTURA (cero escrituras) ──
 * Bitácora Semanal del asesor — vista INERTE read-only del /app. Calco de la bitácora A
 * (/plataforma / plataforma-core.js): lee proxis_dev por persona_id.
 *   • reportes del mes actual + mes previo (calco de getReportesMes ×2) con sus contactos
 *   • nodos (getNodos) + activaciones_nodo (para la tarjeta de nodos)
 * NO escribe nada. Toda la lógica de escritura (abrir/guardar/confirmar/activar/eliminar,
 * homónimos, conversión a nodos) está documentada en MAPEO_BITACORA_FASE3.md para Fase 3.
 */

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function mesPrevio(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}
function mesSiguiente(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

type ContactoRow = {
  id: string; reporte_id: string; nombre: string; vinculo: string | null
  llamo: boolean; reunion: boolean; prospectos: number; tipo_contacto: string | null; created_at: string
}

export async function GET(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })

  const sb = supabaseAdmin()
  const mes = new URL(req.url).searchParams.get('mes') || mesActual()
  const mesPrev = mesPrevio(mes)
  const nextM = mesSiguiente(mes)

  // REPORTES de [mesPrev .. mes] por persona_id. (semana_inicio es TEXT ISO → rango por string.)
  const { data: repRows } = await sb
    .from('reportes')
    .select('id, semana_inicio, semana_num, confirmado, sin_actividad')
    .eq('persona_id', id.persona_id)
    .gte('semana_inicio', `${mesPrev}-01`)
    .lt('semana_inicio', `${nextM}-01`)
    .order('semana_inicio', { ascending: true })
  const reportes = repRows ?? []

  // CONTACTOS de esos reportes (orden created_at.asc, calco de getReportesMes).
  const repIds = reportes.map((r) => r.id)
  let contactos: ContactoRow[] = []
  if (repIds.length) {
    const { data: cs } = await sb
      .from('contactos')
      .select('id, reporte_id, nombre, vinculo, llamo, reunion, prospectos, tipo_contacto, created_at')
      .in('reporte_id', repIds)
      .order('created_at', { ascending: true })
    contactos = (cs ?? []) as ContactoRow[]
  }
  const porReporte: Record<string, ContactoRow[]> = {}
  for (const c of contactos) (porReporte[c.reporte_id] ??= []).push(c)
  const reportesConContactos = reportes.map((r) => ({ ...r, contactos: porReporte[r.id] ?? [] }))

  // NODOS (orden activaciones.desc, calco de getNodos) + activaciones_nodo (todas, para semanaRef + tendencia).
  const { data: nodoRows } = await sb
    .from('nodos')
    .select('id, nombre, vinculo, activaciones, total_prospectos, fecha_primer_contacto, fecha_conversion, ultima_activacion')
    .eq('persona_id', id.persona_id)
    .order('activaciones', { ascending: false })
  const { data: actRows } = await sb
    .from('activaciones_nodo')
    .select('id, nodo_id, semana_inicio, prospectos')
    .eq('persona_id', id.persona_id)
    .order('semana_inicio', { ascending: true })

  return NextResponse.json({
    mes,
    mesPrev,
    reportes: reportesConContactos,
    nodos: nodoRows ?? [],
    activaciones: actRows ?? [],
  })
}
