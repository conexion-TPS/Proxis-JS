/**
 * calculoConsorcio.ts — Simulador de compensación, tenant CONSORCIO.
 *
 * Calco FIEL y literal del legacy. Fuentes de verdad:
 *   - Motor:  public/compensacion/consorcio/motor.js  (window.MotorConsorcio)
 *   - Embudo: public/compensacion/nucleo/embudo.js     (copia PROPIA y autónoma,
 *             P5 opción (b): NO se importa de calculo.ts de Zurich. Hoy es
 *             numéricamente idéntica al núcleo; la autonomía es estructural
 *             — cada tenant evolucionará su embudo por separado a futuro).
 *
 * Regla de calco: transcripción literal del borrador. NO se corrige nada
 * (factorRet con casos ant===2/3, primerMes sin cablear, base 729000, etc.).
 * UF default Consorcio = 39500 (≠ 39357 de Zurich, a propósito).
 */

// ════════════════════════════════════════════════════════════════════
//  EMBUDO — copia autónoma del núcleo (nucleo/embudo.js)
// ════════════════════════════════════════════════════════════════════

// ── Métodos de prospección (nucleo/embudo.js:21-36, copia fiel) ──
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

// ── calcEmbudo (nucleo/embudo.js:40-71) — embudo de prospección (pura) ──
// OJO: totContactos ≠ metaContactos. La tarjeta "por mes" usa totContactos.
export function calcEmbudo(pcts: Record<string, number>, ventas: number) {
  const metaContactos = Math.max(1, Math.round(
    SIM_METODOS.filter((m) => m.esNodo).reduce((a, m) => {
      const pct = (pcts[m.id] || 0) / 100
      return a + (pct > 0 ? Math.ceil(ventas * pct) : 0)
    }, 0) / 4
  ))
  const metaProspectos = Math.max(1, Math.round(
    SIM_METODOS.reduce((a, m) => {
      const pct = (pcts[m.id] || 0) / 100
      if (pct === 0) return a
      const prosp = m.esNodo
        ? Math.round(ventas * pct * (m.cadena ? Number(m.cadena[1].n) : 5))
        : Math.round(ventas * pct * m.cPV)
      return a + prosp
    }, 0)
  ))
  const activos = SIM_METODOS.map((m) => {
    const pct = (pcts[m.id] || 0) / 100
    if (pct === 0) return null
    const vM = ventas * pct
    return {
      id: m.id, esNodo: m.esNodo,
      contactos: m.esNodo ? Math.ceil(vM) : 0,
      prospectos: m.esNodo ? Math.ceil(vM) * 5 : Math.round(vM * m.cPV),
    }
  }).filter(Boolean) as { id: string; esNodo: boolean; contactos: number; prospectos: number }[]
  const totContactos = activos.filter((m) => m.esNodo).reduce((a, m) => a + m.contactos, 0)
  const totProspectos = activos.reduce((a, m) => a + m.prospectos, 0)
  return { metaContactos, metaProspectos, totContactos, totProspectos, activos }
}

// ── Comportamiento del stepper de % por método (consorcio/sim.js:150-158 csChPct,
//    idéntico a embudo.js simChPct): tope global 100, redondeo a múltiplos de 5 ──
export function nextPct(pcts: Record<string, number>, id: string, delta: number): number {
  const tot = Object.values(pcts).reduce((a, b) => a + b, 0)
  let nuevo = Math.max(0, Math.min(100, (pcts[id] || 0) + delta))
  if (delta > 0 && tot + delta > 100) nuevo = (pcts[id] || 0) + (100 - tot)
  return Math.round(nuevo / 5) * 5
}
export const sumaPct = (pcts: Record<string, number>) => Object.values(pcts).reduce((a, b) => a + b, 0)

// ════════════════════════════════════════════════════════════════════
//  MOTOR CONSORCIO — transcripción literal de consorcio/motor.js
// ════════════════════════════════════════════════════════════════════

type Tramo = [number, number, number]

