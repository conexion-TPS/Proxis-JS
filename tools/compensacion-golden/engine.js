/* ═══════════════════════════════════════════════════════════════════════
   MOTOR GENÉRICO de compensación — Fase 1.
   Interpreta una SPEC declarativa (ver zurich-spec.js) + un escenario,
   y produce la misma salida que el cálculo de Zurich. No conoce Zurich:
   solo el contrato. Una empresa nueva = otra spec, mismo motor.

   El EMBUDO (ventas → contactos/prospectos) es genérico → vive aquí, en el
   núcleo, NO en la spec (decisión acordada). Las tasas son ajustables.
═══════════════════════════════════════════════════════════════════════ */
'use strict'

// Embudo genérico (núcleo). Mismas proporciones de la industria (Granum/LIMRA…).
const SIM_METODOS = [
  { id:'ref1', cPV:5,   esNodo:true,  cadena:[{n:1},{n:5},{n:2},{n:1}] },
  { id:'ref2', cPV:2.5, esNodo:true,  cadena:[{n:1},{n:5},{n:3},{n:2}] },
  { id:'ref3', cPV:1.5, esNodo:true,  cadena:[{n:1},{n:2},{n:1},{n:1}] },
  { id:'ref4', cPV:5,   esNodo:true,  cadena:[{n:1},{n:5},{n:2},{n:1}] },
  { id:'dig',  cPV:7,   esNodo:false, cadena:[{n:'—'},{n:7},{n:4},{n:1}] },
  { id:'frio', cPV:40,  esNodo:false, cadena:[{n:'—'},{n:40},{n:10},{n:1}] },
]

function pmin(spec, ant) {
  const tbl = spec.persistencia.minimaPorAntiguedad
  for (const [m,v] of tbl) if (ant<=m) return v
  return tbl[tbl.length-1][1]
}
function factorPersistencia(spec, r, m, ant) {
  const c = r/m
  for (const [cm,f] of spec.persistencia.factorPorCumplimiento) {
    if (c<=cm) return (f>1.0 && ant<spec.persistencia.bono120SoloDesdeMes) ? 1.0 : f
  }
  return ant>=spec.persistencia.bono120SoloDesdeMes ? 1.2 : 1.0
}
function topeTramo5(spec, ant, campana) {
  const t = campana ? spec.campania.topesPorAntiguedad : spec.topesPorAntiguedad
  for (const [m,v] of t) if (ant<=m) return v
  return campana ? null : 1200
}

function computeZ(spec, ss, campana, uf) {
  let zVI=0, zGIBruto=0, comVenta=0, incMant=0, ventas=0

  const saludId = spec.campania.kpiSaludProductoId
  const kpiSaludChk = (ss.kpiSalud === true) || ss.qty[saludId]>0
  const tieneVidaMix = spec.productosVI.some(q => ss.qty[q.id]>0)
  const tieneGIMix   = spec.productosGI.some(q => ss.qtyGI[q.id]>0)
  const kpiCumple    = kpiSaludChk && tieneVidaMix && tieneGIMix

  for (const p of spec.productosVI) {
    const qty = ss.qty[p.id]; if(!qty) continue
    const cp = campana ? spec.campania.overrides[p.id] : null
    const prima = ss.prima[p.id]
    const usarCamp = !!cp && (p.id !== spec.campania.productoKPI || kpiCumple)
    const zF = usarCamp ? cp.factor : p.factor
    let ppaUF = prima*12
    if (usarCamp && cp.capUF) ppaUF = Math.min(ppaUF, cp.capUF*qty)
    let zT = ppaUF*zF
    if (usarCamp && cp.tope) zT = Math.min(zT, cp.tope*qty)
    zVI += zT; ventas += qty

    let cV=0; const primaCLP = prima*uf
    if (p.comisionUF != null) { cV = p.comisionUF*uf*qty }
    else if (p.comisionVenta != null) {
      cV = primaCLP*p.comisionVenta*qty
      if (p.comisionTopeUF != null) cV = Math.min(cV, p.comisionTopeUF*uf*qty)
    }
    comVenta += cV

    let incTasa=null, incTopeUF=null
    const inc = p.incentivos || {}, incTope = p.incentivoTopeUF || {}
    if (ss.ant>=2) {
      if      (ss.ant<=12 && inc.m2_12  != null) { incTasa=inc.m2_12;  incTopeUF=incTope.m2_12 }
      else if (ss.ant<=24 && inc.m13_24 != null) { incTasa=inc.m13_24; incTopeUF=incTope.m13_24 }
      else if (ss.ant>24  && inc.m25_120!= null) { incTasa=inc.m25_120 }
      if (incTasa != null) {
        let incT = primaCLP*incTasa*qty
        if (incTopeUF != null) incT = Math.min(incT, incTopeUF*uf*qty)
        incMant += incT
      }
    }
  }

  const endosoCol = ventas>=3 ? 0 : ventas===2 ? 1 : 2
  for (const ap of spec.aportes) {
    const monto = ss[ap.montoCampo] || 0; if(monto<=0) continue
    zVI += (monto*ap.ppaPctMonto) * spec.endosoZ[ap.factorPorEndoso][endosoCol]
  }

  for (const p of spec.productosGI) { const qty=ss.qtyGI[p.id]; if(!qty) continue; zGIBruto += (ss.primaGI[p.id]*12)*p.factor }
  const topeGI = campana ? Infinity : zVI*spec.topeGI.pctDeVI
  const zGI = Math.min(zGIBruto, topeGI)
  const zTotal = zVI + zGI

  let bonoApe=0, bonoCv=0
  for (const b of spec.bonos) {
    if (!ss.bonos[b.flagCampo]) continue
    const val = (b.escala[ss[b.rankCampo]-1] || 0) * uf
    if (b.id==='top20ape') bonoApe = val
    else if (b.id==='top20cv') bonoCv = val
  }

  return { zVI, zGI, zGITopado: zGIBruto>topeGI, zTotal, comVenta, incMant, ventas, bonoApe, bonoCv }
}

