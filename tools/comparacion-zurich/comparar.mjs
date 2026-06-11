/* ═══════════════════════════════════════════════════════════════════════
   BATERÍA DE COMPARACIÓN — Simulador Zurich: LEGACY vs REACT
   ───────────────────────────────────────────────────────────────────────
   Corre el motor de renta LEGACY (public/compensacion/compania-z/renta.js +
   datos.js, vía un shim mínimo de `document`/globals) y el motor REACT
   (src/lib/simulador/calculo.ts, transpilado al vuelo con typescript) sobre
   los MISMOS casos, y compara TODAS las salidas numéricas campo por campo.

   Objetivo: confirmar que el port React reproduce número por número el cálculo
   legacy de simCalcZ + simCalcBonoUF + el total compuesto (FP × bono + sueldo
   base + comisión + incentivo + bonos Top20).

   REGLA: si algún caso difiere, NO se corrige nada — se reporta la diferencia
   exacta (campo + delta) y se sale con código 1. La decisión es de TPS.

   El shim NO altera la conducta: replica EXACTO la única lectura de DOM que el
   legacy hace dentro de simCalcZ (`document.getElementById('kpi-salud').checked`).
   `campana` ya es parámetro de simCalcZ/simCalcBonoUF en el legacy (no se lee
   del DOM dentro del cálculo), así que se pasa directo.

   Uso:  node tools/comparacion-zurich/comparar.mjs
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

const UF = 39357           // UF_VAL legacy == UF_DEFAULT React
const EPS = 1e-6           // tolerancia de punto flotante
const CAMPOS = [
  'zVI', 'zGIBruto', 'zGI', 'zGITopado', 'zTotal',
  'comVenta', 'incMant', 'ventas', 'bonoApe', 'bonoCv',
  'bonoUF', 't5Hab', 'tope_t5', 'fp', 'bonoNeto', 'total',
]

/* ───────────────────────────────────────────────────────────────────────
   1) MOTOR LEGACY — datos.js + renta.js cargados tal cual, con shim mínimo.
   ─────────────────────────────────────────────────────────────────────── */
function cargarLegacy() {
  const datosSrc = fs.readFileSync(P('public', 'compensacion', 'compania-z', 'datos.js'), 'utf8')
  const rentaSrc = fs.readFileSync(P('public', 'compensacion', 'compania-z', 'renta.js'), 'utf8')

  // Shim de DOM: el legacy, dentro de simCalcZ, hace
  //   document.getElementById('kpi-salud')?.checked
  // Devolvemos un objeto cuyo .checked refleja docShim._kpi (seteado por caso).
  const docShim = {
    _kpi: false,
    getElementById(id) {
      if (id === 'kpi-salud') return { checked: docShim._kpi }
      return null  // el resto de IDs solo se usan en funciones de render que NO invocamos
    },
  }

  // Envolvente: datos.js + renta.js viven en el MISMO scope (las consts de
  // datos.js quedan visibles para renta.js), más un wrapper que orquesta el
  // total igual que simRender() (renta.js:205-213).
  const wrapper = `
    function __computeLegacy(caseSs, campana) {
      simState = caseSs;                                   // simCalcZ lee el global simState
      var ant = caseSs.ant, pR = caseSs.persist / 100, pM = PMIN(ant), fp = FP(pR, pM, ant);
      var z = simCalcZ(campana);                           // renta.js:90
      var b = simCalcBonoUF(z.zTotal, ant, campana);       // renta.js:185
      var bonoNeto = b.uf * fp * UF_VAL;                   // renta.js:211
      var total = SUELDO_BASE + bonoNeto + z.comVenta + z.incMant + z.bonoApe + z.bonoCv; // renta.js:212
      return {
        zVI: z.zVI, zGIBruto: z.zGIBruto, zGI: z.zGI, zGITopado: z.zGITopado, zTotal: z.zTotal,
        comVenta: z.comVenta, incMant: z.incMant, ventas: z.ventas, bonoApe: z.bonoApe, bonoCv: z.bonoCv,
        bonoUF: b.uf, t5Hab: b.t5Hab, tope_t5: b.tope_t5, fp: fp, bonoNeto: bonoNeto, total: total,
      };
    }
    return { computeLegacy: __computeLegacy };
  `
  const body = datosSrc + '\n' + rentaSrc + '\n' + wrapper
  // Pasamos los globals que el legacy espera: document, ASESORES, window.
  const factory = new Function('document', 'ASESORES', 'window', body)
  const api = factory(docShim, ['Asesor Prueba'], {})
  return { computeLegacy: api.computeLegacy, docShim }
}

