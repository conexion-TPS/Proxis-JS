/* ═══════════════════════════════════════════════════════════════════════
   TEST — guardar_contactos_v2 (bitácora v2a, NODOS server-side).
   ───────────────────────────────────────────────────────────────────────
   Escenario sintético contra proxis_dev sobre un asesor DEMO de Imrbrasil
   (NO Zurich / NO Consorcio). Verifica:
     A) conversión a nodo (reaparición en 2ª semana → activaciones=2)
     B) idempotencia (re-guardar misma semana → update por diff, sin duplicar activación)
     C) limpieza del nodo huérfano (quitar el contacto del form)
     D) transaccionalidad (doble llamada concurrente → sin duplicados, gracias al lock)
   Limpia TODO el escenario al terminar (incluido en finally, pase o falle).

   Uso:  node tools/bitacora-v2/test_nodos_v2.mjs
   Requiere: la RPC guardar_contactos_v2 ya creada en proxis_dev (SQL Editor).
═══════════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const IMR = 'c28fe5f9-e970-4a6c-a93d-553df812af54'
const ZURICH = '16726d00-78ef-4885-9218-02c649244084'
const CONSORCIO = 'c05f3883-827d-4ab8-a0b8-4dba6424fcac'

// Semanas sintéticas lejanas (no colisionan con datos reales). Nombre con prefijo único.
const W1 = '2099-01-05'
const W2 = '2099-01-12'
const NOMBRE = 'PRUEBA_V2 Nodo Sintetico'

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg) } else { fail++; console.log('  ✗ FALLA:', msg) } }

const rpc = (persona, inst, repId, contactos) =>
  sb.rpc('guardar_contactos_v2', { p_persona_id: persona, p_institucion_id: inst, p_reporte_id: repId, p_contactos: contactos })

let repW1 = null, repW2 = null, persona = null

async function limpiar() {
  // nodos+activaciones de prueba de la persona
  if (persona) {
    const { data: ns } = await sb.from('nodos').select('id').eq('persona_id', persona).like('nombre', 'PRUEBA_V2%')
    for (const n of ns || []) {
      await sb.from('activaciones_nodo').delete().eq('nodo_id', n.id)
      await sb.from('nodos').delete().eq('id', n.id)
    }
    await sb.from('activaciones_nodo').delete().eq('persona_id', persona).in('semana_inicio', [W1, W2])
  }
  for (const r of [repW1, repW2]) {
    if (r) { await sb.from('contactos').delete().eq('reporte_id', r); await sb.from('reportes').delete().eq('id', r) }
  }
}

try {
  // ── Cinturón: persona demo de Imrbrasil, NO Zurich/Consorcio ──
  const { data: p } = await sb.from('persona')
    .select('id, nombre, institucion_id, tipo').eq('institucion_id', IMR).eq('tipo', 'asesor').limit(1).single()
  if (!p) throw new Error('No hay asesor demo en Imrbrasil')
  persona = p.id
  console.log(`Asesor demo: ${p.nombre} (${persona})`)
  ok(p.institucion_id === IMR, 'persona es de Imrbrasil')
  ok(p.institucion_id !== ZURICH && p.institucion_id !== CONSORCIO, 'persona NO es Zurich ni Consorcio')
  if (p.institucion_id !== IMR) throw new Error('CINTURÓN: la persona no es Imrbrasil — abortado')

  await limpiar() // estado limpio por si quedó algo de una corrida previa

  // ── Setup: reportes W1 y W2 ──
  const mkRep = async (semana) => {
    const { data, error } = await sb.from('reportes').insert({
      persona_id: persona, institucion_id: IMR, asesor: p.nombre,
      semana_inicio: semana, semana_num: 999, confirmado: false, sin_actividad: false,
    }).select('id').single()
    if (error) throw new Error('insert reporte: ' + error.message)
    return data.id
  }
  repW1 = await mkRep(W1)
  repW2 = await mkRep(W2)

  // ── W1: primer contacto (no debe convertir: no hay semana previa) ──
  const r1 = await rpc(persona, IMR, repW1, [{ nombre: NOMBRE, vinculo: 'Amigo/a', llamo: true, reunion: false, prospectos: 3 }])
  if (r1.error) throw new Error('RPC W1: ' + r1.error.message)
  console.log('\n── W1 (alta) ──', JSON.stringify(r1.data))
  ok(r1.data.ok === true && r1.data.guardados === 1, 'W1 guarda 1 contacto')
  ok((r1.data.nodos_nuevos || []).length === 0, 'W1 no crea nodo (sin semana previa)')

  // ── TEST A: W2 mismo contacto (cliente dice 'nuevo') → server re-deriva → CONVIERTE ──
  const rA = await rpc(persona, IMR, repW2, [{ nombre: NOMBRE, vinculo: 'Amigo/a', tipo_contacto: 'nuevo', llamo: true, reunion: true, prospectos: 5 }])
  if (rA.error) throw new Error('RPC W2: ' + rA.error.message)
  console.log('\n── TEST A · W2 (conversión) ──', JSON.stringify(rA.data))
  ok((rA.data.nodos_nuevos || []).length === 1, 'A: convierte exactamente 1 nodo nuevo')
  const { data: nodosA } = await sb.from('nodos').select('*').eq('persona_id', persona).like('nombre', 'PRUEBA_V2%')
  ok(nodosA.length === 1, 'A: existe 1 nodo en BD')
  ok(nodosA[0]?.activaciones === 2, `A: activaciones === 2 (real: ${nodosA[0]?.activaciones})`)
  ok(nodosA[0]?.total_prospectos === 8, `A: total_prospectos === 3+5=8 (real: ${nodosA[0]?.total_prospectos})`)
  ok(String(nodosA[0]?.fecha_conversion) === W2, `A: fecha_conversion === ${W2} (real: ${nodosA[0]?.fecha_conversion})`)
  const { data: actA } = await sb.from('activaciones_nodo').select('*').eq('nodo_id', nodosA[0]?.id)
  ok(actA.length === 1 && actA[0].semana_inicio === W2, 'A: 1 activación para W2')
  const tipoServer = (await sb.from('contactos').select('tipo_contacto').eq('reporte_id', repW2).single()).data?.tipo_contacto
  ok(tipoServer === 'reactivacion', `A: server marcó tipo_contacto='reactivacion' pese al 'nuevo' del cliente (real: ${tipoServer})`)

  // ── TEST B: re-guardar W2 idéntico → idempotente (sin duplicar activación) ──
  const rB1 = await rpc(persona, IMR, repW2, [{ nombre: NOMBRE, vinculo: 'Amigo/a', prospectos: 5 }])
  if (rB1.error) throw new Error('RPC B1: ' + rB1.error.message)
  const { data: actB1 } = await sb.from('activaciones_nodo').select('*').eq('nodo_id', nodosA[0]?.id)
  const { data: nodoB1 } = await sb.from('nodos').select('*').eq('id', nodosA[0]?.id).single()
  console.log('\n── TEST B · re-guardar W2 ──', JSON.stringify(rB1.data))
  ok(actB1.length === 1, 'B: sigue habiendo 1 sola activación (no duplica)')
  ok(nodoB1.total_prospectos === 8, `B: total_prospectos intacto = 8 (real: ${nodoB1.total_prospectos})`)
  // re-guardar con prospectos distinto → update por diff
  const rB2 = await rpc(persona, IMR, repW2, [{ nombre: NOMBRE, vinculo: 'Amigo/a', prospectos: 9 }])
  if (rB2.error) throw new Error('RPC B2: ' + rB2.error.message)
  const { data: actB2 } = await sb.from('activaciones_nodo').select('*').eq('nodo_id', nodosA[0]?.id)
  const { data: nodoB2 } = await sb.from('nodos').select('*').eq('id', nodosA[0]?.id).single()
  ok(actB2.length === 1 && actB2[0].prospectos === 9, 'B: activación actualizada a 9 (sin duplicar)')
  ok(nodoB2.total_prospectos === 12, `B: total ajustado por diff = 8+(9-5)=12 (real: ${nodoB2.total_prospectos})`)

  // ── TEST C: quitar el contacto del form (W2 vacío) → limpieza del nodo huérfano ──
  const rC = await rpc(persona, IMR, repW2, [])
  if (rC.error) throw new Error('RPC C: ' + rC.error.message)
  console.log('\n── TEST C · W2 vacío (huérfano) ──', JSON.stringify(rC.data))
  ok((rC.data.nodos_borrados || []).length === 1, 'C: reporta 1 nodo borrado')
  const { data: nodosC } = await sb.from('nodos').select('id').eq('persona_id', persona).like('nombre', 'PRUEBA_V2%')
  ok(nodosC.length === 0, 'C: el nodo huérfano fue eliminado de BD')
  const { data: actC } = await sb.from('activaciones_nodo').select('id').eq('persona_id', persona).in('semana_inicio', [W2])
  ok(actC.length === 0, 'C: sus activaciones también se eliminaron (FK)')

  // ── TEST D: doble llamada CONCURRENTE sobre W2 con el contacto → sin duplicados (lock) ──
  // Estado: W1 tiene el contacto, W2 vacío, sin nodo. Dos conversiones simultáneas.
  const body = [{ nombre: NOMBRE, vinculo: 'Amigo/a', prospectos: 5 }]
  const [d1, d2] = await Promise.all([rpc(persona, IMR, repW2, body), rpc(persona, IMR, repW2, body)])
  if (d1.error) throw new Error('RPC D1: ' + d1.error.message)
  if (d2.error) throw new Error('RPC D2: ' + d2.error.message)
  console.log('\n── TEST D · concurrencia ──', JSON.stringify(d1.data), '||', JSON.stringify(d2.data))
  const { data: nodosD } = await sb.from('nodos').select('id').eq('persona_id', persona).like('nombre', 'PRUEBA_V2%')
  ok(nodosD.length === 1, `D: exactamente 1 nodo pese a 2 llamadas concurrentes (real: ${nodosD.length})`)
  const { data: actD } = await sb.from('activaciones_nodo').select('id').eq('nodo_id', nodosD[0]?.id)
  ok(actD.length === 1, `D: exactamente 1 activación para W2 (real: ${actD.length})`)
} catch (e) {
  fail++
  console.log('\n✗ EXCEPCIÓN:', e.message)
} finally {
  await limpiar()
  console.log('\n(escenario de prueba limpiado)')
  console.log(`\nRESULTADO: ${pass} OK · ${fail} fallas`)
  process.exit(fail ? 1 : 0)
}
