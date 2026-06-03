/* ═══════════════════════════════════════════════════════════════════════
   VALIDADOR del NÚCLEO-EMBUDO de producción (Fase 2a).
   Corre el módulo REAL public/compensacion/nucleo/embudo.js (calcEmbudo)
   sobre los 36 escenarios y compara contra el golden master de Zurich.

   Éxito = paridad exacta en metaContactos / metaProspectos / totales de embudo.
   Esto prueba que el módulo de producción reproduce el embudo actual ANTES
   de cablearlo a la app (paso 2b).
═══════════════════════════════════════════════════════════════════════ */
'use strict'
const path = require('path')
const { scenarios, calcAll, calcFunnel } = require('./golden-master')
const { calcEmbudo } = require(path.join('..', '..', 'public', 'compensacion', 'nucleo', 'embudo.js'))

let fallos = 0
for (let i = 0; i < scenarios.length; i++) {
  const ss = scenarios[i].ss
  const ventas = calcAll(ss).ventas
  const ref = calcFunnel(ss, ventas)                       // embudo actual de Zurich
  const got = calcEmbudo(ss.pcts, ventas)                  // núcleo de producción
  const difs = []
  if (ref.metaContactos       !== got.metaContactos)        difs.push(`metaContactos ${ref.metaContactos} vs ${got.metaContactos}`)
  if (ref.metaProspectos      !== got.metaProspectos)       difs.push(`metaProspectos ${ref.metaProspectos} vs ${got.metaProspectos}`)
  if (ref.funnelTotContactos  !== got.totContactos)         difs.push(`totContactos ${ref.funnelTotContactos} vs ${got.totContactos}`)
  if (ref.funnelTotProspectos !== got.totProspectos)        difs.push(`totProspectos ${ref.funnelTotProspectos} vs ${got.totProspectos}`)
  if (difs.length) { fallos++; console.log(`  [${i}] ${scenarios[i].desc}\n      ${difs.join('\n      ')}`) }
}

console.log(`\nVALIDACIÓN núcleo-embudo vs golden master — ${scenarios.length} escenarios`)
if (fallos === 0) console.log(`✅ PARIDAD TOTAL: ${scenarios.length}/${scenarios.length}. El módulo de producción reproduce el embudo de Zurich.`)
else { console.log(`❌ ${fallos} con diferencias.`); process.exitCode = 1 }
