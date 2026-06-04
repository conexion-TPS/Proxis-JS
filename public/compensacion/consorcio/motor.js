/* ═══════════════════════════════════════════════════════════════════════
   MOTOR CONSORCIO (ProX) — navegador + Node. Nomenclatura ofuscada (ProX).
   Implementa el contrato del módulo de compensación para el tenant 'consorcio'.
   Validado contra los ejemplos de la fuente (ver consorcio-confidencial/).
   Expone window.MotorConsorcio. Números reales; nombres de producto = ProX.
═══════════════════════════════════════════════════════════════════════ */
'use strict'
;(function (root) {

  function lookup(tabla, x) { for (const [d, h, v] of tabla) if (x >= d && x <= h) return v; return 0 }

  // ── Tablas ──
  const Tabla_ProdVida = [[0,299,5],[300,649,40],[650,949,455],[950,1199,550],[1200,1499,610],[1500,Infinity,650]]
  const Tabla_BonoExc  = [[0,649,0],[650,949,100000],[950,1199,180000],[1200,1499,350000],[1500,Infinity,480000]]
  const Tabla_Amplif   = [[0,649,1.0],[650,949,1.2],[950,1199,1.4],[1200,1499,1.6],[1500,Infinity,1.8]]
  const Tabla_ValorRecaud = [[0,299,12000],[300,649,13500],[650,949,15000],[950,1199,16500],[1200,1499,18000],[1500,Infinity,19500]]
  const ComInv_rates = {
    PVX_I06:{tasa:0.0036,topeUF:null}, PVX_I01:{tasa:0.0036,topeUF:17}, PVX_I02:{tasa:0.0031,topeUF:17},
    PVX_I03:{tasa:0.0036,topeUF:17}, PVX_I05:{tasa:0.0036,topeUF:130}, PVX_I04:{tasa:0.0036,topeUF:17},
  }
  const Multi_rates = {
    PVX_B_CP:{fijoCLP:28500}, PVX_B_CM:{fijoCLP:10500}, PVX_B_CO:{tasaUF:0.016}, PVX_B_HI:{tasaUF:0.00089},
    PVX_G_AU_anual:{tasaUF:0.0436}, PVX_G_AU_bienal:{tasaUF:0.0327}, PVX_G_HO:{tasaUF:0.0942},
  }
  const Pond_AUM = { PVX_VP:0.000075, PVX_FM_MM:0.000070, PVX_FM_RF:0.000093, PVX_FM_RV:0.000163 }
  const PrimerMes = {
    Tier_1:[[0,59,800000],[60,89,830000],[90,Infinity,1300000]],
    Tier_2:[[90,109,1300000],[110,139,1600000],[140,169,1900000],[170,Infinity,2200000]],
    Tier_3:[[140,169,1900000],[170,199,2200000],[200,229,2900000],[230,259,3200000],[260,299,3500000],[300,Infinity,3800000]],
  }

  // ── Matriz de persistencia (Factor_Ret 1–10): % cartera vigente × antigüedad ──
  const RAW = {
    62:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1',63:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4',
    64:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4',65:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4',
    66:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5',67:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5',
    68:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5 5 6',69:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5 5 5 6 6',
    70:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5 5 5 6 6 6 6',71:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5 5 5 6 6 6 6 6 6',
    72:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6',73:'1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6 7 7',
    74:'1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6 7 7 7 7',75:'1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6 7 7 7 7 8 8',
    76:'1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5 5 5 5 5 6 6 6 6 6 6 6 6 7 7 7 8 8 8 8',77:'1 1 1 1 1 1 1 1 1 4 4 4 4 5 5 5 5 5 5 6 6 6 6 6 6 6 6 7 7 7 8 8 8 8 8 8',
    78:'1 1 1 1 1 1 1 1 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8',79:'1 1 1 1 1 1 1 4 4 4 5 5 5 6 6 6 6 6 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8 8 9',
    80:'1 1 1 1 4 4 4 4 4 5 5 5 6 6 6 6 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8 8 8 9 9',81:'1 1 1 4 4 4 4 4 5 5 6 6 6 6 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9',
    82:'1 1 1 4 4 4 4 5 5 6 6 6 6 6 6 6 7 7 7 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9 9 10',83:'1 1 1 4 4 4 4 5 5 6 6 6 6 6 6 6 7 7 7 7 7 8 8 8 8 8 8 8 8 9 9 9 9 9 10 10',
    84:'1 1 4 4 5 5 5 5 6 6 6 6 6 7 7 7 7 7 7 8 8 8 8 8 8 8 8 9 9 9 9 9 10 10 10 10',85:'1 1 4 5 5 5 5 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9 9 10 10 10 10 10 10',
    86:'1 1 4 5 6 6 6 6 6 6 7 7 7 8 8 8 8 8 8 8 8 8 8 9 9 9 9 9 9 10 10 10 10 10 10 10',87:'4 4 5 6 6 6 6 6 6 7 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10',
    88:'4 4 5 6 6 6 6 6 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10',89:'4 4 6 6 6 6 6 7 7 8 8 8 8 8 8 8 9 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10',
    90:'5 5 6 6 7 7 7 7 8 8 8 8 8 9 9 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',91:'5 5 6 7 7 7 7 8 8 8 8 8 9 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
    92:'6 6 6 7 8 8 8 8 8 8 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',93:'6 6 7 8 8 8 8 8 8 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
    94:'6 6 7 8 8 8 8 8 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',95:'6 6 7 8 8 8 8 8 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
    96:'6 6 8 8 8 8 8 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',97:'7 7 8 8 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
    98:'7 7 8 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',99:'8 8 8 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
    100:'8 8 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
  }
  const MATRIZ = {}; for (const p in RAW) MATRIZ[p] = RAW[p].trim().split(/\s+/).map(Number)
  function factorRet(carteraVigente, antiguedadMeses) {
    if (antiguedadMeses === 2) return 8
    if (antiguedadMeses === 3) return 9
    let pct = carteraVigente <= 1 ? carteraVigente * 100 : carteraVigente
    pct = Math.round(pct); if (pct < 62) return 1; if (pct > 100) pct = 100
    return MATRIZ[pct][Math.min(Math.max(Math.round(antiguedadMeses), 1), 36) - 1]
  }

  // ── Componentes ──
  function comVida(cnsVida, f) { const a = cnsVida * f; return { clp: a * lookup(Tabla_ProdVida, a), uf: 0, cnsAjustados: a } }
  function bonoExc(prom, f) { if (f < 7) return { clp: 0, uf: 0 }; const a = prom * f; return { clp: lookup(Tabla_BonoExc, a), uf: 0, ajustTrim: a } }
  function comInv(ventas) { let uf = 0; for (const v of (ventas || [])) { const r = ComInv_rates[v.prod]; if (!r) continue; let c = v.montoUF * r.tasa; if (r.topeUF != null) c = Math.min(c, r.topeUF); uf += c } return { clp: 0, uf } }
  function bonoMulti(ventas, cnsAjust) { let clp = 0, uf = 0; for (const v of (ventas || [])) { const r = Multi_rates[v.prod]; if (!r) continue; if (r.fijoCLP != null) clp += r.fijoCLP * (v.n || 0); else if (r.tasaUF != null) uf += (v.montoUF || 0) * r.tasaUF } const amp = lookup(Tabla_Amplif, cnsAjust); return { clp: clp * amp, uf: uf * amp, amplificador: amp } }
  function bonoSalud(ufaMensual, vig) { const ini = 0.25 * ufaMensual; const sec = (vig >= 0.80) ? 0.95 * ufaMensual * vig : 0; return { clp: 0, uf: ini + sec, inicial: ini, secundario: sec } }
  function bonoRecaud(polizas, cnsAjustTrim) { let p = 0; for (const x of (polizas || [])) { if ((x.pctRecaud || 0) < 0.85) continue; p += x.primaRefPonderada || 0 } return { clp: p * lookup(Tabla_ValorRecaud, cnsAjustTrim), uf: 0, ponderadas: p } }
  function bonoAUM(s) { let uf = 0; for (const k in Pond_AUM) uf += (s && s[k] || 0) * Pond_AUM[k]; return { clp: 0, uf } }
  function primerMes(cns, tier) { return lookup(PrimerMes[tier] || [], cns) }

  // ── Total (estado estable) ──
  function computeConsorcio(scn, uf) {
    if (uf == null) uf = 39500
    const f = (scn.factorRet != null) ? scn.factorRet : factorRet(scn.carteraVigente || 0, scn.antiguedad || 1)
    const cv = comVida(scn.cnsVida || 0, f)
    const be = bonoExc(scn.promTrimCns || 0, f)
    const ci = comInv(scn.inversiones)
    const bm = bonoMulti(scn.multiproducto, cv.cnsAjustados)
    const bs = bonoSalud(scn.saludUfaMensual || 0, scn.saludVigencia || 0)
    const br = bonoRecaud(scn.recaudPolizas, scn.cnsAjustadosTrim || 0)
    const ba = bonoAUM(scn.aumSaldos)
    const comps = { comVida: cv, bonoExc: be, comInv: ci, bonoMulti: bm, bonoSalud: bs, bonoRecaud: br, bonoAUM: ba }
    let total = (scn.baseGratif != null ? scn.baseGratif : 729000)
    for (const k in comps) total += comps[k].clp + comps[k].uf * uf
    return { factorRet: f, comps, ingresoTotal: Math.round(total) }
  }

  const api = { computeConsorcio, factorRet, comVida, bonoExc, comInv, bonoMulti, bonoSalud, bonoRecaud, bonoAUM, primerMes }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  if (root) root.MotorConsorcio = api
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this))
