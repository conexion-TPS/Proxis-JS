/* ═══════════════════════════════════════════════════════════════════════
   VERIFICACIÓN DE LOS AJUSTES ZURICH (PASO 2) — divergencias intencionales.
   ───────────────────────────────────────────────────────────────────────
   A diferencia de comparar.mjs (paridad legacy↔React), este script verifica
   el NUEVO comportamiento del motor React contra los valores validados por TPS
   (A1, A3, A4 + bordes), y cuantifica la divergencia intencional de A3 vs el
   legacy caso a caso.

   Fuente de los ejemplos: ESPECIFICACIÓN PASO 2 (TPS + contrato Zurich).
   Uso:  node tools/comparacion-zurich/verificar-ajustes.mjs
═══════════════════════════════════════════════════════════════════════ */
'use strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ROOT = path.join(__dirname, '..', '..')
const P = (...p) => path.join(ROOT, ...p)
const ts = require('typescript')

const UF = 39357
const EPS = 1e-6

/* ── Motor React (calculo.ts transpilado) ── */
const tsSrc = fs.readFileSync(P('src', 'lib', 'simulador', 'calculo.ts'), 'utf8')
const js = ts.transpileModule(tsSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const Rmod = { exports: {} }
new Function('exports', 'module', 'require', js)(Rmod.exports, Rmod, require)
const R = Rmod.exports

function baseR(over = {}) {
  const ss = R.initialStateZurich(['Asesor Prueba'])
  // por defecto el estado inicial trae BL=1 y APV=1; partimos LIMPIO para aislar.
  Object.keys(ss.qty).forEach(k => { ss.qty[k] = 0 })
  Object.keys(ss.prima).forEach(k => { ss.prima[k] = 0 })
  Object.keys(ss.qtyGI).forEach(k => { ss.qtyGI[k] = 0 })
  return Object.assign(ss, over)
}
function calcR(ss, campana) { return R.simCalcZ(ss, campana, UF) }
function det(out, id) { return out.det.find(d => d.p.id === id) }

/* ── Motor legacy (para cuantificar la divergencia A3) ── */
function cargarLegacy() {
  const datosSrc = fs.readFileSync(P('public', 'compensacion', 'compania-z', 'datos.js'), 'utf8')
  const rentaSrc = fs.readFileSync(P('public', 'compensacion', 'compania-z', 'renta.js'), 'utf8')
  const docShim = { _kpi: false, getElementById(id) { return id === 'kpi-salud' ? { checked: docShim._kpi } : null } }
  const wrapper = `
    function __legacyZ(caseSs, campana) { simState = caseSs; return simCalcZ(campana); }
    return { legacyZ: __legacyZ };`
  const factory = new Function('document', 'ASESORES', 'window', datosSrc + '\n' + rentaSrc + '\n' + wrapper)
  return factory(docShim, ['Asesor Prueba'], {})
}
const { legacyZ } = cargarLegacy()
const golden = require(P('tools', 'compensacion-golden', 'golden-master.js'))

/* ── Aserciones ── */
let fallos = 0
const filas = []
function check(desc, got, exp, eps = EPS) {
  const ok = Math.abs(got - exp) <= eps
  if (!ok) fallos++
  filas.push({ desc, got, exp, ok })
}

console.log('VERIFICACIÓN DE AJUSTES ZURICH (PASO 2) — motor React vs valores validados TPS\n')

/* ── A1: APV Flexible como producto del Mix ── */
{
  // Ej validado: prima 2 UF → PPA 24 → 6 AE (factor 0.25 flat, sin campaña)
  const o = calcR(baseR({ qty: { ...baseR().qty, APVF: 1 }, prima: { ...baseR().prima, APVF: 2 } }), false)
  const d = det(o, 'APVF')
  check('A1 APVF prima2 s/campaña · PPA', d.ppaUF, 24)
  check('A1 APVF prima2 s/campaña · AE (0.25 flat)', d.zTotal, 6)
  check('A1 APVF · comisión cUF 0.08 × UF', d.comVenta, 0.08 * UF)
  check('A1 APVF · incentivo = 0', d.incMant, 0)
}
{
  // Campaña ON: factor 0.50, cap UF 500 (prima 60 → PPA 720 → cap 500), tope 600
  const o = calcR(baseR({ qty: { ...baseR().qty, APVF: 1 }, prima: { ...baseR().prima, APVF: 60 } }), true)
  const d = det(o, 'APVF')
  check('A1 APVF prima60 campaña · PPA capeado a 500', d.ppaUF, 500)
  check('A1 APVF prima60 campaña · AE = 500 × 0.50', d.zTotal, 250)
}

/* ── A2: Renta Preferente como producto del Mix (factor por endoso) ── */
{
  // 0-1 pólizas (solo RP): endosoCol=2 → factor 0.25; prima 10 → PPA 120 → AE 30
  const o = calcR(baseR({ qty: { ...baseR().qty, RP: 1 }, prima: { ...baseR().prima, RP: 10 } }), false)
  const d = det(o, 'RP')
  check('A2 RP 0-1 pól · PPA', d.ppaUF, 120)
  check('A2 RP 0-1 pól · AE (0.25)', d.zTotal, 30)
  check('A2 RP · comisión c 0.24 × prima×UF', d.comVenta, 10 * UF * 0.24)
}
{
  // ≥3 pólizas (RP=1 + BL=2): endosoCol=0 → factor 0.50; prima 10 → PPA 120 → AE 60
  const b = baseR()
  b.qty.RP = 1; b.prima.RP = 10; b.qty.BL = 2; b.prima.BL = 0
  const o = calcR(b, false)
  const d = det(o, 'RP')
  check('A2 RP ≥3 pól · AE (0.50)', d.zTotal, 60)
}

/* ── A3: Aporte Renta Preferente — AE FIJO 5% ── */
{
  // Ej validado: 500 UF → PPA 50 · AE 25 (fijo, independiente del endoso)
  const o = calcR(baseR({ rpMonto: 500 }), false)
  const d = det(o, 'RPUNI')
  check('A3 aporte RP 500 · PPA (10%)', d.ppaUF, 50)
  check('A3 aporte RP 500 · AE (5% fijo)', d.zTotal, 25)
}

/* ── A4: Aporte extraordinario Business Life ── */
{
  // Ej validado: 100 UF con 3+ pólizas → PPA 10 → 8 AE (factor BL 0.80)
  const b = baseR({ blEx: 100 }); b.qty.BL = 3
  const o = calcR(b, false)
  const d = det(o, 'BLEX')
  check('A4 aporte BL 100, 3+ pól · PPA (10%)', d.ppaUF, 10)
  check('A4 aporte BL 100, 3+ pól · AE (0.80)', d.zTotal, 8)
}
{
  // Borde: 0-1 pólizas → factor BL 0.50 → AE 5
  const o = calcR(baseR({ blEx: 100 }), false)
  const d = det(o, 'BLEX')
  check('A4 aporte BL 100, 0-1 pól · AE (0.50)', d.zTotal, 5)
}

/* ── Reporte de aserciones ── */
console.log('  estado | esperado | obtenido | aserción')
console.log('  -------+----------+----------+--------------------------------------------')
for (const f of filas) {
  console.log(
    '  ' + (f.ok ? ' OK  ' : 'FALLA') + ' | ' +
    String(f.exp).padStart(8) + ' | ' + String(Number(f.got.toFixed(6))).padStart(8) + ' | ' + f.desc
  )
}

/* ── Cuantificación de la divergencia A3 vs legacy (caso a caso) ── */
console.log('\nDIVERGENCIA INTENCIONAL A3 (aporte Renta Preferente) — legacy vs React:')
console.log('  Δ esperado = aporte × (0.05 − 0.10 × ENDOSO_Z[RP][endosoCol])')
console.log('  ----------------------------------------------------------------------')
const ENDOSO_RP = R.ENDOSO_Z ? R.ENDOSO_Z['RP'] : [0.50, 0.50, 0.25]
function endosoColDe(qtyTot) { return qtyTot >= 3 ? 0 : qtyTot === 2 ? 1 : 2 }
const casosA3 = [
  { desc: 'RP 1000, 0-1 pól (mix vacío)', rpMonto: 1000, mix: {} },
  { desc: 'RP 1500, 2 pól (BL+APV)',      rpMonto: 1500, mix: { BL: 1, APV: 1 } },
  { desc: 'RP 1500, ≥3 pól (BL=3)',       rpMonto: 1500, mix: { BL: 3 } },
]
let divFallos = 0
for (const c of casosA3) {
  // React
  const rss = baseR({ rpMonto: c.rpMonto }); Object.assign(rss.qty, c.mix)
  const rAE = det(calcR(rss, false), 'RPUNI').zTotal
  // Legacy (estado base del golden + mix + rpMonto)
  const lss = golden.baseState(); lss.campana = false
  Object.keys(lss.qty).forEach(k => { lss.qty[k] = 0 })
  Object.assign(lss.qty, c.mix); lss.rpMonto = c.rpMonto; lss.apvEx = 0; lss.apvFlexEx = 0
  const lz = legacyZ(lss, false)
  const lAE = (lz.det.find(d => d.p.id === 'RPUNI') || { zTotal: 0 }).zTotal
  // Δ esperado
  const qtyTot = Object.values(c.mix).reduce((a, b) => a + b, 0)
  const col = endosoColDe(qtyTot)
  const deltaEsp = c.rpMonto * (0.05 - 0.10 * ENDOSO_RP[col])
  const deltaReal = rAE - lAE
  const ok = Math.abs(deltaReal - deltaEsp) <= EPS
  if (!ok) divFallos++
  console.log(`  ${ok ? 'OK ' : 'XX '} ${c.desc.padEnd(30)} legacy=${lAE.toFixed(2)}  react=${rAE.toFixed(2)}  Δ=${deltaReal.toFixed(2)} (esp ${deltaEsp.toFixed(2)})`)
}

/* ── Resultado ── */
const totalFallos = fallos + divFallos
if (totalFallos === 0) {
  console.log(`\n✅ TODO OK: ${filas.length} aserciones + ${casosA3.length} divergencias A3 cuadran con los valores validados de TPS.`)
} else {
  console.log(`\n❌ ${totalFallos} discrepancia(s). Reportar a TPS, NO corregir sin decisión.`)
  process.exitCode = 1
}
