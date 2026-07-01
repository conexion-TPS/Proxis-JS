import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { supabaseVina } from '@/lib/supabaseVina'

function genToken() {
  return randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = supabaseAdmin()
  const [instRes, capasRes, nodosRes, usuariosRes, invRes, geoRes] = await Promise.all([
    // geo_id requiere la migración F1 (db/propuestas/F1_org_geo.sql). Desplegar este código
    // DESPUÉS de que TPS corra el SQL; si no, la columna no existe y la lista sale vacía.
    sb.from('instituciones').select('id, nombre, tipo, activo, geo_id').order('nombre'),
    sb.from('org_capas').select('id, institucion_id, nivel, nombre_cargo').order('nivel'),
    sb.from('org_nodos').select('id, parent_id, institucion_id, capa_id, nombre, titulo_propio, activo').order('nombre'),
    sb.from('org_usuarios').select('id, nombre, email, org_nodo_id, cargo, activo, ultimo_login').order('nombre'),
    sb.from('org_invitaciones')
      .select('id, token, institucion_id, parent_nodo_id, nivel_sugerido, email_destino, usado, expira_at, created_at')
      .eq('usado', false)
      .gt('expira_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    // Tolerante: si la tabla aún no existe (pre-migración), geoRes.error → geo: []
    sb.from('org_geo').select('id, tipo, nombre, parent_id, activo').order('nombre'),
  ])
  return NextResponse.json({
    instituciones: instRes.data  ?? [],
    capas:         capasRes.data ?? [],
    nodos:         nodosRes.data ?? [],
    usuarios:      usuariosRes.data ?? [],
    invitaciones:  invRes.data  ?? [],
    geo:           geoRes.data  ?? [],
  })
}

export async function POST(req: NextRequest) {
  const sb  = supabaseAdmin()
  const body = await req.json()
  const { accion } = body

  if (accion === 'crear_institucion') {
    const { nombre, tipo = 'empresa' } = body
    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
    const { data, error } = await sb.from('instituciones').insert({ nombre, tipo }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  // F1 — geografía: crear continente/país (árbol org_geo, por encima de la empresa).
  if (accion === 'crear_geo') {
    const { tipo, nombre, parent_id } = body
    if (!nombre || !['continente', 'pais'].includes(tipo))
      return NextResponse.json({ error: "tipo ('continente'|'pais') y nombre requeridos" }, { status: 400 })
    if (tipo === 'pais' && !parent_id)
      return NextResponse.json({ error: 'un país requiere parent_id (su continente)' }, { status: 400 })
    const { data, error } = await sb.from('org_geo')
      .insert({ tipo, nombre, parent_id: tipo === 'pais' ? parent_id : null })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  // F1 — geografía: colgar (o descolgar) una empresa de un país.
  if (accion === 'asignar_geo') {
    const { institucion_id, geo_id } = body
    if (!institucion_id) return NextResponse.json({ error: 'institucion_id requerido' }, { status: 400 })
    const { error } = await sb.from('instituciones')
      .update({ geo_id: geo_id || null })
      .eq('id', institucion_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (accion === 'crear_capa') {
    const { institucion_id, nivel, nombre_cargo } = body
    if (!institucion_id || !nivel || !nombre_cargo)
      return NextResponse.json({ error: 'faltan campos' }, { status: 400 })
    const { data, error } = await sb.from('org_capas')
      .upsert({ institucion_id, nivel, nombre_cargo }, { onConflict: 'institucion_id,nivel' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  if (accion === 'crear_nodo') {
    const { parent_id, institucion_id, capa_id, nombre, titulo_propio } = body
    if (!institucion_id || !nombre)
      return NextResponse.json({ error: 'faltan campos' }, { status: 400 })
    const { data, error } = await sb.from('org_nodos')
      .insert({ parent_id: parent_id || null, institucion_id, capa_id: capa_id || null, nombre, titulo_propio: titulo_propio || null })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  if (accion === 'importar_estructura') {
    const { rows } = body as { rows: { institucion: string; nivel: number; cargo: string; nodo: string; nodo_padre: string }[] }
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: 'rows requerido' }, { status: 400 })

    const resultado = { instituciones: 0, capas: 0, nodos: 0, errores: [] as string[] }

    // Agrupar por institución
    const porInst: Record<string, typeof rows> = {}
    for (const r of rows) {
      const key = r.institucion.trim()
      if (!key) continue
      if (!porInst[key]) porInst[key] = []
      porInst[key].push(r)
    }

    for (const [instNombre, instRows] of Object.entries(porInst)) {
      // 1. Buscar o crear institución
      let instId: string
      const { data: existingInst } = await sb.from('instituciones')
        .select('id').ilike('nombre', instNombre).eq('activo', true).maybeSingle()
      if (existingInst) {
        instId = existingInst.id
      } else {
        const { data: newInst, error } = await sb.from('instituciones')
          .insert({ nombre: instNombre, tipo: 'empresa' }).select('id').single()
        if (error || !newInst) { resultado.errores.push(`Institución "${instNombre}": ${error?.message}`); continue }
        instId = newInst.id
        resultado.instituciones++
      }

      // 2. Crear capas únicas (nivel → cargo)
      const capasUnicas = new Map<number, string>()
      for (const r of instRows) if (r.nivel && r.cargo?.trim()) capasUnicas.set(Number(r.nivel), r.cargo.trim())
      const capasMap: Record<number, string> = {}
      for (const [nivel, cargo] of capasUnicas) {
        const { data: capa, error } = await sb.from('org_capas')
          .upsert({ institucion_id: instId, nivel, nombre_cargo: cargo }, { onConflict: 'institucion_id,nivel' })
          .select('id').single()
        if (error || !capa) { resultado.errores.push(`Capa N${nivel} "${cargo}": ${error?.message}`); continue }
        capasMap[nivel] = capa.id
        resultado.capas++
      }

      // 3. Cargar nodos existentes (resolución de padre + idempotencia)
      const { data: existingNodos } = await sb.from('org_nodos')
        .select('id, nombre').eq('institucion_id', instId)
      const nodoNameToId: Record<string, string> = {}
      for (const n of existingNodos ?? []) nodoNameToId[n.nombre.toLowerCase()] = n.id

      // 4. Crear nodos por nivel ascendente (padres antes que hijos)
      const sortedRows = [...instRows].sort((a, b) => (Number(a.nivel) || 0) - (Number(b.nivel) || 0))
      for (const r of sortedRows) {
        const nodoNombre = r.nodo?.trim() ?? ''
        if (!nodoNombre) continue
        if (nodoNameToId[nodoNombre.toLowerCase()]) continue // ya existe

        const parentNombre = r.nodo_padre?.trim() ?? ''
        const parentId = parentNombre ? (nodoNameToId[parentNombre.toLowerCase()] ?? null) : null
        if (parentNombre && !parentId) {
          resultado.errores.push(`Nodo "${nodoNombre}": padre "${parentNombre}" no encontrado`)
          continue
        }
        const { data: newNodo, error } = await sb.from('org_nodos')
          .insert({ institucion_id: instId, parent_id: parentId, capa_id: capasMap[Number(r.nivel)] ?? null, nombre: nodoNombre })
          .select('id').single()
        if (error || !newNodo) { resultado.errores.push(`Nodo "${nodoNombre}": ${error?.message}`); continue }
        nodoNameToId[nodoNombre.toLowerCase()] = newNodo.id
        resultado.nodos++
      }
    }

    return NextResponse.json({ ok: true, ...resultado })
  }

  if (accion === 'crear_invitacion') {
    const { institucion_id, parent_nodo_id, nivel_sugerido, email_destino } = body
    if (!institucion_id)
      return NextResponse.json({ error: 'institucion_id requerido' }, { status: 400 })
    const token = genToken()
    const { data, error } = await sb.from('org_invitaciones')
      .insert({
        token,
        institucion_id,
        parent_nodo_id: parent_nodo_id || null,
        nivel_sugerido: nivel_sugerido || null,
        email_destino:  email_destino  || null,
      })
      .select('id, token, expira_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  if (accion === 'set_activo') {
    const { tipo, id, activo } = body as { tipo: string; id: string; activo: boolean }
    const tables: Record<string, string> = {
      institucion: 'instituciones',
      nodo:        'org_nodos',
      usuario:     'org_usuarios',
    }
    const table = tables[tipo]
    if (!table || !id) return NextResponse.json({ error: 'tipo e id requeridos' }, { status: 400 })
    const { error } = await sb.from(table).update({ activo }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (accion === 'asignar_asesor') {
    const { asesor, org_nodo_id } = body
    if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })
    const { error } = await sb.from('asesor_credentials')
      .update({ org_nodo_id: org_nodo_id || null })
      .eq('asesor', asesor)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (accion === 'importar_asesores') {
    const { rows } = body as { rows: { asesor: string; org_nodo_id: string; email?: string; password?: string; titulo_cargo?: string }[] }
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: 'rows requerido' }, { status: 400 })

    const sbVina = supabaseVina()
    const EMPRESA_MAP: Record<string, string> = { Consorcio: 'consorcio', Zurich: 'zurich', 'Equipo Rojo (PRUEBA)': 'prueba' }

    const { data: existentes } = await sb.from('asesor_credentials').select('asesor')
    const existSet = new Set((existentes ?? []).map(e => e.asesor.toLowerCase().trim()))

    let updated = 0
    let created = 0
    const errores: string[] = []
    const detalle: Array<{ email: string; sailor: 'ok' | 'error'; bitacora: 'ok' | 'parcial'; motivo?: string }> = []

    for (const row of rows) {
      const titulo    = row.titulo_cargo?.trim() || null
      const email     = row.email?.toLowerCase().trim() ?? ''
      const yaExiste  = existSet.has(row.asesor.toLowerCase().trim())

      // Paso 1: asesor_credentials
      let password_hash: string | undefined
      if (yaExiste) {
        const patch: Record<string, unknown> = { org_nodo_id: row.org_nodo_id }
        if (titulo) patch.titulo_cargo = titulo
        const { error } = await sb.from('asesor_credentials').update(patch).eq('asesor', row.asesor)
        if (error) { errores.push(`${row.asesor}: ${error.message}`); continue }
        updated++
        if (row.password) password_hash = await bcrypt.hash(row.password, 10)
      } else {
        if (!email || !row.password) {
          errores.push(`${row.asesor}: nuevo asesor sin email/password (se omite)`)
          continue
        }
        password_hash = await bcrypt.hash(row.password, 10)
        const { error } = await sb.from('asesor_credentials').upsert(
          { asesor: row.asesor.trim(), email, password_hash, rol: 'asesor', org_nodo_id: row.org_nodo_id, titulo_cargo: titulo, activo: true },
          { onConflict: 'email' }
        )
        if (error) { errores.push(`${row.asesor}: ${error.message}`); continue }
        created++
      }

      // Sin email o password_hash no se actualizan vina_credentials ni persona
      if (!email || !password_hash) {
        detalle.push({ email: email || row.asesor, sailor: 'ok', bitacora: 'parcial', motivo: 'sin email/password → Bitácora no actualizada' })
        continue
      }

      // Paso 2: resolver institucion_id y empresa desde el nodo
      const { data: nodo } = await sb.from('org_nodos').select('institucion_id').eq('id', row.org_nodo_id).maybeSingle()
      if (!nodo?.institucion_id) {
        detalle.push({ email, sailor: 'ok', bitacora: 'parcial', motivo: `nodo ${row.org_nodo_id} no resuelto` })
        continue
      }
      const { data: inst } = await sb.from('instituciones').select('nombre').eq('id', nodo.institucion_id).maybeSingle()
      const empresa = EMPRESA_MAP[inst?.nombre ?? ''] ?? 'prueba'

      // Paso 3: vina_credentials (upsert por email — login Bitácora)
      const { error: e3 } = await sbVina.from('vina_credentials').upsert(
        { asesor: row.asesor.trim(), email, password_hash, empresa, rol: 'asesor', activo: true },
        { onConflict: 'email' }
      )
      if (e3) {
        errores.push(`${row.asesor} [vina]: ${e3.message}`)
        detalle.push({ email, sailor: 'ok', bitacora: 'parcial', motivo: `vina: ${e3.message}` })
        continue
      }

      // Paso 4: persona (upsert por email — identidad /api/app/me)
      const { error: e4 } = await sb.from('persona').upsert(
        { nombre: row.asesor.trim(), email, tipo: 'asesor', institucion_id: nodo.institucion_id, origen_tabla: 'asesor_credentials', activo: true },
        { onConflict: 'email' }
      )
      if (e4) {
        // Rollback: eliminar vina_credentials recién escrita para no dejar estado inconsistente
        await sbVina.from('vina_credentials').delete().eq('email', email)
        errores.push(`${row.asesor} [persona]: ${e4.message} (vina revertido)`)
        detalle.push({ email, sailor: 'ok', bitacora: 'parcial', motivo: `persona: ${e4.message} (vina revertido)` })
        continue
      }

      detalle.push({ email, sailor: 'ok', bitacora: 'ok' })
    }

    return NextResponse.json({ ok: true, updated, created, errores, detalle })
  }

  if (accion === 'importar_usuarios') {
    const { rows } = body as { rows: { nombre: string; email: string; password: string; org_nodo_id: string; cargo?: string }[] }
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: 'rows requerido' }, { status: 400 })
    const CARGOS_VALIDOS = ['asesor','supervisor','gerente_zonal','gerente_regional','admin']
    const hashed = await Promise.all(
      rows.map(async r => ({
        nombre:        r.nombre.trim(),
        email:         r.email.toLowerCase().trim(),
        password_hash: await bcrypt.hash(r.password, 10),
        org_nodo_id:   r.org_nodo_id,
        cargo:         CARGOS_VALIDOS.includes(r.cargo ?? '') ? r.cargo : 'supervisor',
        activo:        true,
      }))
    )
    const { error } = await sb.from('org_usuarios').upsert(hashed, { onConflict: 'email' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, processed: hashed.length })
  }

  return NextResponse.json({ error: 'accion desconocida' }, { status: 400 })
}
