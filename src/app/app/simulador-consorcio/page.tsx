'use client'
import { useEffect, useState } from 'react'
import { SIM_METODOS, nextPct, computeConsorcio, calcEmbudo, type ConsorcioScn, type Metodo } from '@/lib/simulador/calculoConsorcio' // motor/embudo autónomo (NO Zurich)
import { useAuth } from '../AuthProvider'
import { useRouter } from 'next/navigation'
import { FUNNEL_CSS } from '../funnelCss'

/*
 * Simulador de Metas — tenant CONSORCIO. Calco fiel del legacy
 * public/compensacion/consorcio/sim.js (rellena slots de #sim-right) sobre el
 * scaffold compartido de la plataforma. App-shell réplica de Zurich.
 * B1: scaffold/layout. Paneles dinámicos = shells vacíos (alert-box, metric-row,
 * metric-contacts, embudo, consolidado-tbody, disclaimer) → se llenan en B2-B7.
 * Estáticos con contenido real: botón PDF, nota referencial azul, lit-box, copyright.
 * OCULTOS (Consorcio no los muestra, sim.js:189): card-mix y card-tramos
 * (= "Transformación AE Puntos → Bono UF").
 */

// Bloque <style> propio y autónomo (copia del de Zurich; las clases del simulador
// no están en globals.css). No se importa nada de Zurich.
const CSS = `
/* Simulador layout */
.two-col{display:grid;grid-template-columns:380px 1fr;min-height:calc(100vh - 120px)}
.left{background:#fafaf7;border-right:1px solid var(--g200);padding:24px 22px;overflow-y:auto;max-height:calc(100vh - 120px);position:sticky;top:120px}
.right{padding:26px 30px;max-width:1240px}

/* Buttons */
.btn{padding:10px 18px;border:none;border-radius:var(--r);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;display:inline-flex;align-items:center;gap:7px;letter-spacing:-0.005em}
.btn-primary{background:#0b0a09;color:white;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
.btn-primary:hover{background:#2a2926;transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,0.14)}
.btn-success{background:var(--teal);color:white;border:1px solid var(--teal)}
.btn-success:hover{background:#175743}

/* Cards */
.card{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:20px 22px;margin-bottom:14px;box-shadow:var(--shadow-1)}
.card-title{font-size:13px;font-weight:600;color:var(--g900);margin-bottom:16px;display:flex;align-items:center;gap:10px;letter-spacing:-0.005em}
.card-title::before{content:'';display:block;width:3px;height:14px;background:var(--lime-dk);border-radius:2px;flex-shrink:0}
.mcrow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
.smc{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:14px 16px;box-shadow:var(--shadow-1);text-align:center}
.smc.ok{background:linear-gradient(180deg,#edf4fb 0%,#d9ecf8 100%);border:1.5px solid #185FA5}
.smc.ok .smc-lbl{color:#185FA5}.smc.ok .smc-val{color:#0C447C;font-size:27px}.smc.ok .smc-sub{color:#185FA5;opacity:.85}
.smc.ng{border-color:var(--red);border-width:1.5px}
.smc-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--g400);margin-bottom:6px}
.smc-val{font-size:20px;font-weight:600;color:var(--g900);font-family:var(--font);letter-spacing:-.022em;font-feature-settings:"tnum";line-height:1.15}
.smc-sub{font-size:11px;color:var(--g600);margin-top:3px}
.smc.ng .smc-val{color:var(--red)}
.card-collapsible .card-title{cursor:pointer;display:flex;align-items:center;user-select:none;margin-bottom:0;padding:2px 0;transition:color .15s}
.card-collapsible .card-title:hover{color:#0b0a09}
.card-collapsible.open .card-title{margin-bottom:16px}
.card-collapsible .card-body{display:none}
.card-collapsible.open .card-body{display:block;animation:cardOpen .22s ease}
@keyframes cardOpen{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.coll-arrow{font-size:12px;color:var(--g400);transition:transform .22s;margin-left:auto;font-weight:400}
.card-collapsible.open .coll-arrow{transform:rotate(180deg)}

/* Literatura */
.lit-box{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:18px 22px;margin-bottom:14px;box-shadow:var(--shadow-1)}
.lit-title{font-size:13px;font-weight:600;color:var(--g900);margin-bottom:12px;display:flex;align-items:center;gap:10px;letter-spacing:-0.005em}
.lit-title::before{content:'';display:block;width:3px;height:14px;background:var(--amber);border-radius:2px;flex-shrink:0}
.lit-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
.lit-table th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--g400);padding:7px 10px;border-bottom:1px solid var(--g200)}
.lit-table td{padding:8px 10px;border-bottom:1px solid var(--g100);color:var(--g700)}
.lit-table tr:last-child td{border-bottom:none}
.lit-table td:first-child{color:var(--g900);font-weight:500}
.lit-table td:last-child{font-family:var(--mono);font-weight:500;color:var(--teal);font-feature-settings:"tnum"}
.lit-note{font-size:11.5px;color:var(--g700);background:var(--g50);border-radius:10px;padding:12px 14px;line-height:1.65;border:1px solid var(--g200)}
.lit-note strong{font-weight:600;color:var(--g900)}

.copyright{text-align:center;font-size:11px;color:var(--g400);padding:28px 18px;border-top:1px solid var(--g200);margin-top:8px;display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}

/* Form elements (panel izquierdo) */
.stitle{font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--g600);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--g200);margin-top:22px}
.stitle:first-child{margin-top:0}
.fg{margin-bottom:13px}
.flbl{font-size:12px;font-weight:500;color:var(--g700);display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
.flbl span{font-family:var(--mono);font-size:11.5px;font-weight:500;color:#0b0a09;background:white;padding:3px 8px;border-radius:6px;border:1px solid var(--g200);box-shadow:var(--shadow-1);font-feature-settings:"tnum"}
input[type=range]{width:100%;height:4px;-webkit-appearance:none;appearance:none;background:var(--g200);border-radius:2px;outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#0b0a09;border:2px solid white;box-shadow:0 0 0 1px var(--g300),0 1px 4px rgba(0,0,0,0.14);cursor:pointer;transition:transform .15s}
input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.1)}
input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#0b0a09;border:2px solid white;box-shadow:0 0 0 1px var(--g300),0 1px 4px rgba(0,0,0,0.14);cursor:pointer}
.fsel{width:100%;padding:9px 12px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:13px;color:var(--g900);background:white;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239E9D97' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer;transition:all .15s}
.fsel:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(11,10,9,0.08)}
.toggle-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:6px 0}
.toggle-lbl{font-size:12px;color:var(--g700);flex:1;line-height:1.5}
.toggle-sw{position:relative;width:38px;height:22px;cursor:pointer;flex-shrink:0}
.toggle-sw input{opacity:0;width:0;height:0}
.toggle-sl{position:absolute;inset:0;background:var(--g300);border-radius:11px;transition:.25s}
.toggle-sl::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:white;border-radius:50%;transition:.25s;box-shadow:0 1px 3px rgba(0,0,0,0.18)}
.toggle-sw input:checked+.toggle-sl{background:#0b0a09}
.toggle-sw input:checked+.toggle-sl::before{transform:translateX(16px)}
.ib{padding:10px 13px;border-radius:var(--r);font-size:12px;line-height:1.55;margin-bottom:12px;border:1px solid transparent}
.ib.am{background:var(--amber-lt);color:#7a4d0a;border-color:rgba(168,105,26,0.18)}
.ib.bl{background:var(--blue-lt);color:var(--blue);border-color:rgba(11,10,9,0.08)}
.ib.rd{background:var(--red-lt);color:var(--red);border-color:rgba(176,58,58,0.18)}
.ib.gn{background:var(--teal-lt);color:var(--teal);border-color:rgba(31,111,86,0.18)}
.ib strong{font-weight:600}
.pill{display:inline-block;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:-0.005em;line-height:1.3}
.pill-gn{background:var(--teal-lt);color:var(--teal)}
.mix-row{display:grid;grid-template-columns:1fr 96px;gap:8px;align-items:center;background:white;border-radius:var(--r);padding:9px 12px;border:1px solid var(--g200);margin-bottom:5px;transition:all .15s}
.mix-row.active{border-color:var(--g700);background:var(--g50)}
.mix-name{font-size:12px;font-weight:600;color:var(--g900)}
.mix-sub{font-size:11px;color:var(--g400);margin-top:1px}
.mix-qty{display:flex;align-items:center;gap:2px;justify-content:flex-end;background:var(--g100);padding:2px;border-radius:7px;border:1px solid var(--g200)}
.mix-qty button{width:24px;height:24px;border-radius:5px;border:none;background:transparent;font-size:14px;cursor:pointer;color:var(--g700);display:flex;align-items:center;justify-content:center;transition:all .12s;line-height:1;font-weight:600}
.mix-qty button:hover{background:white;color:#0b0a09;box-shadow:var(--shadow-1)}
.mix-qty-n{font-family:var(--mono);font-size:13px;font-weight:600;color:#0b0a09;min-width:24px;text-align:center;font-feature-settings:"tnum"}
.mpct-wrap{display:flex;align-items:center;gap:2px;justify-content:flex-end;flex-shrink:0;background:var(--g100);padding:2px;border-radius:7px;border:1px solid var(--g200)}
.mpct-wrap button{width:22px;height:22px;border-radius:5px;border:none;background:transparent;font-size:13px;cursor:pointer;color:var(--g700);display:flex;align-items:center;justify-content:center;transition:all .12s;line-height:1;font-family:var(--mono);font-weight:600}
.mpct-wrap button:hover{background:white;color:#0b0a09;box-shadow:var(--shadow-1)}
.mpct-num{font-family:var(--mono);font-size:13px;font-weight:600;color:#0b0a09;min-width:36px;text-align:center;font-feature-settings:"tnum"}
.metodo-group-lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:var(--lime-dk);display:flex;align-items:center;gap:10px;margin:18px 0 8px;padding:4px 0}
.metodo-group-lbl:before,.metodo-group-lbl:after{content:'';flex:1;border-top:1px solid var(--g200)}
.metodo-group-sin{color:var(--amber)}
.metodo-row{border:1px solid var(--g200);border-radius:var(--r);margin-bottom:6px;overflow:hidden;background:white;transition:all .2s;box-shadow:var(--shadow-1)}
.metodo-row.active{border-color:var(--lime-dk);background:#fcffe0;box-shadow:0 0 0 3px rgba(203,241,53,0.2),var(--shadow-1)}
.metodo-row.metodo-sin.active{border-color:#185FA5;background:#f3f8ff;box-shadow:0 0 0 3px rgba(24,95,165,0.14),var(--shadow-1)}
.metodo-top{display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;padding:10px 12px 8px;gap:10px}
.metodo-info{flex:1;min-width:0}
.metodo-name{font-size:12px;font-weight:600;color:var(--g900);line-height:1.35}
.metodo-tasa{font-size:9.5px;padding:2px 7px;border-radius:20px;background:var(--teal-lt);color:var(--teal);font-weight:600;margin-left:4px;white-space:nowrap;letter-spacing:0.01em}
.metodo-row.metodo-sin .metodo-tasa{background:#E6F1FB;color:#0C447C}
.metodo-sub{font-size:10.5px;color:var(--g400);margin-top:3px;line-height:1.4}
.cadena-wrap{background:var(--g50);border-top:1px solid var(--g200);padding:9px 12px;overflow-x:auto}
.cadena-row{display:flex;flex-direction:row;align-items:stretch;gap:5px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}
.step-box{background:white;border:1px solid var(--g200);border-radius:6px;padding:6px 8px;text-align:center;min-width:48px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:var(--shadow-1)}
.step-n{font-size:14px;font-weight:700;color:var(--g900);line-height:1.1;font-family:var(--font);letter-spacing:-0.02em;font-feature-settings:"tnum"}
.step-l{font-size:8.5px;color:var(--g400);line-height:1.35;margin-top:3px;text-align:center;letter-spacing:0.02em}
.step-hi{border-color:var(--lime-dk)!important;background:#fbffd9!important}
.step-hi .step-n{color:#4a6600!important}.step-hi .step-l{color:#5a7800!important}
.step-hi-blue{border-color:#185FA5!important;background:#E6F1FB!important}
.step-hi-blue .step-n{color:#0C447C!important}.step-hi-blue .step-l{color:#185FA5!important}
.step-hi-amber{border-color:#854F0B!important;background:#FAEEDA!important}
.step-hi-amber .step-n{color:#633806!important}.step-hi-amber .step-l{color:#854F0B!important}
.step-arr{color:var(--g300);font-size:13px;flex-shrink:0;align-self:center;padding:0 2px;line-height:1}
.cadena-note{font-size:9.5px;color:var(--g400);margin-top:5px;font-style:italic;line-height:1.4}

${FUNNEL_CSS}

/* ══ TABLA CONSOLIDADO (.dt) ══ (verbatim del legacy plataforma; sin ".dt tfoot td", no usado) */
table.dt{width:100%;border-collapse:collapse;font-size:13px}
.dt th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--g400);padding:8px 10px;border-bottom:1px solid var(--g200)}
.dt td{padding:9px 10px;border-bottom:1px solid var(--g100);color:var(--g700)}
.dt tr:last-child td{border-bottom:none}

/* Print */
@media print{
  .header,.module-bar,.hout,.report-btn,.left{display:none!important}
  .two-col{display:block}
  .right{padding:0;max-width:none}
  .card,.lit-box{break-inside:avoid;border:1px solid #ccc;margin-bottom:10px;box-shadow:none}
  .print-header{display:flex!important;align-items:center;gap:14px;padding:10px 0 14px;border-bottom:2px solid #003781;margin-bottom:14px}
  .print-logo-wrap{background:#000;border-radius:8px;padding:6px 10px}
  .print-logo{width:100px;height:auto}
  .print-title{font-size:14px;font-weight:700;color:#003781}
  .print-asesor{font-size:12px;color:#3C3B37;margin-top:2px}
  .fbar,.bar-c,.bar-p,.bar-v,.smc,.mc{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media screen{.print-header{display:none}}

@media(max-width:900px){
  .two-col{grid-template-columns:1fr}
  .left{max-height:none;position:static;border-right:none;border-bottom:1px solid var(--g200)}
  .right{padding:18px}
  .fstep{grid-template-columns:90px 1fr 44px 90px;gap:8px}
  .module-bar{padding:0 14px}
  .header{padding:9px 14px}
}

/* Login (gate funcional) */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--g100)}
.login-card{background:white;border:1px solid var(--g200);border-radius:var(--rx);padding:32px 30px;width:100%;max-width:400px;box-shadow:var(--shadow-1)}
.login-card input{width:100%;padding:11px 14px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:14px;color:var(--g900);outline:none;margin-bottom:12px}
.login-card input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(11,10,9,0.08)}
.login-btn{width:100%;padding:13px;border:none;border-radius:var(--r);background:#0b0a09;color:white;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer}
.login-btn:disabled{opacity:.5;cursor:not-allowed}
`

