/* ═══════════════════════════════════════════════════════════════════════
   GOLDEN MASTER — Simulador de compensación Zurich (compania-z)
   Fase 0 del plan MODULO_COMPENSACION_PLAN.md.

   Cálculo PURO portado fielmente desde public/compensacion/compania-z/
   (datos.js + renta.js), SIN DOM ni globals. NO toca el compania-z vivo.

   Propósito: snapshot de la conducta ACTUAL de Zurich, número por número,
   para verificar después que el motor genérico la reproduce idéntica.

   ⚠️ Esto replica la conducta TAL CUAL HOY (incluidas las rarezas que marcó
   la auditoría: campaña "reemplaza", tope sobre el exceso del tramo 5, etc.).
   No se corrige nada aquí: el golden master es la verdad de referencia.
═══════════════════════════════════════════════════════════════════════ */
'use strict'
const fs = require('fs')
const path = require('path')

/* ── Constantes (copiadas EXACTAS de datos.js) ── */
const SIM_PRODS = [
  { id:'BL',  n:'Vida Empresarial',          z:2.00, c:.32,  q:1, p:200000, pMax:2000000, incM12:.32,  incM24:.06,  incM120:.036 },
  { id:'PM',  n:'Vida Mujer',                z:2.00, c:.32,  q:0, p:180000, pMax:2000000, incM12:.32,  incM24:.06,  incM120:.036 },
  { id:'TP',  n:'Seguro Temporal',           z:1.00, c:.16,  q:0, p:80000,  pMax:1500000, cTopeUF:10,  incM12:.024, incM24:.024, incM120:.024 },
  { id:'FP',  n:'El Futuro es Hoy AE',       z:1.00, c:.056, q:0, p:100000, pMax:1500000, cTopeUF:0.22, incM12:.056, incM12TopeUF:.22, incM24:.024, incM24TopeUF:.10 },
  { id:'AP',  n:'Acc. Personales',           z:1.00, c:.08,  q:0, p:30000,  pMax:500000,  incM12:.08,  incM24:.08,  incM120:.08 },
  { id:'APV', n:'APV',                       z:0.50, cUF:.08,q:1, p:120000, pMax:2000000 },
  { id:'SS',  n:'Salud',                     z:0.50, c:.08,  q:0, p:50000,  pMax:1000000, incM12:.08,  incM24:.08,  incM120:.08 },
  { id:'BLF', n:'Vida Empresarial Flexible', z:0.50, c:.32,  q:0, p:80000,  pMax:2000000, incM12:.32,  incM24:.06,  incM120:.036 },
]
const SIM_PRODS_GI = [
  { id:'AUTO',  n:'Auto',  z:0.50, q:0, p:25000, pMax:200000 },
  { id:'HOGAR', n:'Hogar', z:1.00, q:0, p:15000, pMax:100000 },
]
const TOP20_APE_UF = [23,18,13,11,9,7,6,6,4,4,3,3,3,2,2,2,1,1,1,1]
const TOP20_CV_UF  = [11,8,8,8,5,5,5,2,2,2,1,1,1,1,1,1,1,1,1,1]
const SIM_METODOS = [
  { id:'ref1', cPV:5,   esNodo:true,  cadena:[{n:1},{n:5},{n:2},{n:1}] },
  { id:'ref2', cPV:2.5, esNodo:true,  cadena:[{n:1},{n:5},{n:3},{n:2}] },
  { id:'ref3', cPV:1.5, esNodo:true,  cadena:[{n:1},{n:2},{n:1},{n:1}] },
  { id:'ref4', cPV:5,   esNodo:true,  cadena:[{n:1},{n:5},{n:2},{n:1}] },
  { id:'dig',  cPV:7,   esNodo:false, cadena:[{n:'—'},{n:7},{n:4},{n:1}] },
  { id:'frio', cPV:40,  esNodo:false, cadena:[{n:'—'},{n:40},{n:10},{n:1}] },
]
const SIM_TRAMOS = [
  { min:0,      max:49.99, pct:.10 },
  { min:50,     max:99.99, pct:.12 },
  { min:100,    max:149.99,pct:.15 },
  { min:150,    max:200,   pct:.18 },
  { min:200.01, max:9999,  pct:.10 },
]
const TOPES_ORIG = [[6,300],[23,700],[47,800],[71,900],[95,1000],[119,1100],[999,1200]]
const TOPES_CAMP = [[6,1000],[12,1500],[24,2000],[999,99999]]
const ENDOSO_Z = {
  BL:[0.80,0.60,0.50], PM:[0.80,0.60,0.50], FP:[0.80,0.60,0.50], TP:[0.70,0.60,0.50],
  AP:[0.70,0.60,0.50], APV:[0.50,0.50,0.25], SS:[0.50,0.50,0.25], BLF:[0.50,0.50,0.25],
  RP:[0.50,0.50,0.25], APVF:[0.25,0.25,0.125],
}
const CAMP_PRODS = {
  BL:{z:2.00,tope:300}, PM:{z:2.00,tope:300}, TP:{z:1.00,tope:null}, AP:{z:1.00,tope:null},
  APV:{z:1.00,tope:600,capUF:500}, BLF:{z:0.50,tope:300}, SS:{z:1.00,tope:null},
  RP:{z:0.50,tope:300}, APVF:{z:0.50,tope:600,capUF:500},
}
const UF_VAL = 39357
const SUELDO_BASE = 539000
const TOPE_T5 = (a,c) => { const t=c?TOPES_CAMP:TOPES_ORIG; for(const [m,v] of t) if(a<=m) return v; return c?null:1200 }
const PMIN = a => a<=12 ? .90 : a<=24 ? .82 : .78
const FP = (r,m,ant) => { const c=r/m; if(c<=.5)return 0; if(c<=.85)return .5; if(c<=.9)return .65; if(c<=.95)return .9; if(c<=1)return 1; return ant>12?1.2:1.0 }