function computeBonoUF(spec, z, ant, campana, ss) {
  const t5 = topeTramo5(spec, ant, campana)
  const cumpleT5 = Object.values(ss.t5).some(v => v) && (ss.persist/100) >= spec.tramo5.persistenciaMin
  let uf = 0
  for (const tr of spec.tramos) {
    if (tr.min >= 200) {
      if (z<=200 || !cumpleT5) continue
      const exceso = z-200
      const ap = (spec.reglas.topeAntiguedadAplicaA === 'tramo5')
        ? (t5===null ? exceso : Math.min(exceso, t5))
        : exceso
      uf += ap*tr.pct
      continue
    }
    if (z<=tr.min) continue
    const ap = Math.min(z,tr.max)-tr.min; if(ap<=0) continue
    uf += ap*tr.pct
  }
  return { uf, t5Hab: cumpleT5, tope_t5: t5 }
}

function coreFunnel(ss, ventas) {
  const metaContactos = Math.max(1, Math.round(
    SIM_METODOS.filter(m=>m.esNodo).reduce((a,m)=>{ const pct=(ss.pcts[m.id]||0)/100; return a+(pct>0?Math.ceil(ventas*pct):0) },0)/4
  ))
  const metaProspectos = Math.max(1, Math.round(
    SIM_METODOS.reduce((a,m)=>{ const pct=(ss.pcts[m.id]||0)/100; if(pct===0) return a
      const prosp = m.esNodo ? Math.round(ventas*pct*(m.cadena?m.cadena[1].n:5)) : Math.round(ventas*pct*m.cPV)
      return a+prosp }, 0)
  ))
  const activos = SIM_METODOS.map(m=>{ const pct=(ss.pcts[m.id]||0)/100; if(pct===0) return null
    const vM=ventas*pct; return { esNodo:m.esNodo, contactos:m.esNodo?Math.ceil(vM):0, prospectos:m.esNodo?Math.ceil(vM)*5:Math.round(vM*m.cPV) } }).filter(Boolean)
  return {
    metaContactos, metaProspectos,
    funnelTotContactos: activos.filter(m=>m.esNodo).reduce((a,m)=>a+m.contactos,0),
    funnelTotProspectos: activos.reduce((a,m)=>a+m.prospectos,0),
  }
}

function computeAll(spec, ss, uf = 39357) {
  const mode = spec.reglas.campaniaModo
  const evalOnce = (campana) => {
    const ant=ss.ant, pR=ss.persist/100, pM=pmin(spec,ant), fp=factorPersistencia(spec,pR,pM,ant)
    const z = computeZ(spec, ss, campana, uf)
    const bono = computeBonoUF(spec, z.zTotal, ant, campana, ss)
    const bonoNeto = bono.uf * fp * uf
    const total = spec.sueldoBase + bonoNeto + z.comVenta + z.incMant + z.bonoApe + z.bonoCv
    return { z, bono, fp, bonoNeto, total }
  }
  let res
  if (mode === 'mayorValor') { const a=evalOnce(true), b=evalOnce(false); res = a.total>=b.total ? a : b }
  else { res = evalOnce(ss.campana) }

  const funnel = coreFunnel(ss, res.z.ventas)
  const r = n => Math.round(n*1e6)/1e6
  return {
    zVI:r(res.z.zVI), zGI:r(res.z.zGI), zGITopado:res.z.zGITopado, zTotal:r(res.z.zTotal),
    ventas:res.z.ventas, comVenta:Math.round(res.z.comVenta), incMant:Math.round(res.z.incMant),
    bonoUF:r(res.bono.uf), t5Hab:res.bono.t5Hab, tope_t5:res.bono.tope_t5,
    fp:res.fp, bonoNeto:Math.round(res.bonoNeto), bonoApe:Math.round(res.z.bonoApe), bonoCv:Math.round(res.z.bonoCv),
    ingresoTotal:Math.round(res.total),
    metaContactos:funnel.metaContactos, metaProspectos:funnel.metaProspectos,
    funnelTotContactos:funnel.funnelTotContactos, funnelTotProspectos:funnel.funnelTotProspectos,
  }
}

module.exports = { computeAll, coreFunnel }
