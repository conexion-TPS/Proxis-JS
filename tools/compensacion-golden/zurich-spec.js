/* ═══════════════════════════════════════════════════════════════════════
   SPEC DECLARATIVA — Zurich (compania-z) como DATOS.
   Sigue el esquema de MODULO_COMPENSACION_PLAN.md (Parte A).
   Es lo que el motor genérico interpreta y lo que el dashboard/IA producirán.

   Valores tomados EXACTOS de public/compensacion/compania-z/datos.js.
   Las reglas que la auditoría marcó (campaña, tope) se fijan AQUÍ, explícitas,
   en el estado ACTUAL de Zurich (reemplaza / tramo5) para preservar conducta.
═══════════════════════════════════════════════════════════════════════ */
'use strict'

module.exports = {
  id: 'compania-z', empresa: 'zurich', version: 1,
  moneda: 'CLP', unidad: 'UF', sueldoBase: 539000,

  productosVI: [
    { id:'BL',  factor:2.00, comisionVenta:0.32,  incentivos:{ m2_12:0.32,  m13_24:0.06,  m25_120:0.036 } },
    { id:'PM',  factor:2.00, comisionVenta:0.32,  incentivos:{ m2_12:0.32,  m13_24:0.06,  m25_120:0.036 } },
    { id:'TP',  factor:1.00, comisionVenta:0.16,  comisionTopeUF:10,
      incentivos:{ m2_12:0.024, m13_24:0.024, m25_120:0.024 } },
    { id:'FP',  factor:1.00, comisionVenta:0.056, comisionTopeUF:0.22,
      incentivos:{ m2_12:0.056, m13_24:0.024 }, incentivoTopeUF:{ m2_12:0.22, m13_24:0.10 } },
    { id:'AP',  factor:1.00, comisionVenta:0.08,  incentivos:{ m2_12:0.08, m13_24:0.08, m25_120:0.08 } },
    { id:'APV', factor:0.50, comisionUF:0.08 },
    { id:'SS',  factor:0.50, comisionVenta:0.08,  incentivos:{ m2_12:0.08, m13_24:0.08, m25_120:0.08 } },
    { id:'BLF', factor:0.50, comisionVenta:0.32,  incentivos:{ m2_12:0.32, m13_24:0.06, m25_120:0.036 } },
  ],

  productosGI: [
    { id:'AUTO',  factor:0.50 },
    { id:'HOGAR', factor:1.00 },
  ],

  aportes: [
    { id:'APVEX',   montoCampo:'apvEx',     ppaPctMonto:0.10, factorPorEndoso:'APV'  },
    { id:'APVFLEX', montoCampo:'apvFlexEx', ppaPctMonto:0.10, factorPorEndoso:'APVF' },
    { id:'RP',      montoCampo:'rpMonto',   ppaPctMonto:0.10, factorPorEndoso:'RP'   },
  ],

  endosoZ: {
    BL:[0.80,0.60,0.50], PM:[0.80,0.60,0.50], FP:[0.80,0.60,0.50], TP:[0.70,0.60,0.50],
    AP:[0.70,0.60,0.50], APV:[0.50,0.50,0.25], SS:[0.50,0.50,0.25], BLF:[0.50,0.50,0.25],
    RP:[0.50,0.50,0.25], APVF:[0.25,0.25,0.125],
  },

  tramos: [
    { min:0,      max:49.99, pct:0.10 },
    { min:50,     max:99.99, pct:0.12 },
    { min:100,    max:149.99,pct:0.15 },
    { min:150,    max:200,   pct:0.18 },
    { min:200.01, max:9999,  pct:0.10 },
  ],
  topesPorAntiguedad: [[6,300],[23,700],[47,800],[71,900],[95,1000],[119,1100],[999,1200]],

  persistencia: {
    minimaPorAntiguedad:   [[12,0.90],[24,0.82],[999,0.78]],
    factorPorCumplimiento: [[0.50,0],[0.85,0.5],[0.90,0.65],[0.95,0.9],[1.00,1.0],[1.20,1.2]],
    bono120SoloDesdeMes: 13,
  },
  tramo5: { persistenciaMin: 0.85 },

  campania: {
    productoKPI: 'APV', kpiSaludProductoId: 'SS',  // APV paga 100% solo si hay Vida + GI + Salud
    overrides: {
      BL:{factor:2.00,tope:300}, PM:{factor:2.00,tope:300},
      TP:{factor:1.00,tope:null}, AP:{factor:1.00,tope:null},
      APV:{factor:1.00,tope:600,capUF:500}, BLF:{factor:0.50,tope:300},
      SS:{factor:1.00,tope:null}, RP:{factor:0.50,tope:300}, APVF:{factor:0.50,tope:600,capUF:500},
    },
    topesPorAntiguedad: [[6,1000],[12,1500],[24,2000],[999,99999]],
  },
  topeGI: { pctDeVI: 0.25 },

  bonos: [
    { id:'top20ape', flagCampo:'top20ape', rankCampo:'rankApe', escala:[23,18,13,11,9,7,6,6,4,4,3,3,3,2,2,2,1,1,1,1] },
    { id:'top20cv',  flagCampo:'top20cv',  rankCampo:'rankCv',  escala:[11,8,8,8,5,5,5,2,2,2,1,1,1,1,1,1,1,1,1,1] },
  ],

  // Reglas explícitas (ver AUDITORIA_COMPENSACION.md). Fijadas al estado ACTUAL de Zurich.
  reglas: {
    campaniaModo: 'reemplaza',          // toggle excluyente (hoy)
    topeAntiguedadAplicaA: 'tramo5',    // tope sobre el exceso del tramo 5 (hoy)
  },
}
