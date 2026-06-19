/* ═══════════════════════════════════════════════════════════════════════
   ESPEJO DE SOLO LECTURA — Simulador Zurich (motor VIVO React)
   ───────────────────────────────────────────────────────────────────────
   Observador externo. NO modifica nada del sistema vivo. NO implementa fixes.
   NO corrige hacia el contrato ni hacia las liquidaciones.

   - VIVO   = src/lib/simulador/calculo.ts, transpilado al vuelo y EJECUTADO
              tal cual (solo se lee como referencia, no se altera).
   - ESPEJO = reimplementación INDEPENDIENTE de simCalcZ + simCalcBonoUF +
              factor persistencia + topes + toggle campaña, transcrita TAL CUAL
              está hoy (rarezas incluidas). No importa el módulo vivo.

   Pregunta única: ¿el espejo calcula idéntico a lo que paga hoy el vivo?
   Tolerancia 0 en Z/UF/pesos (igualdad estricta de números).

   Uso:  node tools/espejo-zurich/espejo.mjs
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

const UF = 39357   // UF_DEFAULT del motor vivo
const SUELDO_BASE = 539000 // SUELDO_BASE_DEFAULT del motor vivo

/* ═══════════════════════════════════════════════════════════════════════
   1) MOTOR VIVO — calculo.ts transpilado y ejecutado (solo lectura).
   ═══════════════════════════════════════════════════════════════════════ */
