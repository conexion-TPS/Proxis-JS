/* ═══════════════════════════════════════════════════════════════════════
   VALIDADOR — Fase 1.
   Corre el MOTOR GENÉRICO (engine.js) + la SPEC de Zurich (zurich-spec.js)
   sobre los MISMOS escenarios del golden master, y compara campo por campo
   contra el cálculo de referencia de Zurich (compania-z portado).

   Criterio de éxito: paridad EXACTA en los 36 escenarios. Tolerancia 1e-6
   solo para `fp` (float). Cualquier diferencia = no se hace cutover.
═══════════════════════════════════════════════════════════════════════ */
'use strict'
const { scenarios, calcAll, UF_VAL } = require('./golden-master')
const { computeAll } = require('./engine')
const spec = require('./zurich-spec')

const EPS = 1e-6
let fallos = 0
const detalles = []

for (let i = 0; i < scenarios.length; i++) {
  const ss = scenarios[i].ss
  const ref = calcAll(ss)                 // verdad de referencia (Zurich actual)
  const got = computeAll(spec, ss, UF_VAL) // motor genérico + spec Zurich

  const difs = []
  for (const k of Object.keys(ref)) {
    const a = ref[k], b = got[k]
    let igual
    if (typeof a === 'number' && typeof b === 'number') igual = Math.abs(a-b) <= EPS
    else igual = a === b
    if (!igual) difs.push(`${k}: ref=${a} vs motor=${b}`)
  }
  if (difs.length) { fallos++; detalles.push({ idx:i, desc:scenarios[i].desc, difs }) }
}

console.log(`VALIDACIÓN motor genérico vs golden master — ${scenarios.length} escenarios\n`)
if (fallos === 0) {
  console.log(`✅ PARIDAD TOTAL: ${scenarios.length}/${scenarios.length} escenarios idénticos.`)
  console.log('   El motor genérico + spec Zurich reproduce la conducta actual número por número.')
} else {
  console.log(`❌ ${fallos}/${scenarios.length} escenarios con diferencias:\n`)
  for (const d of detalles) {
    console.log(`  [${d.idx}] ${d.desc}`)
    for (const x of d.difs) console.log(`      - ${x}`)
  }
  process.exitCode = 1
}