function lookup(tabla: Tramo[], x: number): number {
  for (const [d, h, v] of tabla) if (x >= d && x <= h) return v
  return 0
}

// ── Tablas (motor.js:13-30) ──
const Tabla_ProdVida: Tramo[] = [[0, 299, 5], [300, 649, 40], [650, 949, 455], [950, 1199, 550], [1200, 1499, 610], [1500, Infinity, 650]]
const Tabla_BonoExc: Tramo[] = [[0, 649, 0], [650, 949, 100000], [950, 1199, 180000], [1200, 1499, 350000], [1500, Infinity, 480000]]
const Tabla_Amplif: Tramo[] = [[0, 649, 1.0], [650, 949, 1.2], [950, 1199, 1.4], [1200, 1499, 1.6], [1500, Infinity, 1.8]]
const Tabla_ValorRecaud: Tramo[] = [[0, 299, 12000], [300, 649, 13500], [650, 949, 15000], [950, 1199, 16500], [1200, 1499, 18000], [1500, Infinity, 19500]]
const ComInv_rates: Record<string, { tasa: number; topeUF: number | null }> = {
  PVX_I06: { tasa: 0.0036, topeUF: null }, PVX_I01: { tasa: 0.0036, topeUF: 17 }, PVX_I02: { tasa: 0.0031, topeUF: 17 },
  PVX_I03: { tasa: 0.0036, topeUF: 17 }, PVX_I05: { tasa: 0.0036, topeUF: 130 }, PVX_I04: { tasa: 0.0036, topeUF: 17 },
}
const Multi_rates: Record<string, { fijoCLP?: number; tasaUF?: number }> = {
  PVX_B_CP: { fijoCLP: 28500 }, PVX_B_CM: { fijoCLP: 10500 }, PVX_B_CO: { tasaUF: 0.016 }, PVX_B_HI: { tasaUF: 0.00089 },
  PVX_G_AU_anual: { tasaUF: 0.0436 }, PVX_G_AU_bienal: { tasaUF: 0.0327 }, PVX_G_HO: { tasaUF: 0.0942 },
}
const Pond_AUM: Record<string, number> = { PVX_VP: 0.000075, PVX_FM_MM: 0.000070, PVX_FM_RF: 0.000093, PVX_FM_RV: 0.000163 }
const PrimerMes: Record<string, Tramo[]> = {
  Tier_1: [[0, 59, 800000], [60, 89, 830000], [90, Infinity, 1300000]],
  Tier_2: [[90, 109, 1300000], [110, 139, 1600000], [140, 169, 1900000], [170, Infinity, 2200000]],
  Tier_3: [[140, 169, 1900000], [170, 199, 2200000], [200, 229, 2900000], [230, 259, 3200000], [260, 299, 3500000], [300, Infinity, 3800000]],
}

