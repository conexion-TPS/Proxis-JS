/*
 * Simulador de Metas — módulo de CÁLCULO (tenant Zurich).
 * Constantes y fórmulas copiadas LITERAL del legacy (compania-z/datos.js + nucleo/embudo.js).
 * Aislado del render: el componente solo consume estos valores/funciones. Cálculo puro, sin BD.
 * NO mejorar ni reinterpretar — calco fiel de lo existente (ajustes = post-Fase 3).
 * El cálculo pesado de renta/embudo (calcZ/calcEmbudo) se agrega en la Sección 3.
 */

export const UF_DEFAULT = 39357
export const SUELDO_BASE_DEFAULT = 539000

// ── Roster Zurich (calco de ASESORES del legacy, objeto USUARIOS) ──
// En Fase 3 vendrá del equipo del supervisor por persona_id; hoy se calca el listado existente.
export const ZURICH_ASESORES = [
  'Diego Pérez', 'Nazaret Johannesen', 'Verónica Castillo', 'Fernanda Grothusen',
  'Sindy Martínez', 'Francis Arancibia', 'Marcela Jara', 'María Francisca Lorenz',
  'Oriana Jorquera', 'Mauricio Gana',
]
// Supervisora del tenant Zurich — calco hardcodeado del legacy (USUARIOS), SIN "Morral".
// El header del simulador Zurich la muestra fija (como el legacy muestra G.usuario).
// Deuda: el bloqueo de tenant (split de routing) no está implementado — ver DISENO_CONSOLIDACION.md.
export const ZURICH_SUPERVISORA = 'Alejandra Espinoza'

// ── PRODUCTOS VIDA VI (factor AE, comisiones según contrato) ── (datos.js)
export type ProdVida = {
  id: string; n: string; z: number; c?: number; cUF?: number; q: number; p: number; pMax: number
  cTopeUF?: number; incM12?: number; incM12TopeUF?: number; incM24?: number; incM24TopeUF?: number; incM120?: number
}
export const SIM_PRODS: ProdVida[] = [
  { id: 'BL', n: 'Business Life', z: 2.00, c: .32, q: 1, p: 200000, pMax: 2000000, incM12: .32, incM24: .06, incM120: .036 },
  { id: 'TP', n: 'Temporal', z: 1.00, c: .16, q: 0, p: 80000, pMax: 1500000, cTopeUF: 10, incM12: .024, incM24: .024, incM120: .024 },
  { id: 'FP', n: 'Futuro Presente', z: 1.00, c: .056, q: 0, p: 100000, pMax: 1500000, cTopeUF: 0.22, incM12: .056, incM12TopeUF: .22, incM24: .024, incM24TopeUF: .10 },
  { id: 'AP', n: 'Accidentes Personales', z: 1.00, c: .08, q: 0, p: 30000, pMax: 500000, incM12: .08, incM24: .08, incM120: .08 },
  { id: 'APV', n: 'APV', z: 0.50, cUF: .08, q: 1, p: 120000, pMax: 2000000 },
  { id: 'SS', n: 'Salud', z: 0.50, c: .08, q: 0, p: 50000, pMax: 1000000, incM12: .08, incM24: .08, incM120: .08 },
  { id: 'BLF', n: 'Business Life Flexible', z: 0.50, c: .32, q: 0, p: 80000, pMax: 2000000, incM12: .32, incM24: .06, incM120: .036 },
]

// ── PRODUCTOS GENERALES GI (Auto 50%, Hogar 100%) ── (datos.js)
export type ProdGI = { id: string; n: string; z: number; q: number; p: number; pMax: number }
export const SIM_PRODS_GI: ProdGI[] = [
  { id: 'AUTO', n: 'Auto', z: 0.50, q: 0, p: 25000, pMax: 200000 },
  { id: 'HOGAR', n: 'Hogar', z: 1.00, q: 0, p: 15000, pMax: 100000 },
]