/* ── Estado base (réplica de simState inicial de datos.js) ── */
function baseState() {
  const ss = {
    ant:3, persist:92, campana:true,
    pcts:{ ref1:40, ref2:40, ref3:0, ref4:0, dig:10, frio:10 },
    qty:{}, prima:{}, qtyGI:{}, primaGI:{},
    rpMonto:0, apvEx:0, apvFlexEx:0,
    t5:{ r1:false, r2:false, r3:false, r4:false, r5:false },
    bonos:{ top20ape:false, top20cv:false, grati:true },
    rankApe:10, rankCv:10,
    kpiSalud:undefined, // si undefined => se deriva de qty['SS']>0 (como el render auto-marca)
  }
  SIM_PRODS.forEach(p => { ss.qty[p.id]=p.q; ss.prima[p.id]=parseFloat((p.p/UF_VAL).toFixed(2)) })
  SIM_PRODS_GI.forEach(p => { ss.qtyGI[p.id]=p.q; ss.primaGI[p.id]=parseFloat((p.p/UF_VAL).toFixed(2)) })
  return ss
}

/* ── simCalcZ (portado de renta.js:90-182) ── */
function calcZ(ss, campana) {
  let zVI=0, zGIBruto=0, comVenta=0, incMant=0, ventas=0

  SIM_PRODS.forEach(p => {
    const qty = ss.qty[p.id]; if(!qty) return
    const cp = campana ? CAMP_PRODS[p.id] : null
    const prima = ss.prima[p.id]
    const kpiSaludChk = (ss.kpiSalud === true) || ss.qty['SS']>0
    const tieneVidaMix = SIM_PRODS.some(q => ss.qty[q.id]>0)
    const tieneGIMix   = SIM_PRODS_GI.some(q => ss.qtyGI[q.id]>0)
    const kpiCumpleCalc = kpiSaludChk && tieneVidaMix && tieneGIMix
    const usarCamp = cp && (p.id!=='APV' || kpiCumpleCalc)
    const zF = usarCamp ? cp.z : p.z
    let ppaUF = prima*12
    if (usarCamp && cp && cp.capUF) ppaUF = Math.min(ppaUF, cp.capUF*qty)
    let zT = ppaUF*zF
    if (usarCamp && cp && cp.tope) zT = Math.min(zT, cp.tope*qty)
    zVI += zT; ventas += qty

    let cV=0
    const primaCLP = prima*UF_VAL
    if (p.cUF) { cV = p.cUF*UF_VAL*qty }
    else if (p.c) { cV = primaCLP*p.c*qty; if(p.cTopeUF) cV = Math.min(cV, p.cTopeUF*UF_VAL*qty) }
    comVenta += cV

    let incT=0, incTasa=null, incTopeUF=null
    if (ss.ant>=2) {
      if      (ss.ant<=12 && p.incM12)  { incTasa=p.incM12;  incTopeUF=p.incM12TopeUF }
      else if (ss.ant<=24 && p.incM24)  { incTasa=p.incM24;  incTopeUF=p.incM24TopeUF }
      else if (ss.ant>24  && p.incM120) { incTasa=p.incM120 }
      if (incTasa) { incT = primaCLP*incTasa*qty; if(incTopeUF) incT = Math.min(incT, incTopeUF*UF_VAL*qty) }
    }
    incMant += incT
  })

  const endosoCol = ventas>=3 ? 0 : ventas===2 ? 1 : 2

  if (ss.apvFlexEx>0) { const zFactor=ENDOSO_Z.APVF[endosoCol]; const ppaF=ss.apvFlexEx*0.10; zVI += ppaF*zFactor }
  if (ss.apvEx>0)     { const zFactor=ENDOSO_Z.APV[endosoCol];  const ppaEq=ss.apvEx*0.10;   zVI += ppaEq*zFactor }
  if (ss.rpMonto>0)   { const zFactor=ENDOSO_Z.RP[endosoCol];   const ppaRP=ss.rpMonto*0.10;  zVI += ppaRP*zFactor }

  SIM_PRODS_GI.forEach(p => { const qty=ss.qtyGI[p.id]; if(!qty) return; const ppaUF=ss.primaGI[p.id]*12; zGIBruto += ppaUF*p.z })
  const topeGI = campana ? Infinity : zVI*0.25
  const zGI = Math.min(zGIBruto, topeGI)
  const zTotal = zVI + zGI

  let bonoApe=0, bonoCv=0
  if (ss.bonos.top20ape) bonoApe = (TOP20_APE_UF[ss.rankApe-1]||0)*UF_VAL
  if (ss.bonos.top20cv)  bonoCv  = (TOP20_CV_UF[ss.rankCv-1]||0)*UF_VAL

  return { zVI, zGIBruto, zGI, zGITopado: zGIBruto>topeGI, zTotal, comVenta, incMant, ventas, bonoApe, bonoCv }
}

