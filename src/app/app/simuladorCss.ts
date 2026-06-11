// Bloque CSS común a los 2 simuladores (Zurich + Consorcio) — Nivel B / C2.2.
// 116 líneas byte-idénticas (verificado: simulador 20-135 == simulador-consorcio 22-137).
// Incluye ${FUNNEL_CSS} en su cola; ninguna regla se edita (movimiento puro).
import { FUNNEL_CSS } from './funnelCss'

export const SIM_COMMON_CSS = `/* Simulador layout */
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

${FUNNEL_CSS}`