// ── Premios Top 20 APE y Crecimiento (UF/mes) ── (datos.js)
export const TOP20_APE_UF = [23, 18, 13, 11, 9, 7, 6, 6, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1]
export const TOP20_CV_UF = [11, 8, 8, 8, 5, 5, 5, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

// ── Tramos AE → %, topes, endosos, campaña ── (datos.js)
export const SIM_TRAMOS = [
  { min: 0, max: 49.99, pct: .10, lbl: '0 – 49,99' },
  { min: 50, max: 99.99, pct: .12, lbl: '50 – 99,99' },
  { min: 100, max: 149.99, pct: .15, lbl: '100 – 149,99' },
  { min: 150, max: 200, pct: .18, lbl: '150 – 200' },
  { min: 200.01, max: 9999, pct: .10, lbl: '200+ (tramo 5)' },
]
export const TOPES_ORIG: [number, number][] = [[6, 300], [23, 700], [47, 800], [71, 900], [95, 1000], [119, 1100], [999, 1200]]
export const TOPES_CAMP: [number, number][] = [[6, 1000], [12, 1500], [24, 2000], [999, 99999]]
export const ENDOSO_Z: Record<string, [number, number, number]> = {
  BL: [0.80, 0.60, 0.50], PM: [0.80, 0.60, 0.50], FP: [0.80, 0.60, 0.50], TP: [0.70, 0.60, 0.50],
  AP: [0.70, 0.60, 0.50], APV: [0.50, 0.50, 0.25], SS: [0.50, 0.50, 0.25], BLF: [0.50, 0.50, 0.25],
  RP: [0.50, 0.50, 0.25], APVF: [0.25, 0.25, 0.125],
}
export const CAMP_PRODS: Record<string, { z: number; tope: number | null; capUF?: number }> = {
  BL: { z: 2.00, tope: 300 }, PM: { z: 2.00, tope: 300 }, TP: { z: 1.00, tope: null }, AP: { z: 1.00, tope: null },
  APV: { z: 1.00, tope: 600, capUF: 500 }, BLF: { z: 0.50, tope: 300 }, SS: { z: 1.00, tope: null },
  RP: { z: 0.50, tope: 300 }, APVF: { z: 0.50, tope: 600, capUF: 500 },
}

// ── Factores (datos.js) ──
export const fmtUF = (n: number) => n.toFixed(2) + ' UF'
export const fmtCLP = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
// TOPE_T5: tope del tramo 5 según antigüedad (NO es cap de AE total)
export const TOPE_T5 = (a: number, c: boolean): number | null => { const t = c ? TOPES_CAMP : TOPES_ORIG; for (const [m, v] of t) if (a <= m) return v; return c ? null : 1200 }
export const PMIN = (a: number) => (a <= 12 ? .90 : a <= 24 ? .82 : .78)
// Factor persistencia: 1.20 SOLO para ant > 12 meses
export const FP = (r: number, m: number, ant: number) => { const c = r / m; if (c <= .5) return 0; if (c <= .85) return .5; if (c <= .9) return .65; if (c <= .95) return .9; if (c <= 1) return 1; return ant > 12 ? 1.2 : 1.0 }

// ── Métodos de prospección (nucleo/embudo.js, fuente única) ──
export type CadenaPaso = { n: number | string; l: string; hi?: boolean | 'blue' | 'amber' }
export type Metodo = {
  id: string; nombre: string; desc: string; tasa: string; cPV: number
  reunRate?: number; cierreRate?: number; nPorNodo?: number
  color: string; bg: string; esNodo: boolean; esPostCierre?: boolean; cadena: CadenaPaso[]
}
export const SIM_METODOS: Metodo[] = [
  { id: 'ref1', nombre: 'Contacto/Nodo — nombre dado', desc: 'El contacto/nodo da un nombre y teléfono. El asesor llega con referencia pero sin presentación activa.', tasa: '25-30%', cPV: 5, reunRate: 0.40, cierreRate: 0.40, nPorNodo: 5, color: '#1D9E75', bg: '#E1F5EE', esNodo: true, cadena: [{ n: 1, l: 'contacto/\nnodo' }, { n: 5, l: 'nombres\ndados' }, { n: 2, l: 'con\nreunión' }, { n: 1, l: 'cierre\nest.', hi: true }] },
  { id: 'ref2', nombre: 'Contacto/Nodo — presentado con patrocinio', desc: 'El nodo hace una introducción activa. El prospecto espera el contacto del asesor. Mayor credibilidad.', tasa: '40-50%', cPV: 2.5, reunRate: 0.60, cierreRate: 0.67, nPorNodo: 5, color: '#0F6E56', bg: '#E1F5EE', esNodo: true, cadena: [{ n: 1, l: 'contacto/\nnodo' }, { n: 5, l: 'referidos\navisados' }, { n: 3, l: 'con\nreunión' }, { n: 2, l: 'cierres\nest.', hi: true }] },
  { id: 'ref3', nombre: 'Contacto/Nodo — transferencia en vivo', desc: 'El nodo presenta en persona, llamada o videollamada en ese momento. Máxima credibilidad.', tasa: '55-70%', cPV: 1.5, reunRate: 0.50, cierreRate: 1.0, nPorNodo: 2, color: '#5DCAA5', bg: '#E1F5EE', esNodo: true, cadena: [{ n: 1, l: 'contacto/\nnodo' }, { n: 2, l: 'presentes\nen vivo' }, { n: 1, l: 'con\nreunión' }, { n: 1, l: 'cierre\nest.', hi: true }] },
  { id: 'ref4', nombre: 'Referidos tras cierre o entrega de póliza', desc: 'Pre-calificados por clientes actuales tras el cierre, transferidos en vivo.', tasa: '20-25%', cPV: 5, reunRate: 0.50, cierreRate: 0.22, nPorNodo: 5, color: '#a8cc1a', bg: '#f5ffcc', esNodo: true, esPostCierre: true, cadena: [{ n: 1, l: 'cliente\ntras cierre' }, { n: 5, l: 'prospectos\nentregados' }, { n: 2, l: 'con\nreunión' }, { n: 1, l: 'cierre\nest.', hi: true }] },
  { id: 'dig', nombre: 'Leads digitales de alta intención', desc: 'Leads online (formularios, calculadoras, ads). Ya mostraron interés previo.', tasa: '10-15%', cPV: 7, color: '#378ADD', bg: '#E6F1FB', esNodo: false, cadena: [{ n: '—', l: 'sin\nnodo' }, { n: 7, l: 'leads\nrecibidos' }, { n: 4, l: 'con\nreunión' }, { n: 1, l: 'cierre\nest.', hi: 'blue' }] },
  { id: 'frio', nombre: 'Prospección en frío', desc: 'Contacto masivo sin pre-calificación. Alto volumen, baja conversión.', tasa: '2-4%', cPV: 40, color: '#BA7517', bg: '#FAEEDA', esNodo: false, cadena: [{ n: '—', l: 'sin\nnodo' }, { n: 40, l: 'contactos\nfríos' }, { n: 10, l: 'con\nreunión' }, { n: 1, l: 'cierre\nest.', hi: 'amber' }] },
]

// ── Estado del simulador (calco de simState) ──
export type SimState = {
  meta: number; ant: number; persist: number; campana: boolean
  pcts: Record<string, number>
  qty: Record<string, number>; prima: Record<string, number>
  qtyGI: Record<string, number>; primaGI: Record<string, number>
  rpMonto: number; apvEx: number; apvFlexEx: number
  t5: Record<string, boolean>
  // KPI Campaña APV 100%: el legacy los lee del DOM al calcular; en React se guardan en estado.
  kpi: { vida: boolean; gi: boolean; salud: boolean }
  bonos: { top20ape: boolean; top20cv: boolean; grati: boolean }
  rankApe: number; rankCv: number; asesor: string
}
export function initialStateZurich(asesores: string[]): SimState {
  const qty: Record<string, number> = {}, prima: Record<string, number> = {}
  SIM_PRODS.forEach((p) => { qty[p.id] = p.q; prima[p.id] = parseFloat((p.p / UF_DEFAULT).toFixed(2)) })
  const qtyGI: Record<string, number> = {}, primaGI: Record<string, number> = {}
  SIM_PRODS_GI.forEach((p) => { qtyGI[p.id] = p.q; primaGI[p.id] = parseFloat((p.p / UF_DEFAULT).toFixed(2)) })
  return {
    meta: 2000000, ant: 3, persist: 92, campana: true,
    pcts: { ref1: 40, ref2: 40, ref3: 0, ref4: 0, dig: 10, frio: 10 },
    qty, prima, qtyGI, primaGI,
    rpMonto: 0, apvEx: 0, apvFlexEx: 0,
    t5: { r1: false, r2: false, r3: false, r4: false, r5: false },
    kpi: { vida: false, gi: false, salud: false },
    bonos: { top20ape: false, top20cv: false, grati: true },
    rankApe: 10, rankCv: 10, asesor: asesores[0],
  }
}

// ── Fórmulas de etiqueta del panel izquierdo (calco exacto del legacy) ──
export const labelAnt = (v: number) => v + ' mes' + (v === 1 ? '' : 'es')
export const labelPersist = (v: number) => v + '%'
export const labelPPA = (prima: number) => `PPA: ${(prima * 12).toFixed(1)} UF`
// APV ex: PPA = 10%; AE = 50% del PPA redondeado (perfil.js:119)
export const labelApvEx = (uf: number) => { const ppa = (uf * 0.10).toFixed(2); const ae = (parseFloat(ppa) * 0.5).toFixed(2); return `PPA: ${ppa} UF · ${ae} AE` }
// APV Flexible: PPA = 10%; AE = 25% del PPA (perfil.js:120)
export const labelApvFlex = (uf: number) => { const ppa = uf * 0.10; return `PPA: ${ppa.toFixed(2)} UF · ${(ppa * 0.25).toFixed(2)} AE` }
// Renta Preferente: AE = 5% del monto (perfil.js:118)
export const labelRp = (uf: number) => `${(uf * 0.05).toFixed(2)} AE`

// ── Comportamiento de steppers (calco exacto, aislado del render) ──
export const clampQty = (v: number) => Math.max(0, Math.min(20, v))
// % por método: tope global 100, redondeo a múltiplos de 5 (embudo.js simChPct)
export function nextPct(pcts: Record<string, number>, id: string, delta: number): number {
  const tot = Object.values(pcts).reduce((a, b) => a + b, 0)
  let nuevo = Math.max(0, Math.min(100, pcts[id] + delta))
  if (delta > 0 && tot + delta > 100) nuevo = pcts[id] + (100 - tot)
  return Math.round(nuevo / 5) * 5
}
export const sumaPct = (pcts: Record<string, number>) => Object.values(pcts).reduce((a, b) => a + b, 0)