/* ── simCalcBonoUF (portado de renta.js:184-202) ── */
function calcBonoUF(z, ant, campana, ss) {
  const tope_t5 = TOPE_T5(ant, campana)
  const cumpleT5 = Object.values(ss.t5).some(v => v) && (ss.persist/100) >= 0.85
  let uf = 0
  for (const t of SIM_TRAMOS) {
    if (t.min >= 200) {
      if (z<=200 || !cumpleT5) continue
      const exceso = z-200
      const ap = tope_t5===null ? exceso : Math.min(exceso, tope_t5)
      uf += ap*t.pct
      continue
    }
    if (z<=t.min) continue
    const ap = Math.min(z,t.max)-t.min; if(ap<=0) continue
    uf += ap*t.pct
  }
  return { uf, t5Hab:cumpleT5, tope_t5 }
}

/* ── Embudo / metas (portado de renta.js:257-265 y simRenderFunnel:363-372) ── */
function calcFunnel(ss, ventas) {
  const metaContactos = Math.max(1, Math.round(
    SIM_METODOS.filter(m=>m.esNodo).reduce((a,m)=>{ const pct=(ss.pcts[m.id]||0)/100; return a+(pct>0?Math.ceil(ventas*pct):0) },0)/4
  ))
  const metaProspectos = Math.max(1, Math.round(
    SIM_METODOS.reduce((a,m)=>{ const pct=(ss.pcts[m.id]||0)/100; if(pct===0) return a
      const prosp = m.esNodo ? Math.round(ventas*pct*(m.cadena?m.cadena[1].n:5)) : Math.round(ventas*pct*m.cPV)
      return a+prosp }, 0)
  ))
  const activos = SIM_METODOS.map(m=>{ const pct=(ss.pcts[m.id]||0)/100; if(pct===0) return null
    const vM=ventas*pct; const contactos=m.esNodo?Math.ceil(vM):0; const prospectos=m.esNodo?Math.ceil(vM)*5:Math.round(vM*m.cPV)
    return { esNodo:m.esNodo, contactos, prospectos } }).filter(Boolean)
  const totC = activos.filter(m=>m.esNodo).reduce((a,m)=>a+m.contactos,0)
  const totP = activos.reduce((a,m)=>a+m.prospectos,0)
  return { metaContactos, metaProspectos, funnelTotContactos: totC, funnelTotProspectos: totP }
}

