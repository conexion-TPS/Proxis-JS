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

// ── Helpers de escritura (POST) ──
const VINCULOS = ['Amigo/a', 'Familiar', 'Cliente', 'Conocido/a']

// Calco de getLunes() del legacy (lunes ISO de la semana en curso). HALLAZGO: el legacy
// (plataforma-core.js:122-129) usa la zona horaria LOCAL del navegador (= Chile en los
// asesores reales). El server corre en UTC → computamos en Chile UTC-3 FIJO (convención
// del repo "Chile = UTC-3 fijo") para no elegir el lunes equivocado cerca de la medianoche.
function lunesActualChile(): string {
  const chile = new Date(Date.now() - 3 * 3600 * 1000) // reloj de pared Chile (UTC-3)
  const day = chile.getUTCDay()
  const diff = chile.getUTCDate() - day + (day === 0 ? -6 : 1)
  return new Date(Date.UTC(chile.getUTCFullYear(), chile.getUTCMonth(), diff)).toISOString().slice(0, 10)
}
// semana_num calendario-corrido desde 2026-03-30 (calco de plataforma-core.js:893-895).
function semanaNumDesde(lunesISO: string): number {
  const SEM1 = new Date('2026-03-30').getTime()
  return Math.round((new Date(lunesISO).getTime() - SEM1) / (7 * 24 * 3600 * 1000)) + 1
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

/*
 * POST /api/app/bitacora ── ESCRITURAS de bitácora v1 (proxis_dev por persona_id) ──
 * Calco de la bitácora A (/plataforma): nueva_semana (semana_num calendario-corrido),
 * guardar_contactos (delete-all + reinsert), eliminar_contacto; + sin_actividad/confirmar
 * adoptadas de B (/api/vina/bitacora) + sus validaciones server-side.
 * NODOS/HOMÓNIMOS: NO en este lote (v2). tipo_contacto se persiste tal cual viene del cliente.
 * Gate: resolveIdentity (token) → persona_id + institucion_id. NUNCA escribe en Viña.
 */
export async function POST(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })

  const sb = supabaseAdmin()
  const body = await req.json().catch(() => ({}))
  const accion = body?.accion

  // ── nueva_semana (calco A §1a) ──
  if (accion === 'nueva_semana') {
    const semana = lunesActualChile()
    // unicidad por persona_id + semana_inicio: si existe, devolver el existente (calco bloqueo A)
    const { data: existe } = await sb.from('reportes')
      .select('id').eq('persona_id', id.persona_id).eq('semana_inicio', semana).maybeSingle()
    if (existe) return NextResponse.json({ ok: true, reporte_id: existe.id, yaExistia: true })

    const { data, error } = await sb.from('reportes').insert({
      persona_id: id.persona_id, institucion_id: id.institucion_id, asesor: id.nombre,
      semana_inicio: semana, semana_num: semanaNumDesde(semana),
      confirmado: false, sin_actividad: false,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, reporte_id: data.id })
  }

  // ── guardar_contactos (calco A §1b: delete-all + reinsert; validaciones B) ──
  if (accion === 'guardar_contactos') {
    const reporte_id = body?.reporte_id
    const contactos = body?.contactos
    if (!reporte_id) return NextResponse.json({ error: 'reporte_id requerido' }, { status: 400 })

    const { data: rep } = await sb.from('reportes')
      .select('id, confirmado').eq('id', reporte_id).eq('persona_id', id.persona_id).maybeSingle()
    if (!rep) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    if (rep.confirmado) return NextResponse.json({ error: 'Semana ya confirmada' }, { status: 409 })

    // delete-all del reporte → reinsert (calco guardarBorrador, SIN nodos/homónimos)
    await sb.from('contactos').delete().eq('reporte_id', reporte_id)
    const filas = (Array.isArray(contactos) ? contactos : [])
      .filter((c) => (c?.nombre ?? '').trim())
      .map((c) => ({
        reporte_id, persona_id: id.persona_id, institucion_id: id.institucion_id, asesor: id.nombre,
        nombre: String(c.nombre).trim(),
        vinculo: VINCULOS.includes(c.vinculo) ? c.vinculo : 'Conocido/a',
        tipo_contacto: typeof c.tipo_contacto === 'string' && c.tipo_contacto ? c.tipo_contacto : 'nuevo',
        llamo: !!c.llamo,
        reunion: !!c.reunion,
        prospectos: Number.isFinite(+c.prospectos) ? Math.max(0, Math.trunc(+c.prospectos)) : 0,
      }))
    if (filas.length) {
      const { error } = await sb.from('contactos').insert(filas)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // con contactos → la semana ya no es "sin actividad" (calco B)
      await sb.from('reportes').update({ sin_actividad: false }).eq('id', reporte_id).eq('persona_id', id.persona_id)
    }
    return NextResponse.json({ ok: true, guardados: filas.length })
  }

  // ── sin_actividad (calco B) ──
  if (accion === 'sin_actividad') {
    const reporte_id = body?.reporte_id
    if (!reporte_id) return NextResponse.json({ error: 'reporte_id requerido' }, { status: 400 })
    const { error } = await sb.from('reportes')
      .update({ sin_actividad: !!body?.value })
      .eq('id', reporte_id).eq('persona_id', id.persona_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── confirmar (calco B) ──
  if (accion === 'confirmar') {
    const reporte_id = body?.reporte_id
    if (!reporte_id) return NextResponse.json({ error: 'reporte_id requerido' }, { status: 400 })
    const { error } = await sb.from('reportes')
      .update({ confirmado: true })
      .eq('id', reporte_id).eq('persona_id', id.persona_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── eliminar_contacto (calco A §1d: borra 1 contacto; 409 si la semana está confirmada) ──
  if (accion === 'eliminar_contacto') {
    const contacto_id = body?.contacto_id
    if (!contacto_id) return NextResponse.json({ error: 'contacto_id requerido' }, { status: 400 })
    const { data: c } = await sb.from('contactos').select('id, reporte_id').eq('id', contacto_id).maybeSingle()
    if (!c) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    const { data: rep } = await sb.from('reportes')
      .select('id, confirmado, persona_id').eq('id', c.reporte_id).maybeSingle()
    if (!rep || rep.persona_id !== id.persona_id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    if (rep.confirmado) return NextResponse.json({ error: 'Semana ya confirmada' }, { status: 409 })
    const { error } = await sb.from('contactos').delete().eq('id', contacto_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'accion desconocida' }, { status: 400 })
}