function LogoProxis() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="16" cy="16" r="4.5" fill="#a8cc1a" />
      <circle cx="6" cy="9" r="3" fill="#a8cc1a" opacity="0.85" />
      <circle cx="26" cy="9" r="3" fill="#a8cc1a" opacity="0.85" />
      <circle cx="6" cy="23" r="3" fill="#a8cc1a" opacity="0.6" />
      <circle cx="26" cy="23" r="3" fill="#a8cc1a" opacity="0.6" />
      <line x1="8.6" y1="10.6" x2="13.2" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="8.6" y1="21.4" x2="13.2" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

// Estilo del input numérico (calco de numInput, sim.js:178-183).
const inpNum: React.CSSProperties = { padding: '5px 8px', border: '1.5px solid var(--g200)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'center' }

// Estado del panel izquierdo Consorcio (calco de csState + valores de los inputs de sim.js).
type CsMp = { cp: number; cm: number; aua: number; ho: number; co: number; hi: number }
type CsInv = { gold: number; exp: number; ffmm: number }
type CsState = {
  asesor: string; ant: number; cartera: number; meta: number
  cns: number; polizas: number; promtrim: number
  mp: CsMp; inv: CsInv; saludUfa: number
  pcts: Record<string, number>
}

export default function SimuladorConsorcioPage() {
  const { token, ident, login: signIn, logout, loadIdentity } = useAuth()
  const router = useRouter()
  const [uf, setUf] = useState('…')
  const [ufVal, setUfVal] = useState(39500) // UF numérica para el motor; fallback 39500 (Consorcio, ≠ 39357 Zurich) — calco UF() sim.js:23
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({ consol: false })

  // Estado del panel izquierdo (controlado). Defaults = csState (sim.js:13-16) +
  // valores iniciales de los inputs (sim.js:194-222).
  const [cs, setCs] = useState<CsState>({
    asesor: '', ant: 1, cartera: 90, meta: 1500000,
    cns: 0, polizas: 0, promtrim: 0,
    mp: { cp: 0, cm: 0, aua: 0, ho: 0, co: 0, hi: 0 },
    inv: { gold: 0, exp: 0, ffmm: 0 },
    saludUfa: 0,
    pcts: { ref1: 40, ref2: 40, ref3: 0, ref4: 0, dig: 10, frio: 10 },
  })
  const csSet = (patch: Partial<CsState>) => setCs((p) => ({ ...p, ...patch }))
  const csMp = (k: keyof CsMp, v: number) => setCs((p) => ({ ...p, mp: { ...p.mp, [k]: v } }))
  const csInv = (k: keyof CsInv, v: number) => setCs((p) => ({ ...p, inv: { ...p.inv, [k]: v } }))
  // Stepper de % por método (pasos de 5, tope global 100) — calco de csChPct (sim.js:150-158).
  const csChPct = (id: string, d: number) => setCs((p) => ({ ...p, pcts: { ...p.pcts, [id]: nextPct(p.pcts, id, d) } }))

  // Asesor mostrado: cs.asesor con fallback 'Asesor' (calco de sim.js:106).
  const asesor = cs.asesor || 'Asesor'

  // Formato CLP local (calco de sim.js:22, rama fallback — no hay global `fmt` en React).
  const fmtCLP = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

  // Campo numérico (calco de numInput, sim.js:178-183): input mono 100px + unidad.
  const numField = (value: number, onChange: (v: number) => void, max: number, unit: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <input type="number" step={0.1} min={0} max={max} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={{ ...inpNum, width: 100 }} placeholder={unit} />
      <span style={{ fontSize: 11, color: 'var(--g400)' }}>{unit}</span>
    </div>
  )

  useEffect(() => {
    fetch('https://mindicador.cl/api/uf').then((r) => r.json())
      .then((d) => { setUf('$' + Math.round(d.serie[0].valor).toLocaleString('es-CL')); setUfVal(d.serie[0].valor) })
      .catch(() => setUf('—'))
  }, [])

  // Validación de sesión al cargar (calco de cargarIdent): /api/app/me con 401→logout,
  // ahora vía el AuthProvider. El header de esta página no usa la identidad (Consorcio hardcodeado).
  useEffect(() => { if (token) loadIdentity() }, [token, loadIdentity])
  // Gate de rol (C1.2): el Simulador de Metas es vista de supervisor → un asesor se redirige a Mi Informe.
  useEffect(() => { if (ident?.tipo === 'asesor') router.push('/app/informe') }, [ident, router])

  async function login() {
    setErr(''); setCargando(true)
    const res = await signIn(email, pass)
    if (!res.ok) setErr(res.error ?? 'Credenciales incorrectas')
    setCargando(false)
  }
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  // ── LOGIN ──
  if (!token) {
    return (
      <>
        <style>{CSS}</style>
        <div className="login-wrap">
          <div className="login-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>Pro<span style={{ color: '#a8cc1a' }}>xis</span></span>
              <span style={{ fontSize: 13, color: 'var(--g600)' }}>· Simulador de Metas</span>
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} placeholder="••••••••" />
            <button className="login-btn" onClick={login} disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
            {err && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>{err}</div>}
          </div>
        </div>
      </>
    )
  }

  // ── Derivados (B3): cálculo puro en cada render, calco de renderConsorcio (sim.js:56-130).
  //    Reutiliza el motor (computeConsorcio) y el embudo (calcEmbudo) de calculoConsorcio.ts;
  //    el componente solo ensambla presentación. Aún NO se pintan (eso es B4-B7): el panel
  //    derecho sigue en shells. ──
  const antiguedad = Math.round(cs.ant)
  const cartera = cs.cartera
  const meta = cs.meta
  const cnsVida = cs.cns
  const nPolizas = Math.max(0, Math.round(cs.polizas))
  const promTrim = cs.promtrim
  const multiproducto = [
    { prod: 'PVX_B_CP', n: Math.round(cs.mp.cp) },
    { prod: 'PVX_B_CM', n: Math.round(cs.mp.cm) },
    { prod: 'PVX_B_CO', montoUF: cs.mp.co },
    { prod: 'PVX_B_HI', montoUF: cs.mp.hi },
    { prod: 'PVX_G_AU_anual', montoUF: cs.mp.aua },
    { prod: 'PVX_G_HO', montoUF: cs.mp.ho },
  ]
  const inversiones = [
    { prod: 'PVX_I05', montoUF: cs.inv.gold },
    { prod: 'PVX_I01', montoUF: cs.inv.exp },
    { prod: 'PVX_I06', montoUF: cs.inv.ffmm },
  ]
  const saludUfaMensual = cs.saludUfa / 12
  // Históricos en 0 (ejecutivo nuevo) — sin pantalla; transcritos con sus defaults (sim.js:82-87).
  const scn: ConsorcioScn = {
    antiguedad, carteraVigente: cartera, cnsVida, promTrimCns: promTrim,
    multiproducto, inversiones, saludUfaMensual, saludVigencia: 0,
    recaudPolizas: [], cnsAjustadosTrim: 0, aumSaldos: {},
  }
  const R = computeConsorcio(scn, ufVal)
  const c = R.comps
  const money = (o: { clp?: number; uf?: number }) => (o.clp || 0) + (o.uf || 0) * ufVal // presentación (sim.js:92)
  const factorRet = R.factorRet
  const bonos = [
    { k: 'Comisión Vida', det: `CNS ajustados ${Math.round(c.comVida.cnsAjustados).toLocaleString('es-CL')}`, m: money(c.comVida) },
    { k: 'Bono Excelencia', det: R.factorRet >= 7 ? `Factor ${R.factorRet} · trimestre ajustado` : 'Requiere factor ≥ 7', m: money(c.bonoExc) },
    { k: 'Comisión Inversiones', det: `${c.comInv.uf.toFixed(2)} UF`, m: money(c.comInv) },
    { k: 'Bono Multiproducto', det: `Amplificador ${c.bonoMulti.amplificador.toFixed(1)}×`, m: money(c.bonoMulti) },
    { k: 'Bono Salud', det: c.bonoSalud.uf > 0 ? `${c.bonoSalud.uf.toFixed(2)} UF` : 'Sin producción salud', m: money(c.bonoSalud) },
    { k: 'Bono Recaudación', det: c.bonoRecaud.clp > 0 ? `Ponderadas ${c.bonoRecaud.ponderadas}` : 'Sin cartera histórica', m: money(c.bonoRecaud) },
    { k: 'Bono AUM', det: c.bonoAUM.uf > 0 ? `${c.bonoAUM.uf.toFixed(2)} UF` : 'Sin saldos AUM', m: money(c.bonoAUM) },
  ]
  const ingresoVariable = bonos.reduce((a, b) => a + b.m, 0)
  const total = R.ingresoTotal
  const baseGratif = total - Math.round(ingresoVariable) // base por resta (sim.js:105); puede diferir de 729000 por redondeo
  const diff = total - meta
  const emb = calcEmbudo(cs.pcts, nPolizas)
  const totC = emb.totContactos

  // Mientras resuelve la identidad, o si es asesor (en plena redirección): NO renderizar el Simulador.
  if (!ident || ident.tipo === 'asesor') {
    return (
      <>
        <style>{CSS}</style>
        <div className="login-wrap"><div style={{ color: 'var(--g400)', fontSize: 14 }}>Cargando…</div></div>
      </>
    )
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app-bg">
        {/* Print header (oculto en pantalla) */}
        <div className="print-header">
          <div className="print-logo-wrap">
            <svg width="80" height="24" viewBox="0 0 80 24" fill="none">
              <circle cx="12" cy="12" r="3.4" fill="#a8cc1a" />
              <circle cx="4.5" cy="6.75" r="2.25" fill="#a8cc1a" opacity="0.85" />
              <circle cx="19.5" cy="6.75" r="2.25" fill="#a8cc1a" opacity="0.85" />
              <circle cx="4.5" cy="17.25" r="2.25" fill="#a8cc1a" opacity="0.6" />
              <circle cx="19.5" cy="17.25" r="2.25" fill="#a8cc1a" opacity="0.6" />
            </svg>
          </div>
          <div><div className="print-title">Proxis · Chile</div><div className="print-asesor" id="print-name"></div></div>
        </div>

        {/* App-shell */}
        <header className="header">
          <div className="hlogo-wrap" style={{ gap: 8 }}>
            <LogoProxis />
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 18, color: 'white', letterSpacing: '-0.04em' }}>Pro<span style={{ color: '#cbf135' }}>xis</span></span>
          </div>
          <div className="hdiv" />
          <div className="hlogo-text" style={{ fontSize: 11, fontWeight: 600, color: 'white', lineHeight: 1.3 }}>Prospección<span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: .7, letterSpacing: '.07em', textTransform: 'uppercase' }}>en práctica</span></div>
          <span className="huf">UF: <span className="uf-display">{uf}</span></span>
          <div className="hml">
            {/* Supervisora Consorcio hardcodeada (Valeska Comparini Cruells). Sale del
                conocimiento de plataforma, NO del calco. Bloqueo de tenant = deuda
                (ver DISENO_CONSOLIDACION.md). Paralelo a C1 de Zurich. */}
            <div className="hrole">{ident?.nombre ?? ''} · <strong>{ident?.tipo === 'mando' ? 'Supervisora' : 'Asesor/a'}</strong></div>
            <a href="/" className="hinicio">← Inicio</a>
            <button className="hout" onClick={logout}>Salir</button>
          </div>
        </header>

        {/* Module bar (supervisor) */}
        <div className="module-bar">
          <div className="mod-btn active">📊 Simulador de Metas</div>
          {/* Tab inerte (sin handler), igual que Zurich */}
          <div className="mod-btn">📋 Tracker de Prospección</div>
        </div>

        {/* Módulo simulador */}
        <div className="two-col">
          {/* ── Panel izquierdo (inputs Consorcio) — calco de initConsorcio (sim.js:185-244) ── */}
          <div className="left" id="sim-left">
            <div className="stitle">Selección de asesor</div>
            {/* cs-asesor: input de texto con class fsel (la CSS le pinta chevron), calco de sim.js:193 */}
            <div className="fg"><div className="flbl">Asesor a simular</div>
              <input type="text" className="fsel" value={cs.asesor} onChange={(e) => csSet({ asesor: e.target.value })} placeholder="Nombre del asesor" style={{ width: '100%' }} /></div>
            <div className="fg"><div className="flbl">Antigüedad del asesor <span>{cs.ant + ' mes' + (cs.ant === 1 ? '' : 'es')}</span></div>
              <input type="range" min={1} max={120} step={1} value={cs.ant} onChange={(e) => csSet({ ant: +e.target.value })} /></div>
            <div className="fg"><div className="flbl">% Cartera vigente <span>{cs.cartera + '%'}</span></div>
              <input type="range" min={0} max={100} step={1} value={cs.cartera} onChange={(e) => csSet({ cartera: +e.target.value })} /></div>
            <div className="fg"><div className="flbl">Meta de ingreso mensual <span>{fmtCLP(cs.meta)}</span></div>
              <input type="range" min={500000} max={8000000} step={50000} value={cs.meta} onChange={(e) => csSet({ meta: +e.target.value })} /></div>

            <div className="stitle">Venta Vida</div>
            <div className="fg"><div className="flbl">CNS Vida del mes</div>{numField(cs.cns, (v) => csSet({ cns: v }), 999999, 'CNS')}</div>
            <div className="fg"><div className="flbl">Nº de pólizas de vida <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--g400)' }}>· alimenta el embudo</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="number" step={1} min={0} max={200} value={cs.polizas} onChange={(e) => csSet({ polizas: parseFloat(e.target.value) || 0 })} style={{ ...inpNum, width: 100 }} placeholder="pólizas" />
                <span style={{ fontSize: 11, color: 'var(--g400)' }}>pólizas/mes</span>
              </div></div>
            <div className="fg"><div className="flbl">Promedio trimestral CNS <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--g400)' }}>· Bono Excelencia</span></div>{numField(cs.promtrim, (v) => csSet({ promtrim: v }), 999999, 'CNS')}</div>

            <div className="stitle">Multiproducto</div>
            <div className="fg"><div className="flbl">Cuentas Plus (Nº)</div>{numField(cs.mp.cp, (v) => csMp('cp', v), 999, 'Nº')}</div>
            <div className="fg"><div className="flbl">Cuentas Más (Nº)</div>{numField(cs.mp.cm, (v) => csMp('cm', v), 999, 'Nº')}</div>
            <div className="fg"><div className="flbl">Auto anual (UF)</div>{numField(cs.mp.aua, (v) => csMp('aua', v), 99999, 'UF')}</div>
            <div className="fg"><div className="flbl">Hogar (UF)</div>{numField(cs.mp.ho, (v) => csMp('ho', v), 99999, 'UF')}</div>
            <div className="fg"><div className="flbl">Consumo (UF)</div>{numField(cs.mp.co, (v) => csMp('co', v), 99999, 'UF')}</div>
            <div className="fg"><div className="flbl">Hipotecario (UF)</div>{numField(cs.mp.hi, (v) => csMp('hi', v), 99999, 'UF')}</div>

            <div className="stitle">Inversiones (UF)</div>
            <div className="fg"><div className="flbl">Gold</div>{numField(cs.inv.gold, (v) => csInv('gold', v), 99999, 'UF')}</div>
            <div className="fg"><div className="flbl">APV Experto</div>{numField(cs.inv.exp, (v) => csInv('exp', v), 99999, 'UF')}</div>
            <div className="fg"><div className="flbl">FFMM Serie P</div>{numField(cs.inv.ffmm, (v) => csInv('ffmm', v), 99999, 'UF')}</div>

            <div className="stitle">Salud</div>
            <div className="fg"><div className="flbl">UFA anual</div>{numField(cs.saludUfa, (v) => csSet({ saludUfa: v }), 99999, 'UFA')}</div>

            <div className="stitle">Prospectos Referidos por Contactos / Nodos Referidores</div>
            <div className="ib am" style={{ fontSize: 11 }}><strong>Define el % de prospectos por método</strong> (pasos de 5%). Meta: ≥80% Contactos/Nodos Referidores.</div>
            {/* Grid de métodos: lista PLANA (sin encabezados de grupo ni cadena) — calco de csBuildMetodos (sim.js:160-176), distinto del de Zurich. */}
            <div id="cs-metodos-grid">
              {SIM_METODOS.map((m) => {
                const pct = cs.pcts[m.id] || 0
                return (
                  <div key={m.id} className={`metodo-row${pct > 0 ? ' active' : ''}${m.esNodo ? '' : ' metodo-sin'}`}>
                    <div className="metodo-top">
                      <div className="metodo-info">
                        <div className="metodo-name">{m.nombre} <span className="metodo-tasa">{m.tasa}</span></div>
                        <div className="metodo-sub">{m.desc}</div>
                      </div>
                      <div className="mpct-wrap"><button onClick={() => csChPct(m.id, -5)}>−</button><div className="mpct-num">{pct}%</div><button onClick={() => csChPct(m.id, 5)}>+</button></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Panel derecho (resultados) — slots en orden del legacy ── */}
          <div className="right">
            {/* 1) alert-box: estado de meta + botón Guardar (calco sim.js:118-127) */}
            <div id="alert-box" style={{ marginBottom: 12 }}>
              {Math.abs(diff) < 30000
                ? <div className="ib gn" style={{ textAlign: 'center' }}><strong>Meta prácticamente alcanzada.</strong> Ingreso: {fmtCLP(total)} · Asesor: {asesor}</div>
                : diff >= 0
                  ? <div className="ib gn" style={{ textAlign: 'center' }}><strong>Meta alcanzable.</strong> Ingreso: {fmtCLP(total)} · Excedente: {fmtCLP(diff)}</div>
                  : <div className="ib rd" style={{ textAlign: 'center' }}><strong>Meta no alcanzada.</strong> Ingreso: {fmtCLP(total)} · Brecha: {fmtCLP(Math.abs(diff))}.</div>}
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                {/* Guardado DESCONECTADO (stub inerte) — el legacy llama guardarMetasEnTracker() que escribe BD (sim.js:125).
                    Se omite también root._simMeta (sim.js:127): sin consumidor al ser el botón inerte. */}
                <button className="btn btn-success" onClick={() => { /* no-op: el simulador no toca BD */ }}>💾 Guardar metas de {asesor} en Tracker</button>
              </div>
            </div>

            {/* 2) Botón PDF (estático) */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <button className="btn btn-primary report-btn" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="white" strokeWidth="1.3" fill="none" strokeLinejoin="round" /><path d="M10 2v3h3M5 7h6M5 9.5h6M5 12h4" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></svg>
                Generar informe PDF — <span style={{ fontStyle: 'italic' }}>{asesor}</span>
              </button>
            </div>

            {/* 3) metric-row: 3 tarjetas .smc (calco de sim.js:111-115) */}
            <div className="mcrow" id="metric-row">
              <div className="smc"><div className="smc-lbl">Factor de Persistencia</div><div className="smc-val">{factorRet}</div><div className="smc-sub">Cartera {cartera}% · {antiguedad} mes{antiguedad === 1 ? '' : 'es'}</div></div>
              <div className="smc"><div className="smc-lbl">CNS Vida ajustados</div><div className="smc-val">{Math.round(c.comVida.cnsAjustados).toLocaleString('es-CL')}</div><div className="smc-sub">CNS {cnsVida.toLocaleString('es-CL')} × factor {factorRet}</div></div>
              <div className={`smc ${total >= meta ? 'ok' : 'ng'} ok`}><div className="smc-lbl">* Ingreso Bruto Aproximado</div><div className="smc-val">{fmtCLP(total)}</div><div className="smc-sub">UF: {fmtCLP(ufVal)} · Variable: {fmtCLP(ingresoVariable)}</div></div>
            </div>

            {/* 4) Nota referencial azul (estática, verbatim del template compartido) */}
            <div style={{ fontSize: 11, color: '#185FA5', lineHeight: 1.6, marginBottom: 12, padding: '9px 12px', background: '#E6F1FB', borderLeft: '3px solid #185FA5', borderRadius: '0 6px 6px 0' }}>ℹ️ * Cifra referencial. Valores aproximados. Es posible que haya diferencias con los valores reales. El objetivo del &quot;Ingreso Bruto Aproximado Total&quot; es servir solo de referencia general para el cálculo de las metas de prospección.</div>

            {/* 5) metric-contacts: tarjeta lima (calco de contactsCard, sim.js:28-52) */}
            <div id="metric-contacts">
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14, marginBottom: 4 }}>
                <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', background: '#fcffe0', border: '1.5px solid var(--lime-dk)', borderRadius: 'var(--rl)', padding: '14px 18px', boxShadow: '0 0 0 3px rgba(203,241,53,0.22),0 1px 2px rgba(0,0,0,0.04)', minWidth: 340 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="9" stroke="#4a6600" strokeWidth="1.8" />
                      <circle cx="12" cy="12" r="5" stroke="#4a6600" strokeWidth="1.8" />
                      <circle cx="12" cy="12" r="1.5" fill="#4a6600" />
                    </svg>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#4a6600', letterSpacing: '.09em', textTransform: 'uppercase', lineHeight: 1.2 }}>Contactos necesarios para tu meta</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ background: 'white', border: '2px solid var(--lime-dk)', borderRadius: 'var(--r)', padding: '8px 14px', textAlign: 'center', minWidth: 122, boxShadow: '0 1px 2px rgba(168,204,26,.08)' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 42, fontWeight: 800, lineHeight: 1, color: '#3a4f00', letterSpacing: '-0.03em' }}>{totC || 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--g600)', marginTop: 4, letterSpacing: '.03em', fontWeight: 500 }}>por mes</div>
                    </div>
                    <div style={{ background: 'white', border: '1.5px solid var(--lime-dk)', borderRadius: 'var(--r)', padding: '8px 14px', textAlign: 'center', minWidth: 122, boxShadow: '0 1px 2px rgba(168,204,26,.08)' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 600, lineHeight: 1, color: 'var(--g900)', letterSpacing: '-0.03em' }}>{Math.ceil((totC || 0) / 4)}</div>
                      <div style={{ fontSize: 10, color: 'var(--g600)', marginTop: 4, letterSpacing: '.03em', fontWeight: 500 }}>esta semana</div>
                    </div>
                  </div>
                  <div title="Activar plan" style={{ position: 'absolute', bottom: -14, right: -14, width: 56, height: 56, borderRadius: '50%', background: 'var(--lime)', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 6px 16px rgba(168,204,26,.36),0 1px 3px rgba(0,0,0,.08)', lineHeight: 1, cursor: 'pointer' }}>🚀</div>
                </div>
              </div>
            </div>

            {/* 6) Card embudo: #funnel-content (calco de nucleo/embudo.js simRenderFunnel; reutiliza emb de B3) */}
            <div className="card"><div className="card-title">Prospectos Referidos por Contactos / Nodos</div>
              <div id="funnel-content">
                {(() => {
                  const P = cs.pcts
                  const tot = Object.values(P).reduce((a, b) => a + (+b || 0), 0)
                  if (tot === 0 || nPolizas === 0) {
                    return <div className="ib am">Asigna porcentajes a al menos un método y define el mix de productos.</div>
                  }
                  const totP = emb.totProspectos
                  const activos = emb.activos
                  const cSem = totC > 0 ? Math.ceil(totC / 4) : 0
                  const maxP = Math.max(totP, 1)
                  const totP_nodo = activos.filter((m) => m.esNodo).reduce((a, m) => a + m.prospectos, 0)
                  const totP_frio = totP - totP_nodo
                  const metodo = (id: string): Metodo => SIM_METODOS.find((m) => m.id === id) || ({} as Metodo)
                  const sep = (lbl: string, cls: string) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 6px', fontSize: 10, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: cls === 'nodo' ? '#0F6E56' : 'var(--g400)' }}>
                      <span style={{ flex: 1, borderTop: `0.5px solid ${cls === 'nodo' ? '#5DCAA5' : 'var(--g200)'}` }} />
                      <span>{lbl}</span>
                      <span style={{ flex: 1, borderTop: `0.5px solid ${cls === 'nodo' ? '#5DCAA5' : 'var(--g200)'}` }} />
                    </div>
                  )
                  const fstep = (key: string, lbl: string, val: number, cls: string, eq: string, small: boolean) => (
                    <div key={key} className="fstep" style={small ? { opacity: .7 } : undefined}>
                      <div className="fstep-lbl" style={small ? { fontSize: 11 } : undefined}>{lbl}</div>
                      <div className="fbar-wrap"><div className={`fbar ${cls}`} style={{ width: `${Math.round((val / maxP) * 100)}%`, ...(small ? { background: '#E8E7E2', color: '#5F5E5A', fontSize: 11 } : {}) }}>{val}</div></div>
                      <div className="fnum" style={small ? { fontSize: 13, color: 'var(--g400)' } : undefined}>{val}</div>
                      <div className="feq" style={small ? { fontSize: 10 } : undefined}>{eq}</div>
                    </div>
                  )
                  const nodoAct = activos.filter((m) => m.esNodo)
                  const sinAct = activos.filter((m) => !m.esNodo)
                  const row = (m: (typeof activos)[number], key: string) => {
                    const info = metodo(m.id)
                    const pct = totP > 0 ? Math.round(m.prospectos / totP * 100) : 0
                    const w = pct
                    const nombre = m.esNodo ? (info.nombre || '').replace('Contacto/Nodo — ', '') : (info.nombre || '')
                    return (
                      <div key={key} className="orig-row">
                        <div className="orig-lbl">{nombre}</div>
                        <div className="orig-bar-wrap"><div className="orig-bar" style={{ width: `${Math.max(w, 2)}%`, background: info.color }}>
                          {m.prospectos > 0 ? <span className="orig-val">{m.prospectos}</span> : null}</div>
                          <span className="orig-pct">{pct}%</span></div>
                      </div>
                    )
                  }
                  return (
                    <>
                      {sep('con contacto / nodo activo', 'nodo')}
                      {totC > 0 && fstep('c', 'Contactos/Nodos', totC, 'bar-c', `${cSem} contacto${cSem === 1 ? '' : 's'} por semana`, false)}
                      {fstep('pn', 'Prospectos', totP_nodo, 'bar-p', '5 por contacto', false)}
                      {sep('sin contacto / nodo', 'cold')}
                      {totP_frio > 0 && fstep('pf', 'Digital + frío', totP_frio, 'bar-p', 'prospectos adicionales', true)}
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '.5px solid var(--g200)', fontSize: 11, color: 'var(--g400)' }}>
                        Total prospectos del período: <strong style={{ color: 'var(--g900)' }}>{totP}</strong> · Ver desglose completo en <em>Origen estimado de prospectos</em>
                      </div>
                      {activos.length > 0 && (
                        <div className="orig-chart">
                          <div className="orig-title">Origen estimado de prospectos</div>
                          {nodoAct.length > 0 && <><div className="orig-group-lbl orig-nodo">Con contacto / nodo activo</div>{nodoAct.map((m, i) => row(m, `n${i}`))}</>}
                          {sinAct.length > 0 && <><div className="orig-group-lbl orig-sin">Sin contacto / nodo</div>{sinAct.map((m, i) => row(m, `s${i}`))}</>}
                          <div className="orig-total">Total: <strong>{totP}</strong> prospectos estimados</div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>

            {/* 7) lit-box (estática, verbatim — contenido genérico de industria) */}
            <div className="lit-box">
              <div className="lit-title">Tasas de cierre de referencia — Granum · LIMRA · MDRT · Finseca · NAIFA</div>
              <table className="lit-table">
                <thead><tr><th>Origen del prospecto</th><th>Tasa de cierre</th><th>Prospectos por venta</th></tr></thead>
                <tbody>
                  <tr><td>Frío (sin referido)</td><td>10–15%</td><td>7–10</td></tr>
                  <tr><td>Referido (nombre dado)</td><td>25–30%</td><td>3–4</td></tr>
                  <tr><td>Referido con presentación del nodo</td><td>40–50%</td><td>2–3</td></tr>
                  <tr><td>Transferencia en vivo (nodo presenta)</td><td>55–70%</td><td>1–2</td></tr>
                </tbody>
              </table>
              <div className="lit-note"><strong>Sistema TPS — Nodos Referidores:</strong> 1 contacto/nodo activo genera en promedio 5 prospectos referidos. Con presentación activa del nodo, la tasa de cierre base alcanza 50–65%, resultando en 1,5–2 ventas por nodo.<br /><br />
                <strong>Factor de efectividad del asesor para Transferencia en vivo (nodo presenta):</strong> <strong>Baja (33%)</strong> → 1 venta cada 4–5 prospectos · <strong>Media (66%)</strong> → 1 venta cada 2–3 · <strong>Alta (100%)</strong> → 1 venta cada 1–2. Mejora con entrenamiento y dominio del cierre.</div>
            </div>

            {/* card-mix OCULTO — Consorcio no lo muestra (sim.js:189). No se renderiza. */}
            {/* card-tramos ("Transformación AE Puntos → Bono UF") OCULTO — sim.js:189. No se renderiza. */}

            {/* 8) card-consol: colapsable + tabla .dt (calco legacy plataforma:501-508); filas sim.js:137-143 */}
            <div className={`card card-collapsible${open.consol ? ' open' : ''}`} style={{ marginTop: 14 }}>
              <div className="card-title" onClick={() => toggle('consol')}>🧾 Consolidado mensual completo <span className="coll-arrow">▾</span></div>
              <div className="card-body">
                <table className="dt"><thead><tr><th>Componente</th><th>Detalle</th><th>$ mes</th></tr></thead>
                  <tbody id="consolidado-tbody">
                    {bonos.map((b, i) => (
                      <tr key={i}><td>{b.k}</td><td>{b.det}</td><td><strong>{fmtCLP(b.m)}</strong></td></tr>
                    ))}
                    <tr style={{ background: 'var(--g50,#f7f7f5)' }}><td><strong>Ingreso Variable</strong></td><td>Suma de los 7 componentes</td><td><strong>{fmtCLP(ingresoVariable)}</strong></td></tr>
                    <tr><td>Base + Gratificación</td><td>Fijo mensual</td><td><strong>{fmtCLP(baseGratif)}</strong></td></tr>
                    <tr style={{ background: 'var(--teal-lt,#E1F5EE)' }}><td colSpan={2}><strong>INGRESO BRUTO MENSUAL ESTIMADO</strong></td><td><strong style={{ color: 'var(--teal,#0F6E56)', fontSize: 14 }}>{fmtCLP(total)}</strong></td></tr>
                  </tbody></table>
                <p style={{ fontSize: 11, color: 'var(--g400)', marginTop: 8, lineHeight: 1.6 }}>*Valores aproximados de referencia general. Es posible que haya diferencias con los valores reales.</p>
              </div>
            </div>

            {/* 9) disclaimer: texto propio de Consorcio (calco sim.js:146) + estilos inline del legacy (plataforma:509) */}
            <p className="disclaimer" id="disclaimer-txt" style={{ fontSize: 11, color: 'var(--g400)', borderTop: '1px solid var(--g200)', paddingTop: 12, marginTop: 4, lineHeight: 1.6 }}>* Esta simulación es una <strong>referencia de gestión</strong>, no una liquidación exacta. Estima la producción y el número de contactos necesarios para alcanzar una meta de ingresos. El resultado real depende de la producción CNS, la persistencia de cartera y la antigüedad. UF = ${Math.round(ufVal).toLocaleString('es-CL')}.</p>

            {/* 10) copyright (estático) */}
            <div className="copyright" style={{ marginTop: 24 }}>
              <span style={{ color: 'var(--g400)' }}>© 2026 The Precision Selling · Todos los derechos reservados</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
