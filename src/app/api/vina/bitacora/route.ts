import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseVina, EMPRESA_VINA } from '@/lib/supabaseVina'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SECRET = process.env.VINA_JWT_SECRET ?? process.env.SAILOR_JWT_SECRET ?? 'proxis-vina-secret'

// ── Corte 2026-06-15: bitácora B (Consorcio) en SOLO-CONSULTA. ──
// ÚNICO SWITCH de B: poner en false revierte. El GET (consulta) sigue intacto;
// el POST (todas las acciones de escritura) responde 409 con el aviso de migración.
const VINA_SOLO_CONSULTA = true
const AVISO_CORTE = '📢 Desde el lunes 15 de junio, la bitácora se carga en la plataforma nueva: proxis.theprecisionselling.com/app/informe — Entra con tu email y tu clave nueva. Aquí puedes seguir consultando tu historial.'

type Sesion = { asesor: string; email: string; empresa: string }

function verifySesion(req: NextRequest): Sesion | null {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    const s = jwt.verify(token, SECRET) as Sesion
    // Cinturón de aislamiento: el token debe ser de empresa 'consorcio'.
    if (s.empresa !== EMPRESA_VINA) return null
    return s
  } catch {
    return null
  }
}

// Lunes (ISO) de la semana de una fecha dada.
function lunesISO(d = new Date()): string {
  const x = new Date(d)
  const offset = (x.getDay() + 6) % 7 // 0 = lunes
  x.setDate(x.getDate() - offset)
  return x.toISOString().slice(0, 10)
}

const VINCULOS = ['Amigo/a', 'Familiar', 'Cliente', 'Conocido/a']

// ── GET: semanas (reportes) + contactos del asesor, SOLO empresa='consorcio' ──
export async function GET(req: NextRequest) {
  const s = verifySesion(req)
  if (!s) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sb = supabaseVina()
  const { data: reportes, error } = await sb
    .from('reportes')
    .select('id, semana_inicio, semana_num, confirmado, sin_actividad')
    .eq('asesor', s.asesor)
    .eq('empresa', EMPRESA_VINA)
    .order('semana_inicio', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (reportes ?? []).map(r => r.id)
  let contactos: Record<string, unknown>[] = []
  if (ids.length) {
    const { data: cs } = await sb
      .from('contactos')
      .select('id, reporte_id, nombre, vinculo, llamo, reunion, prospectos')
      .in('reporte_id', ids)
      .eq('empresa', EMPRESA_VINA)
      .order('created_at', { ascending: true })
    contactos = cs ?? []
  }

  return NextResponse.json({ asesor: s.asesor, reportes: reportes ?? [], contactos, vinculos: VINCULOS })
}

// ── POST: acciones de la bitácora ──
export async function POST(req: NextRequest) {
  const s = verifySesion(req)
  if (!s) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Corte: bitácora B en solo-consulta → bloquea TODAS las escrituras en un solo punto.
  if (VINA_SOLO_CONSULTA) return NextResponse.json({ error: AVISO_CORTE }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const { accion } = body
  const sb = supabaseVina()

  if (accion === 'nueva_semana') {
    const semana = lunesISO(new Date())
    // Evitar duplicado de semana para este asesor/empresa
    const { data: existe } = await sb
      .from('reportes')
      .select('id')
      .eq('asesor', s.asesor).eq('empresa', EMPRESA_VINA).eq('semana_inicio', semana)
      .maybeSingle()
    if (existe) return NextResponse.json({ ok: true, reporte_id: existe.id, yaExistia: true })

    const { count } = await sb
      .from('reportes')
      .select('id', { count: 'exact', head: true })
      .eq('asesor', s.asesor).eq('empresa', EMPRESA_VINA)

    const { data, error } = await sb.from('reportes').insert({
      asesor:        s.asesor,
      empresa:       EMPRESA_VINA,
      semana_inicio: semana,
      semana_num:    (count ?? 0) + 1,
      confirmado:    false,
      sin_actividad: false,
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, reporte_id: data.id })
  }

  if (accion === 'guardar_contactos') {
    const { reporte_id, contactos } = body as {
      reporte_id: string
      contactos: { nombre: string; vinculo: string; llamo: boolean; reunion: boolean; prospectos: number }[]
    }
    if (!reporte_id) return NextResponse.json({ error: 'reporte_id requerido' }, { status: 400 })

    // El reporte debe pertenecer a este asesor y empresa (no se puede tocar Zurich ni otro asesor)
    const { data: rep } = await sb
      .from('reportes').select('id, confirmado')
      .eq('id', reporte_id).eq('asesor', s.asesor).eq('empresa', EMPRESA_VINA).maybeSingle()
    if (!rep) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    if (rep.confirmado) return NextResponse.json({ error: 'Semana ya confirmada' }, { status: 409 })

    // Reemplazo total (mismo enfoque que la bitácora original: del + insert)
    await sb.from('contactos').delete().eq('reporte_id', reporte_id).eq('empresa', EMPRESA_VINA)

    const filas = (contactos ?? [])
      .filter(c => c.nombre?.trim())
      .map(c => ({
        reporte_id,
        asesor:     s.asesor,
        empresa:    EMPRESA_VINA,
        nombre:     c.nombre.trim(),
        vinculo:    VINCULOS.includes(c.vinculo) ? c.vinculo : 'Conocido/a',
        llamo:      !!c.llamo,
        reunion:    !!c.reunion,
        prospectos: Number.isFinite(+c.prospectos) ? Math.max(0, Math.trunc(+c.prospectos)) : 0,
        tipo_contacto: 'nuevo',
      }))

    if (filas.length) {
      const { error } = await sb.from('contactos').insert(filas)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Si hay contactos, la semana ya no es "sin actividad"
    if (filas.length > 0) {
      await sb.from('reportes').update({ sin_actividad: false })
        .eq('id', reporte_id).eq('empresa', EMPRESA_VINA)
    }

    return NextResponse.json({ ok: true, guardados: filas.length })
  }

  if (accion === 'sin_actividad') {
    const { reporte_id, value } = body as { reporte_id: string; value: boolean }
    if (!reporte_id) return NextResponse.json({ error: 'reporte_id requerido' }, { status: 400 })
    const { error } = await sb.from('reportes')
      .update({ sin_actividad: !!value })
      .eq('id', reporte_id).eq('asesor', s.asesor).eq('empresa', EMPRESA_VINA)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (accion === 'confirmar') {
    const { reporte_id } = body as { reporte_id: string }
    if (!reporte_id) return NextResponse.json({ error: 'reporte_id requerido' }, { status: 400 })
    const { error } = await sb.from('reportes')
      .update({ confirmado: true })
      .eq('id', reporte_id).eq('asesor', s.asesor).eq('empresa', EMPRESA_VINA)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'accion desconocida' }, { status: 400 })
}
