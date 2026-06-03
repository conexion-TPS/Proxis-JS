/* ═══════════════════════════════════════════════════════════════════════
   VALIDADOR del MOTOR de producción (Fases 4-5).
   Corre los módulos REALES public/compensacion/nucleo/motor.js +
   compania-z/spec.js + nucleo/embudo.js sobre los 36 escenarios y compara
   contra el golden master de Zurich. Prueba el motor de PRODUCCIÓN (el que
   cargará la app) antes de cablearlo.
═══════════════════════════════════════════════════════════════════════ */
'use strict'
const path = require('path')
const { scenarios, calcAll, UF_VAL } = require('./golden-master')
const P = (...p) => path.join(__dirname, '..', '..', 'public', 'compensacion', ...p)
const motor  = require(P('nucleo', 'motor.js'))
const embudo = require(P('nucleo', 'embudo.js'))
const spec   = require(P('compania-z', 'spec.js'))

const EPS = 1e-6
let fallos = 0
const detalles = []

for (let i = 0; i < scenarios.length; i++) {
  const ss = scenarios[i].ss
  const ref = calcAll(ss)

  const comp = motor.computeCompensation(spec, ss, UF_VAL)
  const fun = embudo.calcEmbudo(ss.pcts, comp.ventas)
  const got = {
    ...comp,
    metaContactos: fun.metaContactos, metaProspectos: fun.metaProspectos,
    funnelTotContactos: fun.totContactos, funnelTotProspectos: fun.totProspectos,
  }

  const difs = []
  for (const k of Object.keys(ref)) {
    const a = ref[k], b = got[k]
    const igual = (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) <= EPS : a === b
    if (!igual) difs.push(`${k}: ref=${a} vs motor=${b}`)
  }
  if (difs.length) { fallos++; detalles.push({ idx: i, desc: scenarios[i].desc, difs }) }
}

console.log(`VALIDACIÓN motor de producción (motor.js + spec.js + embudo.js) vs golden master — ${scenarios.length} escenarios\n`)
if (fallos === 0) {
  console.log(`✅ PARIDAD TOTAL: ${scenarios.length}/${scenarios.length}. El motor de producción reproduce Zurich número por número.`)
} else {
  console.log(`❌ ${fallos}/${scenarios.length} con diferencias:\n`)
  for (const d of detalles) { console.log(`  [${d.idx}] ${d.desc}`); for (const x of d.difs) console.log(`      - ${x}`) }
  process.exitCode = 1
}