/* ───────────────────────────────────────────────────────────────────────
   2) MOTOR REACT — calculo.ts transpilado al vuelo (CommonJS) y orquestado
      con el MISMO wrapper que simRender (idéntico al legacy, solo cambia el
      motor interno).
   ─────────────────────────────────────────────────────────────────────── */
function cargarReact() {
  const tsSrc = fs.readFileSync(P('src', 'lib', 'simulador', 'calculo.ts'), 'utf8')
  const js = ts.transpileModule(tsSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = { exports: {} }
  new Function('exports', 'module', 'require', js)(mod.exports, mod, require)
  const R = mod.exports

  function computeReact(ss, campana) {
    const ant = ss.ant, pR = ss.persist / 100, pM = R.PMIN(ant), fp = R.FP(pR, pM, ant)
    const z = R.simCalcZ(ss, campana, UF)                  // calculo.ts:161
    const b = R.simCalcBonoUF(z.zTotal, ant, campana, ss)  // calculo.ts:253
    const bonoNeto = b.uf * fp * UF
    const total = R.SUELDO_BASE_DEFAULT + bonoNeto + z.comVenta + z.incMant + z.bonoApe + z.bonoCv
    return {
      zVI: z.zVI, zGIBruto: z.zGIBruto, zGI: z.zGI, zGITopado: z.zGITopado, zTotal: z.zTotal,
      comVenta: z.comVenta, incMant: z.incMant, ventas: z.ventas, bonoApe: z.bonoApe, bonoCv: z.bonoCv,
      bonoUF: b.uf, t5Hab: b.t5Hab, tope_t5: b.tope_t5, fp, bonoNeto, total,
    }
  }
  return { computeReact }
}

/* ───────────────────────────────────────────────────────────────────────
   3) CASOS — se reusan los 36 del golden master + casos extra explícitos
      (endoso por columnas, antigüedades, escalones de FP, tramos, etc.).
   ─────────────────────────────────────────────────────────────────────── */
const golden = require(P('tools', 'compensacion-golden', 'golden-master.js'))
const { baseState, scenarios } = golden

// Caso extra: parte del estado base del golden y aplica un mutador.
function extra(desc, fn) { const ss = baseState(); fn(ss); return { desc, ss } }

const casosExtra = [
  // ── Endoso por nº de pólizas nueva venta (col 2 / 1 / 0) con un aporte activo
  //    para que el factor de endoso sea observable (zVI) ──
  extra('Endoso 0-1 pól. (BL=1 + APVex 1000) → col 2', s => { s.qty.BL = 1; s.qty.APV = 0; s.apvEx = 1000 }),
  extra('Endoso 2 pól. (BL=2 + APVex 1000) → col 1',   s => { s.qty.BL = 2; s.qty.APV = 0; s.apvEx = 1000 }),
  extra('Endoso ≥3 pól. (BL=3 + APVex 1000) → col 0',  s => { s.qty.BL = 3; s.qty.APV = 0; s.apvEx = 1000 }),

  // ── Antigüedades (tramos de incentivo mantención + tope T5 por antigüedad) ──
  extra('Antigüedad 1 (sin incentivo, ant<2)',  s => { s.ant = 1 }),
  extra('Antigüedad 6 (incentivo m2-12, tope T5=300)', s => { s.ant = 6 }),
  extra('Antigüedad 13 (incentivo m13-24)',     s => { s.ant = 13 }),
  extra('Antigüedad 25 (incentivo m25-120)',    s => { s.ant = 25 }),
  extra('Antigüedad 120 (tope T5=1200)',        s => { s.ant = 120 }),

  // ── Escalones del factor persistencia (FP) — c = (persist/100) / PMIN(ant) ──
  extra('FP=0   (persist 40, ant 3)',           s => { s.ant = 3;  s.persist = 40 }),
  extra('FP=0.5 (persist 70, ant 3)',           s => { s.ant = 3;  s.persist = 70 }),
  extra('FP=0.65(persist 80, ant 3)',           s => { s.ant = 3;  s.persist = 80 }),
  extra('FP=0.9 (persist 85, ant 3)',           s => { s.ant = 3;  s.persist = 85 }),
  extra('FP=1.0 (persist 89, ant 3)',           s => { s.ant = 3;  s.persist = 89 }),
  extra('FP=1.2 (persist 100, ant 24 >12)',     s => { s.ant = 24; s.persist = 100 }),
  extra('FP=1.0 (persist 100, ant 6 ≤12)',      s => { s.ant = 6;  s.persist = 100 }),

  // ── Tramos del bono UF (AE en distintas bandas) ──
  extra('Tramo bajo (BL=1, sin campaña)',                 s => { s.qty.BL = 1; s.qty.APV = 0; s.campana = false }),
  extra('Tramo medio (BL=3, sin campaña)',                s => { s.qty.BL = 3; s.qty.APV = 0; s.campana = false }),
  extra('Tramo 5 con req (BL=8 + t5.r1 + persist 92)',    s => { s.qty.BL = 8; s.t5.r1 = true; s.persist = 92 }),
  extra('Tramo 5 sin req T5 (BL=8, sin checks)',          s => { s.qty.BL = 8 }),
  extra('Tramo 5 persist<85 (BL=8 + t5.r1 + persist 80)', s => { s.qty.BL = 8; s.t5.r1 = true; s.persist = 80 }),

  // ── Campaña / KPI APV ──
  extra('KPI APV completo (BL+APV+GI HOGAR+SS), campaña', s => { s.qty.BL = 1; s.qty.APV = 1; s.qtyGI.HOGAR = 1; s.qty.SS = 1 }),
  extra('KPI APV incompleto (solo APV), campaña → 50%',   s => { s.qty.BL = 0; s.qty.APV = 1 }),

  // ── Aportes ──
  extra('APV Flex traspaso 2000',  s => { s.apvFlexEx = 2000 }),
  extra('Renta Preferente 1500',   s => { s.rpMonto = 1500 }),

  // ── GI tope vs liberado ──
  extra('GI excede tope 25% (sin campaña)', s => { s.qty.BL = 1; s.qtyGI.AUTO = 4; s.qtyGI.HOGAR = 4; s.campana = false }),
  extra('GI liberado (mismo mix, campaña)', s => { s.qty.BL = 1; s.qtyGI.AUTO = 4; s.qtyGI.HOGAR = 4; s.campana = true }),

  // ── Bonos Top 20 en distintos rankings ──
  extra('Top20 APE #1',  s => { s.bonos.top20ape = true; s.rankApe = 1 }),
  extra('Top20 CV #5',   s => { s.bonos.top20cv = true;  s.rankCv = 5 }),
  extra('Top20 ambos #10', s => { s.bonos.top20ape = true; s.bonos.top20cv = true; s.rankApe = 10; s.rankCv = 10 }),
  extra('Top20 APE #20 (último de la escala)', s => { s.bonos.top20ape = true; s.rankApe = 20 }),

  // ── Topes de comisión por producto ──
  extra('TP=2 (tope comisión UF10)',    s => { s.qty.TP = 2 }),
  extra('FP=2 (tope comisión UF0.22)',  s => { s.qty.FP = 2 }),
]

// Casos unificados. Para cada uno se deriva el kpiSalud (el golden re-port usa
// ss.kpiSalud===true; el legacy lo lee del DOM; React de ss.kpi.salud). Se
// alinean los tres a la MISMA fuente para una comparación justa.
const casos = [
  ...scenarios.map(sc => ({ desc: sc.desc, ss: sc.ss, origen: 'golden' })),
  ...casosExtra.map(sc => ({ desc: sc.desc, ss: sc.ss, origen: 'extra' })),
]

/* ───────────────────────────────────────────────────────────────────────
   4) EJECUCIÓN Y COMPARACIÓN
   ─────────────────────────────────────────────────────────────────────── */
const { computeLegacy, docShim } = cargarLegacy()
const { computeReact } = cargarReact()

function clon(o) { return JSON.parse(JSON.stringify(o)) }

let fallos = 0
const filas = []
const detallesFalla = []

for (let i = 0; i < casos.length; i++) {
  const { desc, ss, origen } = casos[i]
  const campana = ss.campana
  const kpiSalud = ss.kpiSalud === true

  // Legacy: shim de kpi-salud + ss tal cual (legacy ignora ss.kpi/ss.kpiSalud)
  docShim._kpi = kpiSalud
  const legSs = clon(ss)
  const legOut = computeLegacy(legSs, campana)

  // React: misma ss + ss.kpi.salud alineado a la misma fuente
  const reaSs = clon(ss)
  reaSs.kpi = { vida: false, gi: false, salud: kpiSalud }
  const reaOut = computeReact(reaSs, campana)

  const difs = []
  for (const k of CAMPOS) {
    const a = legOut[k], b = reaOut[k]
    let igual
    if (typeof a === 'number' && typeof b === 'number') igual = Math.abs(a - b) <= EPS
    else igual = a === b
    if (!igual) {
      const delta = (typeof a === 'number' && typeof b === 'number') ? (b - a) : null
      difs.push({ campo: k, legacy: a, react: b, delta })
    }
  }

  const pasa = difs.length === 0
  if (!pasa) { fallos++; detallesFalla.push({ idx: i, desc, origen, difs }) }
  filas.push({ idx: i, origen, pasa, desc, n: difs.length })
}

/* ───────────────────────────────────────────────────────────────────────
   5) REPORTE
   ─────────────────────────────────────────────────────────────────────── */
console.log('BATERÍA DE COMPARACIÓN — Simulador Zurich: motor LEGACY vs motor REACT')
console.log(`Casos: ${casos.length} (${scenarios.length} golden + ${casosExtra.length} extra) · UF=${UF} · EPS=${EPS}`)
console.log(`Campos comparados por caso: ${CAMPOS.join(', ')}\n`)

console.log('  #  | origen | estado | caso')
console.log('-----+--------+--------+-----------------------------------------------')
for (const f of filas) {
  console.log(
    String(f.idx).padStart(4) + ' | ' +
    f.origen.padEnd(6) + ' | ' +
    (f.pasa ? ' PASA ' : `FALLA${f.n}`).padEnd(6) + ' | ' +
    f.desc
  )
}

if (fallos === 0) {
  console.log(`\n✅ PARIDAD TOTAL: ${casos.length}/${casos.length} casos idénticos (todos los campos dentro de ${EPS}).`)
  console.log('   El motor React reproduce el cálculo legacy de Zurich número por número.')
} else {
  console.log(`\n❌ ${fallos}/${casos.length} casos con diferencias:\n`)
  for (const d of detallesFalla) {
    console.log(`  [${d.idx}] (${d.origen}) ${d.desc}`)
    for (const x of d.difs) {
      const deltaStr = x.delta === null ? '' : `   Δ=${x.delta}`
      console.log(`      - ${x.campo}: legacy=${x.legacy} vs react=${x.react}${deltaStr}`)
    }
  }
  console.log('\n⛔ REGLA: no se corrige nada. Diferencias reportadas para decisión de TPS.')
  process.exitCode = 1
}