function cargarVivo() {
  const ts = require('typescript')
  const tsSrc = fs.readFileSync(P('src', 'lib', 'simulador', 'calculo.ts'), 'utf8')
  const js = ts.transpileModule(tsSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = { exports: {} }
  new Function('exports', 'module', 'require', js)(mod.exports, mod, require)
  const R = mod.exports
  function computeVivo(ss, campana, flagD13a = false) {
    const ant = ss.ant, pR = ss.persist / 100, pM = R.PMIN(ant), fp = R.FP(pR, pM, ant)
    const z = R.simCalcZ(ss, campana, UF)
    const b = R.simCalcBonoUF(z.zTotal, ant, campana, ss, flagD13a)
    const bonoNeto = b.uf * fp * UF
    const total = R.SUELDO_BASE_DEFAULT + bonoNeto + z.comVenta + z.incMant + z.bonoApe + z.bonoCv
    return {
      zVI: z.zVI, zGIBruto: z.zGIBruto, zGI: z.zGI, zGITopado: z.zGITopado, zTotal: z.zTotal,
      comVenta: z.comVenta, incMant: z.incMant, ventas: z.ventas, bonoApe: z.bonoApe, bonoCv: z.bonoCv,
      bonoUF: b.uf, t5Hab: b.t5Hab, tope_t5: b.tope_t5, fp, bonoNeto, total,
    }
  }
  return { computeVivo, R }
}

/* ═══════════════════════════════════════════════════════════════════════
   2) ESPEJO — reimplementación independiente, transcrita de calculo.ts.
      Constantes copiadas a mano (el espejo NO importa el módulo vivo).
   ═══════════════════════════════════════════════════════════════════════ */
const E = (() => {
  const SIM_PRODS = [
    { id: 'BL', z: 2.00, c: .32, incM12: .32, incM24: .06, incM120: .036 },
    { id: 'TP', z: 1.00, c: .16, cTopeUF: 10, incM12: .024, incM24: .024, incM120: .024 },
    { id: 'FP', z: 1.00, c: .056, cTopeUF: 0.22, incM12: .056, incM12TopeUF: .22, incM24: .024, incM24TopeUF: .10 },
    { id: 'AP', z: 1.00, c: .08, incM12: .08, incM24: .08, incM120: .08 },
    { id: 'APV', z: 0.50, cUF: .08 },
    { id: 'SS', z: 0.50, c: .08, incM12: .08, incM24: .08, incM120: .08 },
    { id: 'BLF', z: 0.50, c: .32, incM12: .32, incM24: .06, incM120: .036 },
    { id: 'APVF', z: 0.25, cUF: .08 },
    { id: 'RP', z: 0.50, c: .24, zEndoso: 'RP' },
  ]
  const SIM_PRODS_GI = [{ id: 'AUTO', z: 0.50 }, { id: 'HOGAR', z: 1.00 }]
  const TOP20_APE_UF = [23, 18, 13, 11, 9, 7, 6, 6, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1]
  const TOP20_CV_UF = [11, 8, 8, 8, 5, 5, 5, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  const SIM_TRAMOS = [
    { min: 0, max: 49.99, pct: .10, lbl: '0 – 49,99' }, { min: 50, max: 99.99, pct: .12, lbl: '50 – 99,99' },
    { min: 100, max: 149.99, pct: .15, lbl: '100 – 149,99' }, { min: 150, max: 200, pct: .18, lbl: '150 – 200' },
    { min: 200.01, max: 9999, pct: .10, lbl: '200+ (tramo 5)' },
  ]
  const TOPES_ORIG = [[6, 300], [23, 700], [47, 800], [71, 900], [95, 1000], [119, 1100], [999, 1200]]
  const TOPES_CAMP = [[6, 1000], [12, 1500], [24, 2000], [999, 99999]]
  const ENDOSO_Z = {
    BL: [0.80, 0.60, 0.50], PM: [0.80, 0.60, 0.50], FP: [0.80, 0.60, 0.50], TP: [0.70, 0.60, 0.50],
    AP: [0.70, 0.60, 0.50], APV: [0.50, 0.50, 0.25], SS: [0.50, 0.50, 0.25], BLF: [0.50, 0.50, 0.25],
    RP: [0.50, 0.50, 0.25], APVF: [0.25, 0.25, 0.125],
  }
  const CAMP_PRODS = {
    BL: { z: 2.00, tope: 300 }, PM: { z: 2.00, tope: 300 }, TP: { z: 1.00, tope: null }, AP: { z: 1.00, tope: null },
    APV: { z: 1.00, tope: 600, capUF: 500 }, BLF: { z: 0.50, tope: 300 }, SS: { z: 1.00, tope: null },
    RP: { z: 0.50, tope: 300 }, APVF: { z: 0.50, tope: 600, capUF: 500 },
  }
  const TOPE_T5 = (a, c) => { const t = c ? TOPES_CAMP : TOPES_ORIG; for (const [m, v] of t) if (a <= m) return v; return c ? null : 1200 }
  const PMIN = (a) => (a <= 12 ? .90 : a <= 24 ? .82 : .78)
  const FP = (r, m, ant) => { const c = r / m; if (c <= .5) return 0; if (c <= .85) return .5; if (c <= .9) return .65; if (c <= .95) return .9; if (c <= 1) return 1; return ant > 12 ? 1.2 : 1.0 }

  function simCalcZ(ss, campana, ufVal) {
    let zVI = 0, zGIBruto = 0, comVenta = 0, incMant = 0, ventas = 0
    const ventasMix = SIM_PRODS.reduce((a, p) => a + (ss.qty[p.id] || 0), 0)
    const endosoCol = ventasMix >= 3 ? 0 : ventasMix === 2 ? 1 : 2

    SIM_PRODS.forEach((p) => {
      const qty = ss.qty[p.id]; if (!qty) return
      const cp = campana ? CAMP_PRODS[p.id] : null
      const prima = ss.prima[p.id]
      const kpiSaludChk = ss.kpi.salud || ss.qty['SS'] > 0
      const tieneVidaMix = SIM_PRODS.some((q) => ss.qty[q.id] > 0)
      const tieneGIMix = SIM_PRODS_GI.some((q) => ss.qtyGI[q.id] > 0)
      const kpiCumpleCalc = kpiSaludChk && tieneVidaMix && tieneGIMix
      const usarCamp = cp != null && (p.id !== 'APV' || kpiCumpleCalc)
      const zBase = p.zEndoso ? ENDOSO_Z[p.zEndoso][endosoCol] : p.z
      const zF = usarCamp ? cp.z : zBase
      let ppaUF = prima * 12
      if (usarCamp && cp.capUF) ppaUF = Math.min(ppaUF, cp.capUF * qty)
      let zT = ppaUF * zF
      if (usarCamp && cp.tope) zT = Math.min(zT, cp.tope * qty)
      zVI += zT; ventas += qty
      let cV = 0
      const primaCLP = prima * ufVal
      if (p.cUF) { cV = p.cUF * ufVal * qty }
      else if (p.c) { cV = primaCLP * p.c * qty; if (p.cTopeUF) cV = Math.min(cV, p.cTopeUF * ufVal * qty) }
      comVenta += cV
      let incT = 0, incTasa = null, incTopeUF
      if (ss.ant >= 2) {
        if (ss.ant <= 12 && p.incM12) { incTasa = p.incM12; incTopeUF = p.incM12TopeUF }
        else if (ss.ant <= 24 && p.incM24) { incTasa = p.incM24; incTopeUF = p.incM24TopeUF }
        else if (ss.ant > 24 && p.incM120) { incTasa = p.incM120 }
        if (incTasa) { incT = primaCLP * incTasa * qty; if (incTopeUF) incT = Math.min(incT, incTopeUF * ufVal * qty) }
      }
      incMant += incT
    })

    const endosoCol2 = endosoCol // ya calculado antes del loop (P5)
    if (ss.apvFlexEx > 0) {
      const zFactor = ENDOSO_Z['APVF'][endosoCol2]
      const ppaF = ss.apvFlexEx * 0.10
      zVI += ppaF * zFactor
      ventas++
    }
    if (ss.apvEx > 0) {
      const ppaEq = ss.apvEx * 0.10
      const zFactor = ENDOSO_Z['APV'][endosoCol2]
      zVI += ppaEq * zFactor
    }
    if (ss.rpMonto > 0) {
      zVI += ss.rpMonto * 0.05
    }
    if (ss.blEx > 0) {
      const zFactor = ENDOSO_Z['BL'][endosoCol2]
      const ppaBL = ss.blEx * 0.10
      zVI += ppaBL * zFactor
    }

    SIM_PRODS_GI.forEach((p) => {
      const qty = ss.qtyGI[p.id]; if (!qty) return
      const ppaUF = ss.primaGI[p.id] * 12
      zGIBruto += ppaUF * p.z
    })
    const topeGI = campana ? Infinity : zVI * 0.25
    const zGI = Math.min(zGIBruto, topeGI)
    const zTotal = zVI + zGI

    let bonoApe = 0, bonoCv = 0
    if (ss.bonos.top20ape) bonoApe = (TOP20_APE_UF[ss.rankApe - 1] || 0) * ufVal
    if (ss.bonos.top20cv) bonoCv = (TOP20_CV_UF[ss.rankCv - 1] || 0) * ufVal

    return { zVI, zGIBruto, zGI, zGITopado: zGIBruto > topeGI, zTotal, comVenta, incMant, ventas, bonoApe, bonoCv }
  }

  function simCalcBonoUF(z, ant, campana, ss, flagD13a = false) {
    const tope_t5 = TOPE_T5(ant, campana)
    const cumpleT5 = Object.values(ss.t5).some((v) => v) &&
      (flagD13a ? (ss.persist / 100) / PMIN(ant) >= 0.85 : (ss.persist / 100) >= 0.85)
    let uf = 0
    const det = []
    for (const t of SIM_TRAMOS) {
      if (t.min >= 200) {
        if (z <= 200 || !cumpleT5) { det.push({ ...t, ap: 0, uf: 0, motivo: z <= 200 ? 'AE≤200' : !cumpleT5 ? 'sin req.' : '' }); continue }
        const exceso = z - 200
        const ap = tope_t5 === null ? exceso : Math.min(exceso, tope_t5)
        const u = ap * t.pct; det.push({ ...t, ap, uf: u, capped: tope_t5 !== null && exceso > tope_t5 }); uf += u
        continue
      }
      if (z <= t.min) { det.push({ ...t, ap: 0, uf: 0 }); continue }
      const ap = Math.min(z, t.max) - t.min; if (ap <= 0) { det.push({ ...t, ap: 0, uf: 0 }); continue }
      const u = ap * t.pct; det.push({ ...t, ap, uf: u }); uf += u
    }
    return { uf, det, t5Hab: cumpleT5, tope_t5 }
  }

  function computeEspejo(ss, campana) {
    const ant = ss.ant, pR = ss.persist / 100, pM = PMIN(ant), fp = FP(pR, pM, ant)
    const z = simCalcZ(ss, campana, UF)
    const b = simCalcBonoUF(z.zTotal, ant, campana, ss)
    const bonoNeto = b.uf * fp * UF
    const total = SUELDO_BASE + bonoNeto + z.comVenta + z.incMant + z.bonoApe + z.bonoCv
    return {
      zVI: z.zVI, zGIBruto: z.zGIBruto, zGI: z.zGI, zGITopado: z.zGITopado, zTotal: z.zTotal,
      comVenta: z.comVenta, incMant: z.incMant, ventas: z.ventas, bonoApe: z.bonoApe, bonoCv: z.bonoCv,
      bonoUF: b.uf, t5Hab: b.t5Hab, tope_t5: b.tope_t5, fp, bonoNeto, total,
    }
  }
  return { computeEspejo, simCalcZ, simCalcBonoUF, PMIN, FP }
})()

/* ═══════════════════════════════════════════════════════════════════════
   3) MATRIZ DE ESCENARIOS
   ═══════════════════════════════════════════════════════════════════════ */
function base() {
  return {
    meta: 2000000, ant: 3, persist: 92, campana: true,
    pcts: { ref1: 40, ref2: 40, ref3: 0, ref4: 0, dig: 10, frio: 10 },
    qty: { BL: 0, TP: 0, FP: 0, AP: 0, APV: 0, SS: 0, BLF: 0, APVF: 0, RP: 0 },
    prima: { BL: 10, TP: 6, FP: 8, AP: 2, APV: 10, SS: 4, BLF: 6, APVF: 5, RP: 25.166667 },
    qtyGI: { AUTO: 0, HOGAR: 0 }, primaGI: { AUTO: 2, HOGAR: 1.5 },
    rpMonto: 0, apvEx: 0, apvFlexEx: 0, blEx: 0,
    t5: { r1: false, r2: false, r3: false, r4: false, r5: false },
    kpi: { vida: false, gi: false, salud: false },
    bonos: { top20ape: false, top20cv: false, grati: true },
    rankApe: 10, rankCv: 10, asesor: 'X',
  }
}
function mk(desc, fn) { const ss = base(); fn(ss); return { desc, ss } }

const casos = []

// ── (A) Cartesiano: campaña × antigüedad × persistencia, mix fijo ──
const mixFijo = (s) => { s.qty.BL = 2; s.qty.APV = 1; s.qty.SS = 1; s.qtyGI.AUTO = 1; s.qtyGI.HOGAR = 1; s.t5.r1 = true }
for (const campana of [false, true])
  for (const ant of [1, 6, 13, 25, 120])
    for (const persist of [40, 80, 85, 92, 100])
      casos.push(mk(`cartesiano camp=${campana} ant=${ant} persist=${persist}`, s => { mixFijo(s); s.campana = campana; s.ant = ant; s.persist = persist }))

// ── (B) ENDOSO_Z por nº de pólizas (RP como PRODUCTO: factor depende de la columna) ──
casos.push(mk('RP producto · 1 póliza (col 0-1 → 0.25)', s => { s.campana = false; s.qty.RP = 1 }))
casos.push(mk('RP producto · 2 pólizas (col 2 → 0.50)', s => { s.campana = false; s.qty.RP = 1; s.qty.AP = 1 }))
casos.push(mk('RP producto · ≥3 pólizas (col ≥3 → 0.50)', s => { s.campana = false; s.qty.RP = 1; s.qty.AP = 1; s.qty.TP = 1 }))
casos.push(mk('RP producto · 1 póliza CON campaña (CAMP_PRODS 0.50 tope 300)', s => { s.campana = true; s.qty.RP = 1 }))

// ── (C) RP como APORTE (A3: 5% del monto) ──
casos.push(mk('RP aporte 3020 (→151 esperado)', s => { s.campana = false; s.rpMonto = 3020 }))
casos.push(mk('RP aporte 1250', s => { s.campana = false; s.rpMonto = 1250 }))
casos.push(mk('RP aporte + RP producto juntos', s => { s.campana = false; s.qty.RP = 1; s.rpMonto = 1500 }))

// ── (D) APVF producto y aporte, con/ sin campaña, capUF ──
casos.push(mk('APVF producto sin campaña (0.25)', s => { s.campana = false; s.qty.APVF = 1; s.prima.APVF = 50 }))
casos.push(mk('APVF producto CON campaña (0.50, capUF 500)', s => { s.campana = true; s.qty.APVF = 1; s.prima.APVF = 50 }))
casos.push(mk('APVF producto campaña capUF binding (prima 60 → PPA 720 > 500)', s => { s.campana = true; s.qty.APVF = 1; s.prima.APVF = 60 }))
casos.push(mk('APVF aporte traspaso 2000 (quirk ventas++)', s => { s.campana = false; s.apvFlexEx = 2000 }))
casos.push(mk('APVF aporte traspaso 2000 con 1 BL', s => { s.campana = false; s.qty.BL = 1; s.apvFlexEx = 2000 }))

// ── (E) Aportes APV / BL extraordinarios ──
casos.push(mk('APV aporte extra 1000 (0-1 pól)', s => { s.campana = false; s.apvEx = 1000 }))
casos.push(mk('BL aporte extra 1000 (0-1 pól → 0.50)', s => { s.campana = false; s.blEx = 1000 }))
casos.push(mk('BL aporte extra 1000 (≥3 pól → 0.80)', s => { s.campana = false; s.qty.BL = 3; s.blEx = 1000 }))

// ── (F) Exceso bajo vs sobre tope (tramo 5) ──
casos.push(mk('Exceso bajo tope (BL=3 sin camp, t5, ant6 tope300)', s => { s.campana = false; s.qty.BL = 3; s.prima.BL = 10; s.ant = 6; s.t5.r1 = true; s.persist = 92 }))
casos.push(mk('Exceso SOBRE tope (BL=1 prima alta sin camp, ant6 tope300)', s => { s.campana = false; s.qty.BL = 1; s.prima.BL = 60; s.ant = 6; s.t5.r1 = true; s.persist = 92 }))
casos.push(mk('Exceso SOBRE tope contrato pero campaña libera', s => { s.campana = true; s.qty.BL = 1; s.prima.BL = 60; s.ant = 6; s.t5.r1 = true; s.persist = 92 }))
casos.push(mk('Tramo5 sin req t5 (no checks)', s => { s.campana = false; s.qty.BL = 8; s.persist = 92 }))
casos.push(mk('Tramo5 persist<85 (t5 marcado pero 80)', s => { s.campana = false; s.qty.BL = 8; s.t5.r1 = true; s.persist = 80 }))

// ── (G) KPI campaña APV (completo vs incompleto) ──
casos.push(mk('KPI completo (BL+APV+SS+GI) campaña → APV 100%', s => { s.campana = true; s.qty.BL = 1; s.qty.APV = 1; s.qty.SS = 1; s.qtyGI.HOGAR = 1 }))
casos.push(mk('KPI incompleto (solo APV) campaña → APV 50%', s => { s.campana = true; s.qty.APV = 1 }))
casos.push(mk('KPI por kpi.salud=true sin SS', s => { s.campana = true; s.qty.BL = 1; s.qty.APV = 1; s.qtyGI.HOGAR = 1; s.kpi.salud = true }))

// ── (H) GI tope 25% vs liberado ──
casos.push(mk('GI excede tope 25% (sin campaña)', s => { s.campana = false; s.qty.BL = 1; s.qtyGI.AUTO = 1; s.qtyGI.HOGAR = 1; s.primaGI.AUTO = 20; s.primaGI.HOGAR = 20 }))
casos.push(mk('GI liberado (mismo mix, campaña)', s => { s.campana = true; s.qty.BL = 1; s.qtyGI.AUTO = 1; s.qtyGI.HOGAR = 1; s.primaGI.AUTO = 20; s.primaGI.HOGAR = 20 }))

// ── (I) Comisiones / topes de comisión ──
casos.push(mk('TP=2 tope comisión UF10', s => { s.campana = false; s.qty.TP = 2; s.prima.TP = 30 }))
casos.push(mk('FP=2 tope comisión UF0.22 + incentivo tope', s => { s.campana = false; s.qty.FP = 2; s.prima.FP = 30 }))
casos.push(mk('APV comisión cUF 0.08', s => { s.campana = false; s.qty.APV = 3 }))

// ── (J) Bonos Top 20 ──
casos.push(mk('Top20 APE #1', s => { s.bonos.top20ape = true; s.rankApe = 1 }))
casos.push(mk('Top20 CV #5', s => { s.bonos.top20cv = true; s.rankCv = 5 }))
casos.push(mk('Top20 ambos #20 (último)', s => { s.bonos.top20ape = true; s.bonos.top20cv = true; s.rankApe = 20; s.rankCv = 20 }))
casos.push(mk('Top20 rank fuera de escala (#21 → 0)', s => { s.bonos.top20ape = true; s.rankApe = 21 }))

// ── (K) Replicas de las liquidaciones reales (insumos aproximados) ──
casos.push(mk('liq1 Nazaret FEB (RP producto 1 pól + GI)', s => { s.campana = false; s.ant = 18; s.persist = 87.5; s.qty.RP = 1; s.prima.RP = 25.166667; s.qtyGI.AUTO = 1; s.primaGI.AUTO = 3.71; s.qtyGI.HOGAR = 1; s.primaGI.HOGAR = 0.18667; s.t5.r1 = true }))

/* ═══════════════════════════════════════════════════════════════════════
   4) EJECUCIÓN Y COMPARACIÓN (vivo vs espejo)
   ═══════════════════════════════════════════════════════════════════════ */
const CAMPOS = [
  'zVI', 'zGIBruto', 'zGI', 'zGITopado', 'zTotal',
  'comVenta', 'incMant', 'ventas', 'bonoApe', 'bonoCv',
  'bonoUF', 't5Hab', 'tope_t5', 'fp', 'bonoNeto', 'total',
]
const { computeVivo, R: VIVO } = cargarVivo()
const computeEspejo = E.computeEspejo
const clone = (o) => structuredClone(o)

let fallos = 0
const detalles = []
for (let i = 0; i < casos.length; i++) {
  const { desc, ss } = casos[i]
  const campana = ss.campana
  const vivo = computeVivo(clone(ss), campana)
  const esp = computeEspejo(clone(ss), campana)
  const difs = []
  for (const k of CAMPOS) {
    const a = vivo[k], b = esp[k]
    const igual = (typeof a === 'number' && typeof b === 'number') ? a === b : a === b
    if (!igual) difs.push({ campo: k, vivo: a, espejo: b })
  }
  if (difs.length) { fallos++; detalles.push({ idx: i, desc, difs }) }
}

/* ═══════════════════════════════════════════════════════════════════════
   5) REPORTE
   ═══════════════════════════════════════════════════════════════════════ */
console.log('ESPEJO DE SOLO LECTURA — motor VIVO (calculo.ts) vs ESPEJO independiente')
console.log(`Escenarios: ${casos.length} · UF=${UF} · tolerancia=0 (igualdad estricta)`)
console.log(`Campos comparados: ${CAMPOS.join(', ')}\n`)

if (fallos === 0) {
  console.log(`✅ ESPEJO FIEL: ${casos.length}/${casos.length} escenarios idénticos al vivo (Δ=0 en todos los campos).`)
} else {
  console.log(`❌ ESPEJO NO FIEL en ${fallos}/${casos.length} escenarios:\n`)
  for (const d of detalles) {
    console.log(`  [${d.idx}] ${d.desc}`)
    for (const x of d.difs) console.log(`      - ${x.campo}: vivo=${x.vivo} vs espejo=${x.espejo}`)
  }
  process.exitCode = 1
}

// ── Anexo: comportamiento del vivo en casos de borde conocidos (solo describe) ──
console.log('\n── ANEXO: "así se comporta hoy el vivo" (sin proponer cambios) ──')
function showVivo(desc, fn) {
  const ss = base(); fn(ss)
  const r = computeVivo(clone(ss), ss.campana)
  console.log(`  · ${desc}\n      zVI=${r.zVI}  zTotal=${r.zTotal}  bonoUF=${r.bonoUF}  fp=${r.fp}  total=${Math.round(r.total)}`)
}
showVivo('RP producto 1 póliza, PPA 302, sin campaña (D3: factor 0.25)', s => { s.campana = false; s.qty.RP = 1; s.prima.RP = 25.166667 })
showVivo('RP producto ≥3 pólizas, PPA 302, sin campaña (factor 0.50)', s => { s.campana = false; s.qty.RP = 1; s.prima.RP = 25.166667; s.qty.AP = 1; s.qty.TP = 1 })
showVivo('RP aporte monto 3020, sin campaña (A3: 5% → 151)', s => { s.campana = false; s.rpMonto = 3020 })
showVivo('BL prima alta exceso>tope, sin campaña (D2: topa el exceso)', s => { s.campana = false; s.qty.BL = 1; s.prima.BL = 60; s.ant = 6; s.t5.r1 = true; s.persist = 92 })

/* ═══════════════════════════════════════════════════════════════════════
   6) D13 — Caso "Diego Pérez": ¿se suma/aparece el tramo 5 cuando corresponde?
      (verificado en el ESPEJO; cada corrida se contrasta con el vivo)
   ═══════════════════════════════════════════════════════════════════════ */
function diego(persist) {
  const s = base()
  s.asesor = 'Diego Pérez'
  s.ant = 15
  s.persist = persist
  s.campana = true
  s.qty.BLF = 1; s.prima.BLF = 8     // BL Flex 8 UF/mes → PPA 96
  s.qty.APV = 1; s.prima.APV = 20    // APV 20 UF/mes → PPA 240
  s.qty.APVF = 1; s.prima.APVF = 2   // APV Flex 2 UF/mes → PPA 24
  s.qty.SS = 1; s.prima.SS = 0.1     // salud marginal (KPI)
  s.qtyGI.AUTO = 1; s.primaGI.AUTO = 0.1  // GI marginal (KPI)
  s.qtyGI.HOGAR = 1; s.primaGI.HOGAR = 0.1
  s.t5 = { r1: true, r2: true, r3: true, r4: true, r5: false } // 4 pólizas de vida marcadas
  return s
}
const SB = 540000 // sueldo base del enunciado

function cardLineas(det) {
  // Reproduce EXACTO el render de la tarjeta (page.tsx:631-643): muestra valor si ap>0, si no "—".
  return det.map((t) => {
    const a = t.ap > 0
    return `      ${t.lbl.padEnd(16)} AE:${(a ? t.ap.toFixed(1) : '—').padStart(7)}  ${String(Math.round(t.pct * 100) + '%').padStart(4)}  UF:${(a ? t.uf.toFixed(2) : '—').padStart(7)}${t.motivo ? '   [' + t.motivo + ']' : ''}${t.capped ? '   [capped]' : ''}`
  }).join('\n')
}

function corridaDiego(rotulo, persist, flagD13a = false) {
  const s = diego(persist)
  // VIVO (módulo real)
  const ant = s.ant, pR = s.persist / 100, pM = VIVO.PMIN(ant), fp = VIVO.FP(pR, pM, ant)
  const vz = VIVO.simCalcZ(clone(s), true, UF)
  const vb = VIVO.simCalcBonoUF(vz.zTotal, ant, true, clone(s), flagD13a)
  // ESPEJO (independiente)
  const ez = E.simCalcZ(clone(s), true, UF)
  const eb = E.simCalcBonoUF(ez.zTotal, ant, true, clone(s), flagD13a)
  const fiel = JSON.stringify(vb.det) === JSON.stringify(eb.det) && vz.zVI === ez.zVI && vz.zTotal === ez.zTotal && vb.uf === eb.uf
  const bonoNeto = vb.uf * fp * UF
  const total = SB + bonoNeto + vz.comVenta + vz.incMant + vz.bonoApe + vz.bonoCv
  const objetivo = VIVO.PMIN(ant)          // persistencia objetivo (PMIN)
  const cumplimiento = (persist / 100) / objetivo
  console.log(`\n  ${rotulo}`)
  console.log(`    persist=${persist}%  ·  objetivo(PMIN)=${(objetivo * 100).toFixed(0)}%  ·  cumplimiento=${(cumplimiento * 100).toFixed(1)}%  ·  factor persistencia (fp)=${fp}`)
  console.log(`    ¿persist≥85% ABSOLUTO? ${persist >= 85 ? 'sí' : 'NO'}   ·   ¿cumplimiento≥85% del target? ${cumplimiento >= 0.85 ? 'sí' : 'no'}   →   cumpleT5(vivo)=${vb.t5Hab}`)
  console.log(`    zVI=${vz.zVI.toFixed(2)}  zGI=${vz.zGI.toFixed(2)}  zTotal=${vz.zTotal.toFixed(2)}  ·  tope_t5=${vb.tope_t5}`)
  console.log(`    Tarjeta "Transformación AE Puntos → Bono UF":`)
  console.log(cardLineas(vb.det))
  console.log(`    bonoUF=${vb.uf.toFixed(4)} UF  ·  bono pesos (×fp×UF)=${Math.round(bonoNeto).toLocaleString('es-CL')}  ·  total(+SB ${SB.toLocaleString('es-CL')})=${Math.round(total).toLocaleString('es-CL')}`)
  console.log(`    espejo≡vivo: ${fiel ? '✅ idéntico' : '❌ DIFIERE'}`)
  // exceso sobre 200 explícito
  const exceso = Math.max(0, vz.zTotal - 200)
  const tope = vb.tope_t5
  const tramo5SiSumara = (tope === null ? exceso : Math.min(exceso, tope)) * 0.10
  console.log(`    [exceso sobre 200 = ${exceso.toFixed(2)} Z → tramo 5 "valdría" ${tramo5SiSumara.toFixed(2)} UF; hoy ${vb.t5Hab ? 'SE SUMA' : 'NO se suma (se pierde)'}]`)
  return { vb, fp, exceso, tramo5SiSumara }
}

console.log('\n══════════════════════════════════════════════════════════════════')
console.log('D13a — Caso Diego Pérez con FLAG OFF vs FLAG ON (ant 15, persist 74%)')
console.log('══════════════════════════════════════════════════════════════════')

// FLAG OFF = vivo idéntico; FLAG ON = persistencia relativa al objetivo
corridaDiego('① FLAG OFF (vivo) — persist 74%, cumplimiento 90,2%', 74, false)
corridaDiego('② FLAG ON  (D13a)  — persist 74%, cumplimiento 90,2%', 74, true)

// Q3) Aritmética de referencia de la supervisora: zTotal = 452 (hipotético, mix distinto al de Diego)
console.log('\n  Q3) Referencia supervisora con zTotal = 452 (mismo ant/campaña/t5):')
for (const [flag, lbl] of [[false, 'FLAG OFF'], [true, 'FLAG ON ']]) {
  const s = diego(74)
  const b = VIVO.simCalcBonoUF(452, 15, true, clone(s), flag)
  console.log(`    ${lbl} persist=74%  cumpleT5=${b.t5Hab}  →  bonoUF=${b.uf.toFixed(2)} UF  (tramo5=${b.det[4].uf.toFixed(2)} UF)`)
}

/* ═══════════════════════════════════════════════════════════════════════
   7) VALIDACIÓN DEL FLAG sobre los 83 escenarios
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n══════════════════════════════════════════════════════════════════')
console.log('VALIDACIÓN DEL FLAG D13a sobre los 83 escenarios')
console.log('══════════════════════════════════════════════════════════════════')

// (1) Regresión: FLAG OFF debe ser idéntico al vivo (espejo independiente E, que refleja main).
let regresiones = 0
for (const { desc, ss } of casos) {
  const off = computeVivo(clone(ss), ss.campana, false)
  const ref = computeEspejo(clone(ss), ss.campana) // E sin flag = comportamiento main
  for (const k of CAMPOS) if (off[k] !== ref[k]) { regresiones++; console.log(`   ⚠ regresión [${desc}] ${k}: off=${off[k]} ref=${ref[k]}`); break }
}
console.log(`(1) Regresión FLAG OFF vs vivo: ${regresiones === 0 ? '✅ 0 diferencias (flag apagado = vivo idéntico)' : '❌ ' + regresiones + ' regresiones'}`)

// (2) FLAG ON vs FLAG OFF: qué escenarios cambian y en qué campo.
const cambios = []
for (const { desc, ss } of casos) {
  const off = computeVivo(clone(ss), ss.campana, false)
  const on = computeVivo(clone(ss), ss.campana, true)
  const campos = CAMPOS.filter((k) => off[k] !== on[k])
  if (campos.length) {
    const ant = ss.ant, obj = VIVO.PMIN(ant) * 100, cumpl = ss.persist / (VIVO.PMIN(ant))
    cambios.push({ desc, campos, ant, persist: ss.persist, obj, cumpl, offUF: off.bonoUF, onUF: on.bonoUF })
  }
}
console.log(`\n(2) FLAG ON vs OFF: ${cambios.length}/${casos.length} escenarios cambian:`)
for (const c of cambios) {
  console.log(`   · ant=${c.ant} persist=${c.persist}% objetivo=${c.obj.toFixed(0)}% cumpl=${c.cumpl.toFixed(1)}% | bonoUF ${c.offUF.toFixed(2)}→${c.onUF.toFixed(2)} | campos: ${c.campos.join(',')}`)
}
// Clasificación según la condición que esperaba el cliente (objetivo<85% y real en [85%·obj, 85))
const inesperados = cambios.filter((c) => !(c.obj < 85 && c.persist >= 0.85 * c.obj && c.persist < 85 && c.campos.includes('bonoUF')))
console.log(`\n   Esperados por la regla "objetivo<85% y persist en [85%·obj, 85)" con bonoUF afectado: ${cambios.length - inesperados.length}`)
console.log(`   Otros cambios (revisar): ${inesperados.length}`)
for (const c of inesperados) console.log(`      ↳ ant=${c.ant} persist=${c.persist}% objetivo=${c.obj.toFixed(0)}% campos=${c.campos.join(',')}`)

// (3) Liquidación real NUEVO_BONO_PRODUCCION: objetivo 82%, real 90%, exceso 384,2 → 38,42 UF.
console.log('\n(3) Liquidación real (objetivo 82% → ant 13-24, real 90%, campaña, zTotal 584,2):')
for (const [flag, lbl] of [[false, 'FLAG OFF'], [true, 'FLAG ON ']]) {
  const s = diego(90); s.ant = 18
  const b = VIVO.simCalcBonoUF(584.2, 18, true, clone(s), flag)
  console.log(`    ${lbl} cumpleT5=${b.t5Hab} tramo5=${b.det[4].uf.toFixed(2)} UF (esperado 38,42)  bonoUF=${b.uf.toFixed(2)}`)
}