/* ── Resultado completo (portado de simRender:204-211) ── */
function calcAll(ss) {
  const campana = ss.campana
  const ant=ss.ant, pR=ss.persist/100, pM=PMIN(ant), fp=FP(pR,pM,ant)
  const z = calcZ(ss, campana)
  const bono = calcBonoUF(z.zTotal, ant, campana, ss)
  const bonoNeto = bono.uf * fp * UF_VAL
  const total = SUELDO_BASE + bonoNeto + z.comVenta + z.incMant + z.bonoApe + z.bonoCv
  const funnel = calcFunnel(ss, z.ventas)
  const r = num => Math.round(num*1e6)/1e6 // estabiliza ruido de punto flotante
  return {
    zVI:r(z.zVI), zGI:r(z.zGI), zGITopado:z.zGITopado, zTotal:r(z.zTotal),
    ventas:z.ventas, comVenta:Math.round(z.comVenta), incMant:Math.round(z.incMant),
    bonoUF:r(bono.uf), t5Hab:bono.t5Hab, tope_t5:bono.tope_t5,
    fp, bonoNeto:Math.round(bonoNeto), bonoApe:Math.round(z.bonoApe), bonoCv:Math.round(z.bonoCv),
    ingresoTotal:Math.round(total),
    metaContactos:funnel.metaContactos, metaProspectos:funnel.metaProspectos,
    funnelTotContactos:funnel.funnelTotContactos, funnelTotProspectos:funnel.funnelTotProspectos,
  }
}

/* ── Matriz de escenarios ── */
function mk(desc, fn) { const ss = baseState(); fn(ss); return { desc, ss } }
const scenarios = [
  mk('Default (BL=1, APV=1, campaña ON, ant 3, persist 92)', () => {}),
  mk('Default sin campaña', s => { s.campana=false }),
  mk('Solo BL=1, sin APV, campaña ON', s => { s.qty.APV=0 }),
  mk('Mix 1x1x1: BL + AUTO(GI) + SS(salud), campaña ON', s => { s.qtyGI.AUTO=1; s.qty.SS=1 }),
  mk('Mix 1x1x1 sin campaña', s => { s.qtyGI.AUTO=1; s.qty.SS=1; s.campana=false }),
  mk('APV con KPI completo (BL+GI+SS) campaña ON', s => { s.qty.BL=1; s.qty.APV=1; s.qtyGI.HOGAR=1; s.qty.SS=1 }),
  mk('APV sin KPI (solo APV) campaña ON -> 50%', s => { s.qty.BL=0; s.qty.APV=1 }),
  mk('Alta producción: BL=5, PM=3, campaña ON', s => { s.qty.BL=5; s.qty.PM=3 }),
  mk('Alta producción sin campaña (topes contrato)', s => { s.qty.BL=5; s.qty.PM=3; s.campana=false }),
  mk('Antigüedad 1 mes (sin incentivo mantención)', s => { s.ant=1 }),
  mk('Antigüedad 13 meses', s => { s.ant=13 }),
  mk('Antigüedad 25 meses', s => { s.ant=25 }),
  mk('Antigüedad 50 meses', s => { s.ant=50 }),
  mk('Antigüedad 120 meses', s => { s.ant=120 }),
  mk('Persistencia 40% (factor 0)', s => { s.persist=40 }),
  mk('Persistencia 84% (factor 0.5)', s => { s.persist=84 }),
  mk('Persistencia 88% (factor 0.65)', s => { s.persist=88 }),
  mk('Persistencia 96% (factor 1.0)', s => { s.persist=96 }),
  mk('Persistencia 105% ant>12 (factor 1.2)', s => { s.ant=24; s.persist=105 }),
  mk('Persistencia 105% ant<=12 (factor 1.0)', s => { s.ant=6; s.persist=105 }),
  mk('Tramo 5 habilitado (alta prod + T5 r1 + persist 92)', s => { s.qty.BL=8; s.qty.PM=4; s.t5.r1=true }),
  mk('Tramo 5 NO (alta prod pero sin checks T5)', s => { s.qty.BL=8; s.qty.PM=4 }),
  mk('Tramo 5 con campaña (alta prod)', s => { s.qty.BL=8; s.qty.PM=4; s.t5.r1=true; s.campana=true }),
  mk('Bono Top20 APE rank #1', s => { s.bonos.top20ape=true; s.rankApe=1 }),
  mk('Bono Top20 CV rank #5', s => { s.bonos.top20cv=true; s.rankCv=5 }),
  mk('Ambos bonos Top20 rank #10', s => { s.bonos.top20ape=true; s.bonos.top20cv=true }),
  mk('Aporte APV extra 1000 UF', s => { s.apvEx=1000 }),
  mk('APV Flex traspaso 2000 UF', s => { s.apvFlexEx=2000 }),
  mk('Futura Renta (RP) 1500 UF', s => { s.rpMonto=1500 }),
  mk('Solo aportes (sin pólizas VI): RP 1000', s => { s.qty.BL=0; s.qty.APV=0; s.rpMonto=1000 }),
  mk('Solo GI (Auto+Hogar), sin VI, sin campaña', s => { s.qty.BL=0; s.qty.APV=0; s.qtyGI.AUTO=1; s.qtyGI.HOGAR=1; s.campana=false }),
  mk('GI excede tope 25% sin campaña', s => { s.qty.BL=1; s.qtyGI.AUTO=4; s.qtyGI.HOGAR=4; s.campana=false }),
  mk('Mix de prospección distinto (ref3 100%)', s => { s.pcts={ ref1:0, ref2:0, ref3:100, ref4:0, dig:0, frio:0 } }),
  mk('Prospección 100% frío', s => { s.pcts={ ref1:0, ref2:0, ref3:0, ref4:0, dig:0, frio:100 } }),
  mk('Temporal con tope comisión UF10 (TP=2)', s => { s.qty.TP=2 }),
  mk('Futuro Presente FP=2 (tope comisión UF0.22)', s => { s.qty.FP=2 }),
]