// ── Matriz de persistencia (Factor_Ret 1–10): % cartera vigente × antigüedad (motor.js:33-55) ──
const RAW: Record<string, string> = {
  62: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1', 63: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4',
  64: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4', 65: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4',
  66: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5', 67: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5',
  68: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5 5 6', 69: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5 5 5 6 6',
  70: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5 5 5 6 6 6 6', 71: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5 5 5 6 6 6 6 6 6',
  72: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6', 73: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6 7 7',
  74: '1 1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6 7 7 7 7', 75: '1 1 1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6 7 7 7 7 8 8',
  76: '1 1 1 1 1 1 1 1 1 1 4 4 4 4 4 4 5 5 5 5 5 6 6 6 6 6 6 6 6 7 7 7 8 8 8 8', 77: '1 1 1 1 1 1 1 1 1 4 4 4 4 5 5 5 5 5 5 6 6 6 6 6 6 6 6 7 7 7 8 8 8 8 8 8',
  78: '1 1 1 1 1 1 1 1 4 4 4 4 5 5 5 5 6 6 6 6 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8', 79: '1 1 1 1 1 1 1 4 4 4 5 5 5 6 6 6 6 6 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8 8 9',
  80: '1 1 1 1 4 4 4 4 4 5 5 5 6 6 6 6 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8 8 8 9 9', 81: '1 1 1 4 4 4 4 4 5 5 6 6 6 6 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9',
  82: '1 1 1 4 4 4 4 5 5 6 6 6 6 6 6 6 7 7 7 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9 9 10', 83: '1 1 1 4 4 4 4 5 5 6 6 6 6 6 6 6 7 7 7 7 7 8 8 8 8 8 8 8 8 9 9 9 9 9 10 10',
  84: '1 1 4 4 5 5 5 5 6 6 6 6 6 7 7 7 7 7 7 8 8 8 8 8 8 8 8 9 9 9 9 9 10 10 10 10', 85: '1 1 4 5 5 5 5 6 6 6 6 6 7 7 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9 9 10 10 10 10 10 10',
  86: '1 1 4 5 6 6 6 6 6 6 7 7 7 8 8 8 8 8 8 8 8 8 8 9 9 9 9 9 9 10 10 10 10 10 10 10', 87: '4 4 5 6 6 6 6 6 6 7 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10',
  88: '4 4 5 6 6 6 6 6 7 7 8 8 8 8 8 8 8 8 8 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10', 89: '4 4 6 6 6 6 6 7 7 8 8 8 8 8 8 8 9 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10',
  90: '5 5 6 6 7 7 7 7 8 8 8 8 8 9 9 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10', 91: '5 5 6 7 7 7 7 8 8 8 8 8 9 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
  92: '6 6 6 7 8 8 8 8 8 8 9 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10', 93: '6 6 7 8 8 8 8 8 8 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
  94: '6 6 7 8 8 8 8 8 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10', 95: '6 6 7 8 8 8 8 8 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
  96: '6 6 8 8 8 8 8 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10', 97: '7 7 8 8 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
  98: '7 7 8 9 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10', 99: '8 8 8 9 9 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
  100: '8 8 9 9 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10',
}
const MATRIZ: Record<string, number[]> = {}
for (const p in RAW) MATRIZ[p] = RAW[p].trim().split(/\s+/).map(Number)

export function factorRet(carteraVigente: number, antiguedadMeses: number): number {
  if (antiguedadMeses === 2) return 8
  if (antiguedadMeses === 3) return 9
  let pct = carteraVigente <= 1 ? carteraVigente * 100 : carteraVigente
  pct = Math.round(pct); if (pct < 62) return 1; if (pct > 100) pct = 100
  return MATRIZ[pct][Math.min(Math.max(Math.round(antiguedadMeses), 1), 36) - 1]
}

// ── Componentes (motor.js:64-72) ──
export type InvVenta = { prod: string; montoUF: number }
export type MultiVenta = { prod: string; n?: number; montoUF?: number }
export type RecaudPoliza = { pctRecaud?: number; primaRefPonderada?: number }

export type CompVida = { clp: number; uf: number; cnsAjustados: number }
export type CompBonoExc = { clp: number; uf: number; ajustTrim?: number }
export type CompComInv = { clp: number; uf: number }
export type CompBonoMulti = { clp: number; uf: number; amplificador: number }
export type CompBonoSalud = { clp: number; uf: number; inicial: number; secundario: number }
export type CompBonoRecaud = { clp: number; uf: number; ponderadas: number }
export type CompBonoAUM = { clp: number; uf: number }

