'use client'
import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  SIM_PRODS, SIM_PRODS_GI, SIM_METODOS, TOP20_APE_UF, TOP20_CV_UF, ZURICH_ASESORES, ZURICH_SUPERVISORA, SUELDO_BASE_DEFAULT, UF_DEFAULT,
  initialStateZurich, clampQty, nextPct, fmtCLP, fmtUF, labelAnt, labelPersist, labelPPA, labelApvEx, labelApvFlex, labelRp,
  PMIN, FP, simCalcZ, simCalcBonoUF, calcEmbudo,
  type SimState, type Metodo,
} from '@/lib/simulador/calculo'

/*
 * Simulador de Metas — calco fiel del legacy (módulo mod-simulador, tenant ZURICH).
 * SECCIÓN 1: scaffold/layout. SECCIÓN 2: panel izquierdo (inputs Zurich).
 * Resultados/desgloses (panel derecho) = Sección 3. Cálculo puro (calculo.ts), NO toca BD.
 * Guardado de metas EXCLUIDO por decisión.
 */

const TOKEN_KEY = 'app_token'
type Identidad = { nombre: string; tipo: string } | null

const CSS = `
:root{
  --blue:#0b0a09;--blue-mid:#3a3833;--blue-lt:#f2efe9;--blue-pale:#faf8f4;
  --lime:#cbf135;--lime-dk:#a8cc1a;
  --teal:#1f6f56;--teal-lt:#e6f3ed;
  --amber:#a8691a;--amber-lt:#f8ecd6;
  --red:#b03a3a;--red-lt:#fbe9e9;
  --green:#3b6d11;--green-lt:#e9f2dd;
  --g50:#fafaf7;--g100:#f5f3ef;--g200:#ecebe5;--g300:#dddbd3;--g400:#9d9b93;--g600:#5d5b54;--g700:#3a3934;--g900:#161614;
  --font:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;--mono:'DM Mono',ui-monospace,monospace;
  --r:10px;--rl:14px;--rx:18px;
  --shadow-1:0 1px 2px rgba(20,18,12,0.04);
}
.app-bg{min-height:100vh;background:var(--g100);color:var(--g900);font-family:var(--font);font-size:13.5px;line-height:1.55;letter-spacing:-0.005em;-webkit-font-smoothing:antialiased}
.app-bg *,.app-bg *::before,.app-bg *::after{box-sizing:border-box}
.app-bg h2,.app-bg h3,.app-bg p,.app-bg table{margin:0}

/* App-shell */
.header{background:#0b0a09;color:white;padding:11px 24px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:100;border-bottom:1px solid rgba(255,255,255,0.05);box-shadow:0 1px 0 0 var(--lime-dk),0 4px 14px rgba(0,0,0,0.06)}
.hlogo-wrap{display:flex;align-items:center;background:transparent;border-radius:8px;flex-shrink:0}
.hdiv{width:1px;height:22px;background:rgba(255,255,255,.14);flex-shrink:0}
.hlogo-text{font-size:11px;font-weight:600;color:white;line-height:1.3}
.hlogo-text span{display:block;font-size:9.5px;font-weight:400;opacity:.55;letter-spacing:.1em;text-transform:uppercase;margin-top:1px}
.huf{font-size:11px;opacity:.7;display:inline-flex;align-items:center;gap:5px}
.uf-display{font-family:var(--mono);font-size:11px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:3px 10px;margin-left:2px;color:white;font-feature-settings:"tnum"}
.hrole{font-size:12px;opacity:.7}.hrole strong{font-weight:600;opacity:1}
.hml{margin-left:auto;display:flex;align-items:center;gap:10px}
.hinicio{font-size:12px;color:rgba(255,255,255,.5);text-decoration:none;padding:5px 12px;border:1px solid rgba(255,255,255,.2);border-radius:20px;transition:all .15s}
.hinicio:hover{color:rgba(255,255,255,.9)}
.hout{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:white;font-family:var(--font);font-size:12px;font-weight:500;padding:6px 14px;border-radius:20px;cursor:pointer;transition:all .15s}
.hout:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.24)}
.module-bar{background:white;border-bottom:1px solid var(--g200);padding:0 24px;display:flex;gap:0;overflow-x:auto}
.mod-btn{padding:14px 18px;font-size:13px;font-weight:600;color:var(--g400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:all .18s;display:flex;align-items:center;gap:7px;letter-spacing:-0.005em}
.mod-btn:hover{color:var(--g700)}
.mod-btn.active{color:#0b0a09;border-bottom-color:#0b0a09}

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
}
@media screen{.print-header{display:none}}

@media(max-width:900px){
  .two-col{grid-template-columns:1fr}
  .left{max-height:none;position:static;border-right:none;border-bottom:1px solid var(--g200)}
  .right{padding:18px}
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

const inpNum: React.CSSProperties = { padding: '5px 8px', border: '1.5px solid var(--g200)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'center' }

export default function SimuladorPage() {
  const [token, setToken] = useState<string | null>(null)
  const [ident, setIdent] = useState<Identidad>(null)
  const [uf, setUf] = useState('…')
  const [ufVal, setUfVal] = useState<number>(UF_DEFAULT) // M2(a): UF numérica para el cálculo (fallback 39357)
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({ mix: false, tramos: false, consol: false })
  const [s, setS] = useState<SimState>(() => initialStateZurich(ZURICH_ASESORES))

  // ── Updaters (calco del comportamiento del legacy; cálculo en calculo.ts) ──
  const upd = (patch: Partial<SimState>) => setS((p) => ({ ...p, ...patch }))
  const chQty = (id: string, d: number) => setS((p) => ({ ...p, qty: { ...p.qty, [id]: clampQty(p.qty[id] + d) } }))
  const setPrima = (id: string, v: number) => setS((p) => ({ ...p, prima: { ...p.prima, [id]: v } }))
  const chQtyGI = (id: string, d: number) => setS((p) => ({ ...p, qtyGI: { ...p.qtyGI, [id]: clampQty(p.qtyGI[id] + d) } }))
  const setPrimaGI = (id: string, v: number) => setS((p) => ({ ...p, primaGI: { ...p.primaGI, [id]: v } }))
  const chPct = (id: string, d: number) => setS((p) => ({ ...p, pcts: { ...p.pcts, [id]: nextPct(p.pcts, id, d) } }))

  useEffect(() => { const t = localStorage.getItem(TOKEN_KEY); if (t) setToken(t) }, [])
  useEffect(() => {
    fetch('https://mindicador.cl/api/uf').then((r) => r.json())
      .then((d) => { setUf('$' + Math.round(d.serie[0].valor).toLocaleString('es-CL')); setUfVal(d.serie[0].valor) })
      .catch(() => setUf('—'))
  }, [])

  const cargarIdent = useCallback(async (tk: string) => {
    try {
      const r = await fetch('/api/app/me', { headers: { Authorization: `Bearer ${tk}` } })
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setToken(null); return }
      const d = await r.json()
      if (r.ok) setIdent({ nombre: d.nombre, tipo: d.tipo })
    } catch { /* header sin identidad */ }
  }, [])
  useEffect(() => { if (token) cargarIdent(token) }, [token, cargarIdent])

  async function login() {
    setErr(''); setCargando(true)
    try {
      const r = await fetch('/api/vina/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? 'Credenciales incorrectas'); return }
      localStorage.setItem(TOKEN_KEY, d.token); setToken(d.token)
    } catch { setErr('No se pudo conectar') }
    finally { setCargando(false) }
  }
  function salir() { localStorage.removeItem(TOKEN_KEY); setToken(null); setIdent(null) }
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  // ── Grid de métodos (calco de buildSimMetodos: 3 encabezados intercalados + filas) ──
  function renderMetodos(): ReactNode[] {
    const out: ReactNode[] = []
    let hNodo = false, hPost = false, hSin = false
    SIM_METODOS.forEach((m) => {
      if (m.esNodo && !m.esPostCierre && !hNodo) { out.push(<div key="h1" className="metodo-group-lbl">Con contacto / nodo activo</div>); hNodo = true }
      if (m.esNodo && m.esPostCierre && !hPost) { out.push(<div key="h2" className="metodo-group-lbl" style={{ color: '#a8cc1a' }}>Referidos tras cierre o entrega de póliza</div>); hPost = true }
      if (!m.esNodo && !hSin) { out.push(<div key="h3" className="metodo-group-lbl metodo-group-sin">Sin contacto / nodo</div>); hSin = true }
      const pct = s.pcts[m.id] || 0
      out.push(
        <div key={m.id} className={`metodo-row${pct > 0 ? ' active' : ''}${m.esNodo ? '' : ' metodo-sin'}`}>
          <div className="metodo-top">
            <div className="metodo-info">
              <div className="metodo-name">{m.nombre} <span className="metodo-tasa">{m.tasa}</span></div>
              <div className="metodo-sub">{m.desc}</div>
            </div>
            <div className="mpct-wrap"><button onClick={() => chPct(m.id, -5)}>−</button><div className="mpct-num">{pct}%</div><button onClick={() => chPct(m.id, 5)}>+</button></div>
          </div>
          <div className="cadena-wrap">
            <div className="cadena-row">
              {m.cadena.map((step, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="step-arr">→</span>}
                  <div className={`step-box ${step.hi === true ? 'step-hi' : step.hi === 'blue' ? 'step-hi-blue' : step.hi === 'amber' ? 'step-hi-amber' : ''}`}>
                    <div className="step-n">{step.n}</div>
                    <div className="step-l">{step.l.split('\n').map((ln, j) => <Fragment key={j}>{j > 0 && <br />}{ln}</Fragment>)}</div>
                  </div>
                </Fragment>
              ))}
            </div>
            {m.esNodo && <div className="cadena-note">* Valores aproximados según efectividad del asesor.</div>}
          </div>
        </div>
      )
    })
    return out
  }

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

  // ── Derivados (3.2): cálculo puro en cada render. Aún NO conectados al DOM (eso es 3.3-3.6). ──
  const campana = s.campana
  const ant = s.ant
  const pR = s.persist / 100
  const pM = PMIN(ant)
  const fp = FP(pR, pM, ant)
  const { zVI, zGIBruto, zGI, zGITopado, zTotal, det, detGI, comVenta, incMant, ventas, bonoApe, bonoCv } = simCalcZ(s, campana, ufVal)
  const { uf: bUF, det: trDet, t5Hab, tope_t5 } = simCalcBonoUF(zTotal, ant, campana, s)
  const bonoNeto = bUF * fp * ufVal
  const total = SUELDO_BASE_DEFAULT + bonoNeto + comVenta + incMant + bonoApe + bonoCv
  const { totContactos, metaContactos, totProspectos, activos } = calcEmbudo(s.pcts, ventas)
  const mc = total >= s.meta ? 'ok' : 'ng'
  const diff = total - s.meta

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
            {/* C1: supervisora Zurich hardcodeada (calco del legacy USUARIOS). Bloqueo de tenant = deuda (ver DISENO_CONSOLIDACION.md). */}
            <div className="hrole">{ZURICH_SUPERVISORA} · <strong>Supervisora</strong></div>
            <a href="/" className="hinicio">← Inicio</a>
            <button className="hout" onClick={salir}>Salir</button>
          </div>
        </header>

        {/* Module bar (supervisor) */}
        <div className="module-bar">
          <div className="mod-btn active">📊 Simulador de Metas</div>
          <div className="mod-btn">📋 Tracker de Prospección</div>
        </div>

        {/* Módulo simulador */}
        <div className="two-col">
          {/* ── Panel izquierdo (inputs Zurich) — SECCIÓN 2 ── */}
          <div className="left">
            {/* 1 · Selección de asesor */}
            <div className="stitle">Selección de asesor</div>
            <div className="fg">
              <div className="flbl">Asesor a simular</div>
              <select className="fsel" value={s.asesor} onChange={(e) => upd({ asesor: e.target.value })}>
                {ZURICH_ASESORES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* 2 · Sliders base */}
            <div className="fg"><div className="flbl">Antigüedad del asesor <span>{labelAnt(s.ant)}</span></div>
              <input type="range" min={1} max={120} step={1} value={s.ant} onChange={(e) => upd({ ant: +e.target.value })} /></div>
            <div className="fg"><div className="flbl">Meta de ingreso mensual <span>{fmtCLP(s.meta)}</span></div>
              <input type="range" min={500000} max={8000000} step={50000} value={s.meta} onChange={(e) => upd({ meta: +e.target.value })} /></div>
            <div className="fg"><div className="flbl">Persistencia real estimada <span>{labelPersist(s.persist)}</span></div>
              <input type="range" min={0} max={120} step={1} value={s.persist} onChange={(e) => upd({ persist: +e.target.value })} /></div>
            {/* C4: persist-info (.ib.bl). Frame literal; valores calculados (mes, %, %, label) → "—"; se conectan en Sección 3. */}
            <div className="ib bl" style={{ fontSize: 11 }}>Mínima exigida (mes {ant}): <strong>{Math.round(pM * 100)}%</strong> · Cumplimiento: <strong>{Math.round(pR / pM * 100)}%</strong> → <strong>{(fp === 0 ? '0% — sin bono' : fp === .5 ? '50%' : fp === .65 ? '65%' : fp === .9 ? '90%' : fp === 1 ? '100%' : '120%')} del bono</strong></div>

            {/* 3 · Modo de contrato */}
            <div className="stitle">Modo de contrato</div>
            <div className="toggle-row">
              <div className="toggle-lbl"><strong>Activar campaña 2026</strong><br /><span style={{ fontSize: 11, color: 'var(--g400)' }}>APV 100% AE · topes ampliados</span></div>
              <label className="toggle-sw"><input type="checkbox" checked={s.campana} onChange={(e) => upd({ campana: e.target.checked })} /><span className="toggle-sl" /></label>
            </div>
            {/* C5: campana-info (.ib.bl). Rama campaña ON (default) literal; tope_t5 calculado → "—"; rama y tope se conectan en Sección 3. */}
            <div className="ib bl" style={{ fontSize: 11 }}>{campana
              ? <>Campaña 2026: APV al <strong>100%</strong>. Tope T5: <strong>{tope_t5 === null ? 'sin tope' : tope_t5 + ' AE'}</strong>. GI: tope liberado.</>
              : <>Contrato base: Tope T5 <strong>{tope_t5 === null ? 'sin tope' : tope_t5 + ' AE'}</strong> (mes {ant}). GI: tope 25% AE VI.</>}</div>

            {/* 4 · Mix de productos */}
            <div className="stitle">Mix de productos mensual</div>
            <div className="ib am" style={{ fontSize: 11 }}><strong>Número de pólizas por tipo en un mes típico.</strong></div>
            {SIM_PRODS.map((p) => (
              <div className="mix-row" key={p.id}>
                <div>
                  <div className="mix-name">{p.n}{p.id === 'APV' && <span className="pill pill-gn" style={{ marginLeft: 3, fontSize: 10 }}>campaña 100%</span>}</div>
                  <div className="mix-sub">Factor AE: {(p.z * 100).toFixed(0)}%</div>
                </div>
                <div className="mix-qty"><button onClick={() => chQty(p.id, -1)}>−</button><div className="mix-qty-n">{s.qty[p.id]}</div><button onClick={() => chQty(p.id, 1)}>+</button></div>
              </div>
            ))}

            {/* 5 · Primas Vida (visible si qty>0) */}
            <div className="stitle">Prima mensual promedio por producto (Vida)</div>
            {SIM_PRODS.filter((p) => s.qty[p.id] > 0).map((p) => (
              <div className="fg" key={p.id}>
                <div className="flbl">{p.n} <span style={{ fontSize: 10, color: 'var(--g400)' }}>PPA = prima × 12</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input type="number" step={0.1} min={0} max={9999} value={s.prima[p.id]} onChange={(e) => setPrima(p.id, parseFloat(e.target.value) || 0)} style={{ ...inpNum, width: 90 }} placeholder="UF" />
                  <span style={{ fontSize: 11, color: 'var(--g400)' }}>UF/mes</span>
                  <span style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--mono)' }}>{labelPPA(s.prima[p.id])}</span>
                </div>
              </div>
            ))}

            {/* 6 · Mix Generales (GI) */}
            <div className="stitle">Mix Generales (GI)</div>
            <div style={{ fontSize: 11, color: 'var(--g400)', marginBottom: 8 }}>Auto: 50% AE · Hogar: 100% AE. Se suman con tope del 25% del AE Vida.</div>
            {SIM_PRODS_GI.map((p) => (
              <div className={`mix-row${s.qtyGI[p.id] > 0 ? ' active' : ''}`} key={p.id}>
                <div><div className="mix-name">{p.n}</div><div className="mix-sub">AE: <strong>{(p.z * 100).toFixed(0)}%</strong></div></div>
                <div className="mix-qty"><button onClick={() => chQtyGI(p.id, -1)}>−</button><div className="mix-qty-n">{s.qtyGI[p.id]}</div><button onClick={() => chQtyGI(p.id, 1)}>+</button></div>
              </div>
            ))}
            {SIM_PRODS_GI.filter((p) => s.qtyGI[p.id] > 0).map((p) => (
              <div className="fg" key={p.id}>
                <div className="flbl">{p.n}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input type="number" step={0.1} min={0} max={999} value={s.primaGI[p.id]} onChange={(e) => setPrimaGI(p.id, parseFloat(e.target.value) || 0)} style={{ ...inpNum, width: 90 }} placeholder="UF" />
                  <span style={{ fontSize: 11, color: 'var(--g400)' }}>UF/mes</span>
                  <span style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--mono)' }}>{labelPPA(s.primaGI[p.id])}</span>
                </div>
              </div>
            ))}

            {/* 7 · Aportes y traspasos */}
            <div className="stitle">Aportes y traspasos (AE cartera)</div>
            <div className="fg"><div className="flbl">APV — Aporte extraordinario (UF) <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--g400)' }}>· PPA: 10% · AE: 50% (o 100% campaña)</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="number" step={0.1} min={0} max={99999} value={s.apvEx} onChange={(e) => upd({ apvEx: parseFloat(e.target.value) || 0 })} style={{ ...inpNum, width: 100 }} placeholder="UF" />
                <span style={{ fontSize: 11, color: 'var(--g400)' }}>UF · <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{labelApvEx(s.apvEx)}</span></span>
              </div>
            </div>
            <div className="fg"><div className="flbl">APV AE Flexible — Traspaso cartera (UF) <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--g400)' }}>· PPA: 10% del monto · AE: 25%</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="number" step={0.1} min={0} max={99999} value={s.apvFlexEx} onChange={(e) => upd({ apvFlexEx: parseFloat(e.target.value) || 0 })} style={{ ...inpNum, width: 100 }} placeholder="UF" />
                <span style={{ fontSize: 11, color: 'var(--g400)' }}>UF · <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{labelApvFlex(s.apvFlexEx)}</span></span>
              </div>
            </div>
            <div className="fg"><div className="flbl">Renta Preferente — Aporte extraordinario (UF) <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--g400)' }}>· AE: 5% del monto</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="number" step={0.1} min={0} max={99999} value={s.rpMonto} onChange={(e) => upd({ rpMonto: parseFloat(e.target.value) || 0 })} style={{ ...inpNum, width: 100 }} placeholder="UF" />
                <span style={{ fontSize: 11, color: 'var(--g400)' }}>UF · <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{labelRp(s.rpMonto)}</span></span>
              </div>
            </div>

            {/* 8 · KPI Campaña APV 100% */}
            <div className="stitle" style={{ color: '#BA7517' }}>KPI Campaña APV 100% <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--g400)' }}>— requiere los 3</span></div>
            <div style={{ background: '#FAEEDA', border: '1.5px solid #BA7517', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#633806', marginBottom: 8, lineHeight: 1.4 }}>Para pago al <strong>100%</strong>: debe cumplir <strong>los 3 KPI</strong>. Si falla uno → APV se paga al <strong>50%</strong> (contrato base).</div>
              {([['vida', 'Póliza Vida', 'Vida Empresarial, Vida Mujer, Seguro Temporal u otro producto Vida'], ['gi', 'Póliza Generales', 'Auto, Hogar u otro producto GI'], ['salud', 'Póliza Salud XS', 'Protección Light / Oncológico']] as const).map(([k, t, sub], i) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, marginBottom: i < 2 ? 6 : 0, cursor: 'pointer', padding: 5, borderRadius: 6, background: 'white' }}>
                  <input type="checkbox" checked={s.kpi[k]} onChange={(e) => setS((p) => ({ ...p, kpi: { ...p.kpi, [k]: e.target.checked } }))} style={{ accentColor: '#BA7517', width: 14, height: 14 }} />
                  <div><div style={{ fontWeight: 500 }}>{t}</div><div style={{ fontSize: 10, color: 'var(--g400)' }}>{sub}</div></div>
                </label>
              ))}
            </div>

            {/* 9 · Tramo 5 */}
            <div className="stitle" style={{ color: '#5B36AB' }}>Tramo 5 — Requisitos (AE &gt; 200)</div>
            <div style={{ background: 'white', border: '1.5px solid #5B36AB', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#5B36AB', marginBottom: 6 }}>Cumple al menos 1 de 5 + persistencia ≥ 85%</div>
              {([['r1', 'Prima Básica ≥ UF 55'], ['r2', 'Capital fallecimiento ≥ UF 6.000'], ['r3', 'APE emitido ≥ UF 300'], ['r4', '4 pólizas vida (o 3)'], ['r5', '3 pólizas vida + 3 generales']] as const).map(([k, lbl]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, marginBottom: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={s.t5[k]} onChange={(e) => setS((p) => ({ ...p, t5: { ...p.t5, [k]: e.target.checked } }))} style={{ accentColor: '#5B36AB' }} /> {lbl}
                </label>
              ))}
            </div>

            {/* 10 · Bonos adicionales */}
            <div className="stitle">Bonos adicionales</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <div style={{ background: 'white', border: '1px solid var(--g200)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 12, fontWeight: 500 }}>🏅 Bono Top 20 APE</div><div style={{ fontSize: 10, color: 'var(--g400)' }}>Premio UF 1-23 según ranking</div></div>
                  <input type="checkbox" checked={s.bonos.top20ape} onChange={(e) => setS((p) => ({ ...p, bonos: { ...p.bonos, top20ape: e.target.checked } }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </div>
                {s.bonos.top20ape && (
                  <div style={{ marginTop: 8 }}>
                    <div className="flbl">Posición: <span>#{s.rankApe} — {TOP20_APE_UF[s.rankApe - 1]} UF</span></div>
                    <input type="range" min={1} max={20} value={s.rankApe} onChange={(e) => upd({ rankApe: +e.target.value })} />
                  </div>
                )}
              </div>
              <div style={{ background: 'white', border: '1px solid var(--g200)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 12, fontWeight: 500 }}>📈 Bono Top 20 Crecim.</div><div style={{ fontSize: 10, color: 'var(--g400)' }}>Premio UF 1-11 según ranking</div></div>
                  <input type="checkbox" checked={s.bonos.top20cv} onChange={(e) => setS((p) => ({ ...p, bonos: { ...p.bonos, top20cv: e.target.checked } }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </div>
                {s.bonos.top20cv && (
                  <div style={{ marginTop: 8 }}>
                    <div className="flbl">Posición: <span>#{s.rankCv} — {TOP20_CV_UF[s.rankCv - 1]} UF</span></div>
                    <input type="range" min={1} max={20} value={s.rankCv} onChange={(e) => upd({ rankCv: +e.target.value })} />
                  </div>
                )}
              </div>
              <div style={{ background: 'white', border: '1px solid var(--g200)', borderRadius: 'var(--r)', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ fontSize: 12, fontWeight: 500 }}>💼 Gratificación legal</div><div style={{ fontSize: 10, color: 'var(--g400)' }}>Art. 50 CT · 25% IMM mensual</div></div>
                <input type="checkbox" checked={s.bonos.grati} onChange={(e) => setS((p) => ({ ...p, bonos: { ...p.bonos, grati: e.target.checked } }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </div>
            </div>

            {/* 11 · Métodos de prospección */}
            <div className="stitle">Prospectos Referidos por Contactos / Nodos Referidores</div>
            <div className="ib am" style={{ fontSize: 11 }}><strong>Define el % de prospectos por método</strong> (pasos de 5%). Meta: ≥80% Contactos/Nodos Referidores.</div>
            {renderMetodos()}
          </div>

          {/* ── Panel derecho (resultados) — shells Sección 1; contenido Sección 3 ── */}
          <div className="right">
            {/* alert-box: en Sección 3 va arriba el aviso de meta (ib gn/rd, calculado). Aquí solo el botón. */}
            <div id="alert-box" style={{ marginBottom: 12 }}>
              {Math.abs(diff) < 30000
                ? <div className="ib gn" style={{ textAlign: 'center' }}><strong>Meta prácticamente alcanzada.</strong> Ingreso: {fmtCLP(total)} · Asesor: {s.asesor}</div>
                : diff >= 0
                  ? <div className="ib gn" style={{ textAlign: 'center' }}><strong>Meta alcanzable.</strong> Ingreso: {fmtCLP(total)} · Excedente: {fmtCLP(diff)}</div>
                  : <div className="ib rd" style={{ textAlign: 'center' }}><strong>Meta no alcanzada.</strong> Ingreso: {fmtCLP(total)} · Brecha: {fmtCLP(Math.abs(diff))}.</div>}
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                {/* Guardado DESCONECTADO (stub inerte) — la escritura va por API en Fase 3. */}
                <button className="btn btn-success" onClick={() => { /* no-op: guardado de metas va por API en Fase 3 */ }}>💾 Guardar metas de {s.asesor} en Tracker</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <button className="btn btn-primary report-btn" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="white" strokeWidth="1.3" fill="none" strokeLinejoin="round" /><path d="M10 2v3h3M5 7h6M5 9.5h6M5 12h4" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></svg>
                Generar informe PDF — <span style={{ fontStyle: 'italic' }}>{s.asesor}</span>
              </button>
            </div>
            {/* C2: 3 tarjetas de resultados (#metric-row). Valores calculados → placeholder; Sección 3 los conecta.
                Tarjeta 3 = base `smc ok` (azul/énfasis); el rojo `ng` lo añade el cálculo en Sección 3. */}
            <div className="mcrow">
              <div className="smc"><div className="smc-lbl">Sueldo base</div><div className="smc-val">{fmtCLP(SUELDO_BASE_DEFAULT)}</div><div className="smc-sub">Mín. legal $539.000</div></div>
              <div className="smc"><div className="smc-lbl">Bono producción AE</div><div className="smc-val">{fmtCLP(bonoNeto)}</div><div className="smc-sub">{zTotal.toFixed(1)}AE → {fmtUF(bUF)} × {Math.round(fp * 100)}% {zTotal > 200 ? (t5Hab ? <span style={{ color: 'var(--teal)', fontSize: '10px' }}>✓ T5</span> : <span style={{ color: 'var(--red)', fontSize: '10px' }}>✗ T5</span>) : ''}</div></div>
              <div className={`smc ${mc} ok`}><div className="smc-lbl">* Ingreso Bruto Aproximado Total</div><div className="smc-val">{fmtCLP(total)}</div><div className="smc-sub">UF: {fmtCLP(ufVal)} · AE VI+GI: {zTotal.toFixed(1)}</div></div>
            </div>
            <div style={{ fontSize: 11, color: '#185FA5', lineHeight: 1.6, marginBottom: 12, padding: '9px 12px', background: '#E6F1FB', borderLeft: '3px solid #185FA5', borderRadius: '0 6px 6px 0' }}>ℹ️ * Cifra referencial. Valores aproximados. Es posible que haya diferencias con los valores reales. El objetivo del &quot;Ingreso Bruto Aproximado Total&quot; es servir solo de referencia general para el cálculo de las metas de prospección.</div>
            {/* C3: tarjeta "Contactos necesarios para tu meta" (#metric-contacts). Números calculados → "0" placeholder; Sección 3 los conecta. */}
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
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 42, fontWeight: 800, lineHeight: 1, color: '#3a4f00', letterSpacing: '-0.03em' }}>{totContactos}</div>
                    <div style={{ fontSize: 10, color: 'var(--g600)', marginTop: 4, letterSpacing: '.03em', fontWeight: 500 }}>por mes</div>
                  </div>
                  <div style={{ background: 'white', border: '1.5px solid var(--lime-dk)', borderRadius: 'var(--r)', padding: '8px 14px', textAlign: 'center', minWidth: 122, boxShadow: '0 1px 2px rgba(168,204,26,.08)' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 600, lineHeight: 1, color: 'var(--g900)', letterSpacing: '-0.03em' }}>{Math.ceil(totContactos / 4)}</div>
                    <div style={{ fontSize: 10, color: 'var(--g600)', marginTop: 4, letterSpacing: '.03em', fontWeight: 500 }}>esta semana</div>
                  </div>
                </div>
                <div title="Activar plan" style={{ position: 'absolute', bottom: -14, right: -14, width: 56, height: 56, borderRadius: '50%', background: 'var(--lime)', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 6px 16px rgba(168,204,26,.36),0 1px 3px rgba(0,0,0,.08)', lineHeight: 1, cursor: 'pointer' }}>🚀</div>
              </div>
            </div>
            <div className="card"><div className="card-title">Prospectos Referidos por Contactos / Nodos</div>
              <div id="funnel-content">
                {(() => {
                  const P = s.pcts || {}
                  const tot = Object.values(P).reduce((a, b) => a + (+b || 0), 0)
                  if (tot === 0 || ventas === 0) {
                    return <div className="ib am">Asigna porcentajes a al menos un método y define el mix de productos.</div>
                  }
                  const totC = totContactos
                  const totP = totProspectos
                  const cSem = totC > 0 ? Math.ceil(totC / 4) : 0
                  const maxP = Math.max(totP, 1)
                  const totP_nodo = activos.filter(m => m.esNodo).reduce((a, m) => a + m.prospectos, 0)
                  const totP_frio = totP - totP_nodo
                  const meta = (id: string): Metodo => SIM_METODOS.find(m => m.id === id) || ({} as Metodo)
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
                  const nodoAct = activos.filter(m => m.esNodo)
                  const sinAct = activos.filter(m => !m.esNodo)
                  const row = (m: (typeof activos)[number], key: string) => {
                    const info = meta(m.id)
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
            <div className={`card card-collapsible${open.mix ? ' open' : ''}`}>
              <div className="card-title" onClick={() => toggle('mix')}>Desglose del mix de productos — Contrato original <span className="coll-arrow">▾</span></div>
              <div className="card-body" style={{ textAlign: 'left' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr>
                    <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g400)', padding: '7px 9px', borderBottom: '1px solid var(--g200)' }}>Producto</th>
                    <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g400)', padding: '7px 9px', borderBottom: '1px solid var(--g200)' }}>Cant.</th>
                    <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g400)', padding: '7px 9px', borderBottom: '1px solid var(--g200)' }}>%</th>
                    <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g400)', padding: '7px 9px', borderBottom: '1px solid var(--g200)' }}>PPA UF</th>
                    <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g400)', padding: '7px 9px', borderBottom: '1px solid var(--g200)' }}>AE</th>
                    <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g400)', padding: '7px 9px', borderBottom: '1px solid var(--g200)' }}>Nota</th>
                  </tr></thead>
                  <tbody>
                    {det.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--g400)', padding: 12 }}>Agrega pólizas al mix.</td></tr>
                    ) : det.map((d, i) => {
                      const tdS = { padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }
                      const isCamp = d.nota && d.nota.includes('campaña')
                      return (
                        <tr key={i}>
                          <td style={tdS}>{d.p.n}</td>
                          <td style={tdS}>{d.qty}</td>
                          <td style={tdS}>{(d.zTotal && d.ppaUF ? d.zTotal / d.ppaUF * 100 : 0).toFixed(0)}%</td>
                          <td style={tdS}>{d.ppaUF.toFixed(2)}</td>
                          <td style={tdS}>{d.zTotal.toFixed(1)}</td>
                          <td style={tdS}>{d.nota ? <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, ...(isCamp ? { background: 'var(--teal-lt)', color: 'var(--teal)' } : { background: 'var(--amber-lt)', color: 'var(--amber)' }) }}>{d.nota}</span> : null}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 600, color: 'var(--g900)', borderTop: '1px solid var(--g300)', background: 'var(--g50)' }}>
                      <td style={{ padding: '9px 9px' }}>Total VI</td>
                      <td style={{ padding: '9px 9px' }}>{ventas}</td>
                      <td style={{ padding: '9px 9px' }}>—</td>
                      <td style={{ padding: '9px 9px' }}>—</td>
                      <td style={{ padding: '9px 9px' }}>{zVI.toFixed(1)} AE</td>
                      <td style={{ padding: '9px 9px' }} />
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ fontSize: 11, color: 'var(--g400)', padding: '8px 9px' }}>+ AE GI: {zGI.toFixed(1)} {zGITopado ? '(topado)' : ''} → AE Total: <strong>{zTotal.toFixed(1)}</strong></td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className={`card card-collapsible${open.tramos ? ' open' : ''}`}>
              <div className="card-title" onClick={() => toggle('tramos')}>Transformación AE Puntos → Bono UF <span className="coll-arrow">▾</span></div>
              <div className="card-body">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr>
                    {['Tramo', 'AE', '%', 'UF', '$'].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g400)', padding: '7px 9px', borderBottom: '1px solid var(--g200)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {trDet.map((t, i) => {
                      const a = t.ap > 0
                      const tdS = { padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: a ? 'var(--g700)' : 'var(--g400)' }
                      return (
                        <tr key={i}>
                          <td style={tdS}>{t.lbl}</td>
                          <td style={tdS}>{a ? t.ap.toFixed(1) : '—'}</td>
                          <td style={tdS}>{Math.round(t.pct * 100)}%</td>
                          <td style={tdS}>{a ? t.uf.toFixed(2) : '—'}</td>
                          <td style={tdS}>{a ? fmtCLP(t.uf * ufVal) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 600, color: 'var(--g900)', borderTop: '1px solid var(--g300)', background: 'var(--g50)' }}>
                      <td colSpan={3} style={{ padding: '9px 9px' }}>Bono bruto</td>
                      <td style={{ padding: '9px 9px' }}>{bUF.toFixed(2)} UF</td>
                      <td style={{ padding: '9px 9px' }}>{fmtCLP(bUF * ufVal)}</td>
                    </tr>
                    <tr style={{ fontWeight: 600, color: 'var(--g900)', background: 'var(--g50)' }}>
                      <td colSpan={3} style={{ padding: '9px 9px' }}>× Persistencia ({Math.round(fp * 100)}%)</td>
                      <td style={{ padding: '9px 9px' }}>{(bUF * fp).toFixed(2)} UF</td>
                      <td style={{ padding: '9px 9px' }}><strong>{fmtCLP(bonoNeto)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className={`card card-collapsible${open.consol ? ' open' : ''}`} style={{ marginTop: 14 }}>
              <div className="card-title" onClick={() => toggle('consol')}>🧾 Consolidado mensual completo <span className="coll-arrow">▾</span></div>
              <div className="card-body">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}>Sueldo base</td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}>Fijo mensual</td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}><strong>{fmtCLP(SUELDO_BASE_DEFAULT)}</strong></td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}>Bono producción AE</td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}>{zVI.toFixed(1)} VI + {zGI.toFixed(1)} GI = {zTotal.toFixed(1)} AE</td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}><strong>{fmtCLP(bonoNeto)}</strong></td>
                    </tr>
                    {bonoApe > 0 && (
                      <tr>
                        <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}>Bono Top 20 APE</td>
                        <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}>Ranking #{s.rankApe}</td>
                        <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}><strong>{fmtCLP(bonoApe)}</strong></td>
                      </tr>
                    )}
                    {bonoCv > 0 && (
                      <tr>
                        <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}>Bono Top 20 Crecim.</td>
                        <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}>Ranking #{s.rankCv}</td>
                        <td style={{ padding: '8px 9px', borderBottom: '1px solid var(--g100)', color: 'var(--g700)' }}><strong>{fmtCLP(bonoCv)}</strong></td>
                      </tr>
                    )}
                    <tr style={{ background: 'var(--teal-lt)' }}>
                      <td colSpan={2} style={{ padding: '9px 9px' }}><strong>INGRESO BRUTO MENSUAL ESTIMADO</strong></td>
                      <td style={{ padding: '9px 9px' }}><strong style={{ color: 'var(--teal)', fontSize: 14 }}>{fmtCLP(total)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="disclaimer" style={{ fontSize: 11, color: 'var(--g400)', borderTop: '1px solid var(--g200)', paddingTop: 12, marginTop: 4, lineHeight: 1.6 }}>
              * Esta simulación es una <strong style={{ color: 'var(--g600)' }}>referencia de gestión</strong>, no una liquidación exacta. Su propósito es estimar el número de contactos y volumen de producción necesarios para alcanzar una meta de ingresos. El resultado real dependerá del mix definitivo de productos, primas cobradas y persistencia mensual. UF = ${Math.round(ufVal).toLocaleString('es-CL')} · Sueldo mínimo $539.000 (Ley 21.751) · Tope T5: {tope_t5 === null ? 'sin tope' : tope_t5 + ' AE'} (mes {ant}).
            </p>
            <div className="copyright" style={{ marginTop: 24 }}>
              <span style={{ color: 'var(--g400)' }}>© 2026 The Precision Selling · Todos los derechos reservados</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