/* ── Ejecutar y snapshotear ── */
function run() {
const snapshot = scenarios.map((sc, i) => ({
  idx: i,
  desc: sc.desc,
  inputs: {
    ant: sc.ss.ant, persist: sc.ss.persist, campana: sc.ss.campana,
    qty: Object.fromEntries(Object.entries(sc.ss.qty).filter(([,v]) => v>0)),
    qtyGI: Object.fromEntries(Object.entries(sc.ss.qtyGI).filter(([,v]) => v>0)),
    aportes: { rpMonto: sc.ss.rpMonto, apvEx: sc.ss.apvEx, apvFlexEx: sc.ss.apvFlexEx },
    bonos: sc.ss.bonos, t5: sc.ss.t5,
  },
  output: calcAll(sc.ss),
}))

const outDir = __dirname
fs.writeFileSync(path.join(outDir, 'golden-master.json'), JSON.stringify({ meta: { generadoEl: '2026-06-02', fuente: 'compania-z (renta.js + datos.js)', UF_VAL, SUELDO_BASE }, escenarios: snapshot }, null, 2))

/* ── Resumen legible en consola ── */
console.log('GOLDEN MASTER — Zurich · ' + snapshot.length + ' escenarios\n')
console.log('idx | AE total | bono UF | ingreso $   | ventas | contactos/sem | prospectos/mes | escenario')
console.log('----+----------+---------+-------------+--------+---------------+----------------+----------')
for (const s of snapshot) {
  const o = s.output
  console.log(
    String(s.idx).padStart(3) + ' | ' +
    String(o.zTotal.toFixed(1)).padStart(8) + ' | ' +
    String(o.bonoUF.toFixed(2)).padStart(7) + ' | ' +
    ('$'+o.ingresoTotal.toLocaleString('es-CL')).padStart(11) + ' | ' +
    String(o.ventas).padStart(6) + ' | ' +
    String(o.metaContactos).padStart(13) + ' | ' +
    String(o.metaProspectos).padStart(14) + ' | ' +
    s.desc
  )
}
console.log('\nSnapshot escrito en tools/compensacion-golden/golden-master.json')
}

if (require.main === module) run()

// Exportado para que el validador del motor genérico use los MISMOS escenarios y cálculo de referencia.
module.exports = { baseState, scenarios, calcAll, calcZ, calcBonoUF, calcFunnel, UF_VAL, SUELDO_BASE }