export function comVida(cnsVida: number, f: number): CompVida { const a = cnsVida * f; return { clp: a * lookup(Tabla_ProdVida, a), uf: 0, cnsAjustados: a } }
export function bonoExc(prom: number, f: number): CompBonoExc { if (f < 7) return { clp: 0, uf: 0 }; const a = prom * f; return { clp: lookup(Tabla_BonoExc, a), uf: 0, ajustTrim: a } }
export function comInv(ventas?: InvVenta[]): CompComInv { let uf = 0; for (const v of (ventas || [])) { const r = ComInv_rates[v.prod]; if (!r) continue; let c = v.montoUF * r.tasa; if (r.topeUF != null) c = Math.min(c, r.topeUF); uf += c } return { clp: 0, uf } }
export function bonoMulti(ventas: MultiVenta[] | undefined, cnsAjust: number): CompBonoMulti { let clp = 0, uf = 0; for (const v of (ventas || [])) { const r = Multi_rates[v.prod]; if (!r) continue; if (r.fijoCLP != null) clp += r.fijoCLP * (v.n || 0); else if (r.tasaUF != null) uf += (v.montoUF || 0) * r.tasaUF } const amp = lookup(Tabla_Amplif, cnsAjust); return { clp: clp * amp, uf: uf * amp, amplificador: amp } }
export function bonoSalud(ufaMensual: number, vig: number): CompBonoSalud { const ini = 0.25 * ufaMensual; const sec = (vig >= 0.80) ? 0.95 * ufaMensual * vig : 0; return { clp: 0, uf: ini + sec, inicial: ini, secundario: sec } }
export function bonoRecaud(polizas: RecaudPoliza[] | undefined, cnsAjustTrim: number): CompBonoRecaud { let p = 0; for (const x of (polizas || [])) { if ((x.pctRecaud || 0) < 0.85) continue; p += x.primaRefPonderada || 0 } return { clp: p * lookup(Tabla_ValorRecaud, cnsAjustTrim), uf: 0, ponderadas: p } }
export function bonoAUM(s?: Record<string, number>): CompBonoAUM { let uf = 0; for (const k in Pond_AUM) uf += (s && s[k] || 0) * Pond_AUM[k]; return { clp: 0, uf } }
// NOTA DE CALCO: primerMes está en el export del legacy pero NO se cablea en
// computeConsorcio. Se transcribe igual de desconectada (borrador, no se corrige).
export function primerMes(cns: number, tier: string): number { return lookup(PrimerMes[tier] || [], cns) }

// ── Total (estado estable) (motor.js:74-89) ──
export type ConsorcioScn = {
  factorRet?: number
  carteraVigente?: number
  antiguedad?: number
  cnsVida?: number
  promTrimCns?: number
  inversiones?: InvVenta[]
  multiproducto?: MultiVenta[]
  saludUfaMensual?: number
  saludVigencia?: number
  recaudPolizas?: RecaudPoliza[]
  cnsAjustadosTrim?: number
  aumSaldos?: Record<string, number>
  baseGratif?: number
}
export type ConsorcioComps = {
  comVida: CompVida; bonoExc: CompBonoExc; comInv: CompComInv; bonoMulti: CompBonoMulti
  bonoSalud: CompBonoSalud; bonoRecaud: CompBonoRecaud; bonoAUM: CompBonoAUM
}
export type ConsorcioResult = { factorRet: number; comps: ConsorcioComps; ingresoTotal: number }

export function computeConsorcio(scn: ConsorcioScn, uf?: number): ConsorcioResult {
  if (uf == null) uf = 39500
  const f = (scn.factorRet != null) ? scn.factorRet : factorRet(scn.carteraVigente || 0, scn.antiguedad || 1)
  const cv = comVida(scn.cnsVida || 0, f)
  const be = bonoExc(scn.promTrimCns || 0, f)
  const ci = comInv(scn.inversiones)
  const bm = bonoMulti(scn.multiproducto, cv.cnsAjustados)
  const bs = bonoSalud(scn.saludUfaMensual || 0, scn.saludVigencia || 0)
  const br = bonoRecaud(scn.recaudPolizas, scn.cnsAjustadosTrim || 0)
  const ba = bonoAUM(scn.aumSaldos)
  const comps: ConsorcioComps = { comVida: cv, bonoExc: be, comInv: ci, bonoMulti: bm, bonoSalud: bs, bonoRecaud: br, bonoAUM: ba }
  let total = (scn.baseGratif != null ? scn.baseGratif : 729000)
  for (const c of Object.values(comps)) total += c.clp + c.uf * uf
  return { factorRet: f, comps, ingresoTotal: Math.round(total) }
}
