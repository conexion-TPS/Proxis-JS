import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const PERFILES_CORE = ['Energético', 'Sociable', 'Relacional', 'Reflexivo']

const CATEGORIAS = [
  'fortaleza', 'debilidad', 'tactica_cliente', 'ciclo_7pasos',
  'backup_style', 'colision_espejo', 'diagnostico_perceptual',
  'cierre', 'pregunta_interna', 'sales_dna', 'ruta_desarrollo',
  'variable_situacional', 'protocolo_intervención',
]

// Priority score by category (determines gap prioridad 1-5)
const CAT_PRIORIDAD: Record<string, number> = {
  fortaleza: 5, debilidad: 5, tactica_cliente: 5,
  cierre: 4, ciclo_7pasos: 4, diagnostico_perceptual: 4,
  sales_dna: 3, pregunta_interna: 3, backup_style: 3,
  colision_espejo: 2, ruta_desarrollo: 2,
  variable_situacional: 1, 'protocolo_intervención': 2,
}

type CellStats = { count: number; avgCompletitud: number }
type CoverageMatrix = Record<string, Record<string, CellStats>>

export async function POST(_req: NextRequest) {
  const sb = supabaseAdmin()

  const [kbRes, gapsRes] = await Promise.all([
    sb.from('knowledge_base_conductual').select('perfil, categoria, completitud'),
    sb.from('knowledge_gaps')
      .select('categoria, perfil_afectado')
      .neq('estado', 'cubierto'),
  ])

  if (kbRes.error) return NextResponse.json({ error: kbRes.error.message }, { status: 500 })

  // Build coverage matrix
  const matrix: CoverageMatrix = {}
  for (const p of [...PERFILES_CORE, 'General']) {
    matrix[p] = {}
    for (const c of CATEGORIAS) {
      matrix[p][c] = { count: 0, avgCompletitud: 0 }
    }
  }

  for (const row of kbRes.data ?? []) {
    const p = row.perfil ?? 'General'
    const c = row.categoria
    if (!c || !matrix[p]) continue
    if (!matrix[p][c]) matrix[p][c] = { count: 0, avgCompletitud: 0 }
    const cell = matrix[p][c]
    const prev = cell.avgCompletitud * cell.count
    cell.count++
    cell.avgCompletitud = (prev + (row.completitud ?? 50)) / cell.count
  }

  // Build set of existing open gaps to avoid duplicates
  const existingGaps = new Set<string>()
  for (const g of gapsRes.data ?? []) {
    existingGaps.add(`${g.perfil_afectado}||${g.categoria}`)
  }

  // Detect uncovered or low-coverage combos and create gaps
  const toInsert: Array<{
    categoria: string; perfil_afectado: string
    descripcion: string; prioridad: number; estado: string
  }> = []

  for (const perfil of PERFILES_CORE) {
    for (const cat of CATEGORIAS) {
      const cell = matrix[perfil][cat]
      const key  = `${perfil}||${cat}`
      if (existingGaps.has(key)) continue

      const needsGap = cell.count === 0 || (cell.count < 2 && cell.avgCompletitud < 40)
      if (!needsGap) continue

      const prio = CAT_PRIORIDAD[cat] ?? 2
      const motivo = cell.count === 0
        ? `Sin entradas en knowledge_base para perfil ${perfil} × categoría ${cat}`
        : `Cobertura baja (${cell.count} entrada${cell.count !== 1 ? 's' : ''}, ${Math.round(cell.avgCompletitud)}% completitud) para ${perfil} × ${cat}`

      toInsert.push({
        categoria:       cat,
        perfil_afectado: perfil,
        descripcion:     motivo,
        prioridad:       prio,
        estado:          'detectado',
      })
    }
  }

  let created = 0
  if (toInsert.length) {
    const { error } = await sb.from('knowledge_gaps').insert(toInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    created = toInsert.length
  }

  return NextResponse.json({ created, skipped: toInsert.length === 0 ? 0 : 0, matrix })
}

export async function GET(_req: NextRequest) {
  const sb = supabaseAdmin()
  const [kbRes, gapsRes] = await Promise.all([
    sb.from('knowledge_base_conductual').select('perfil, categoria, completitud, embedded_at'),
    sb.from('knowledge_gaps').select('categoria, perfil_afectado, estado, prioridad').neq('estado', 'cubierto'),
  ])

  const matrix: CoverageMatrix = {}
  for (const p of [...PERFILES_CORE, 'General']) {
    matrix[p] = {}
    for (const c of CATEGORIAS) {
      matrix[p][c] = { count: 0, avgCompletitud: 0 }
    }
  }
  for (const row of kbRes.data ?? []) {
    const p = row.perfil ?? 'General'
    const c = row.categoria
    if (!c || !matrix[p]) continue
    if (!matrix[p][c]) matrix[p][c] = { count: 0, avgCompletitud: 0 }
    const cell = matrix[p][c]
    const prev = cell.avgCompletitud * cell.count
    cell.count++
    cell.avgCompletitud = (prev + (row.completitud ?? 50)) / cell.count
  }

  const gapsByCell: Record<string, number> = {}
  for (const g of gapsRes.data ?? []) {
    const key = `${g.perfil_afectado}||${g.categoria}`
    gapsByCell[key] = (gapsByCell[key] ?? 0) + 1
  }

  return NextResponse.json({ matrix, gapsByCell })
}
