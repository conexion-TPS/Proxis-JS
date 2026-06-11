'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import MiInforme, { type Informe } from '@/components/MiInforme' // render compartido de Mi Informe (T3b)
import { useAuth } from '../AuthProvider'

/*
 * Tracker de Prospección — tenant CONSORCIO, vista SUPERVISOR. Calco del legacy
 * plataforma-core.js (módulo 'tracker', rama supervisor: buildTrackerTabs:302-307,
 * switchTrackerTab:325-337). App-shell réplica de simulador-consorcio.
 * T1: scaffold + tabs (Equipo completo / Desempeño individual). Ingresos mensuales eliminado por decisión de producto.
 * con los 3 paneles como SHELLS VACÍOS. Su contenido es T2-T4.
 * SIN escrituras. Los stubs inertes guardarMeta/guardarIngreso son T2/T4.
 * NO toca el simulador, Zurich, ni /vina (bitácora del asesor, viva en prod).
 */

// Supervisora Consorcio hardcodeada (mismo patrón que simulador-consorcio).
// Bloqueo de tenant = deuda registrada en DISENO_CONSOLIDACION.md.
const CONSORCIO_SUPERVISORA = 'Valeska Comparini Cruells'

// Bloque <style> propio y autónomo: copia verbatim del de simulador-consorcio
// (app-shell, cards, .smc, .ib, tablas .dt, etc.) + las reglas de TABS del legacy.
const CSS = `
/* ══ TABS (verbatim del legacy plataforma) ══ */
.tabs{display:flex;border-bottom:1px solid var(--g200);background:white;padding:0 24px;overflow-x:auto;gap:2px}
.tab{padding:11px 14px;font-size:13px;font-weight:500;color:var(--g400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:all .15s;letter-spacing:-0.005em}
.tab:hover{color:var(--g700)}
.tab.active{color:#0b0a09;border-bottom-color:#0b0a09;font-weight:600}
.tab-panel{display:none;padding:24px}.tab-panel.active{display:block}

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
.pill-am{background:var(--amber-lt);color:var(--amber)}
.pill-rd{background:var(--red-lt);color:var(--red)}
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

/* ══ FUNNEL ══ (verbatim del legacy plataforma) */
.fstep{display:grid;grid-template-columns:170px 1fr 64px 160px;align-items:center;gap:12px;margin-bottom:10px}
.fstep:last-child{margin-bottom:0}
.fstep-lbl{font-size:12px;font-weight:500;color:var(--g700)}
.fbar-wrap{height:34px;background:var(--g100);border-radius:8px;overflow:hidden;border:1px solid var(--g200)}
.fbar{height:100%;border-radius:7px;display:flex;align-items:center;padding-left:12px;font-size:12px;font-weight:600;transition:width .5s cubic-bezier(.4,0,.2,1);min-width:30px;white-space:nowrap;letter-spacing:-0.005em;font-feature-settings:"tnum"}
.fnum{font-family:var(--font);font-size:19px;font-weight:600;color:var(--g900);text-align:right;letter-spacing:-0.022em;font-feature-settings:"tnum"}
.feq{font-size:11px;color:var(--g400);text-align:right;line-height:1.35}
.bar-c{background:#cfe2f6;color:#0C447C}
.bar-p{background:#b8e5d2;color:#085041}

/* ══ ORIG-CHART ══ (verbatim del legacy plataforma) */
.orig-chart{margin-top:14px;background:white;border:1px solid var(--g200);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow-1)}
.orig-title{font-size:11px;font-weight:600;color:var(--g900);padding:9px 13px;border-bottom:1px solid var(--g200);background:var(--g50);letter-spacing:-0.005em}
.orig-group-lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--teal);display:flex;align-items:center;gap:8px;padding:7px 13px 4px}
.orig-group-lbl:before,.orig-group-lbl:after{content:'';flex:1;border-top:1px solid var(--g200)}
.orig-sin{color:var(--amber)}
.orig-row{display:flex;align-items:center;gap:8px;padding:4px 13px}
.orig-lbl{font-size:10px;color:var(--g600);width:100px;text-align:right;flex-shrink:0;line-height:1.3}
.orig-bar-wrap{flex:1;display:flex;align-items:center;gap:6px}
.orig-bar{height:18px;border-radius:4px;transition:width .4s;display:flex;align-items:center;padding:0 6px;min-width:3px}
.orig-val{font-size:10px;font-weight:600;color:white;white-space:nowrap;letter-spacing:-0.005em;font-feature-settings:"tnum"}
.orig-pct{font-size:10px;color:var(--g400);white-space:nowrap;font-family:var(--mono);font-feature-settings:"tnum"}
.orig-total{border-top:1px solid var(--g200);padding:6px 13px;font-size:10.5px;color:var(--g700);text-align:right;background:var(--g50);font-feature-settings:"tnum"}

/* ══ TABLA CONSOLIDADO (.dt) ══ (verbatim del legacy plataforma; sin ".dt tfoot td", no usado) */
table.dt{width:100%;border-collapse:collapse;font-size:13px}
.dt th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--g400);padding:8px 10px;border-bottom:1px solid var(--g200)}
.dt td{padding:9px 10px;border-bottom:1px solid var(--g100);color:var(--g700)}
.dt tr:last-child td{border-bottom:none}

/* ══ GRID + TOOLTIP ICON (verbatim del legacy plataforma) ══ */
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.ico-info{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:var(--g300);color:var(--g700);font-size:9px;font-weight:700;cursor:default;vertical-align:middle;margin-left:3px;font-style:normal;flex-shrink:0;line-height:1;font-family:var(--font)}
.ico-info:hover{opacity:1}

/* ══ MC TILES + SEMÁFORO (de /informe, para <MiInforme>) ══ */
.mc{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:14px 16px;position:relative;box-shadow:var(--shadow-1)}
.mc.ok{background:var(--teal-lt);border-color:rgba(31,111,86,.22)}
.mc.warn{background:var(--amber-lt);border-color:rgba(168,105,26,.22)}
.mc.bad{background:var(--red-lt);border-color:rgba(176,58,58,.22)}
.mc-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--g400);margin-bottom:6px}
.mc.ok .mc-label{color:var(--teal)}.mc.warn .mc-label{color:var(--amber)}.mc.bad .mc-label{color:var(--red)}
.mc-value{font-size:22px;font-weight:600;font-family:var(--font);color:var(--g900);letter-spacing:-.022em;font-feature-settings:"tnum";line-height:1.15}
.mc.ok .mc-value{color:var(--teal)}.mc.warn .mc-value{color:var(--amber)}.mc.bad .mc-value{color:var(--red)}
.mc-sub{font-size:11px;color:var(--g600);margin-top:4px}
.mc-explain{font-size:11px;color:var(--g600);margin-top:7px;line-height:1.45;font-style:italic;border-top:1px solid rgba(0,0,0,.06);padding-top:6px}
.semaforo{position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 2px white}
.semaforo.ok{background:#22c55e}.semaforo.warn{background:#f59e0b}.semaforo.bad{background:#ef4444}
.pill-bl{background:var(--blue-lt);color:var(--blue)}
.chart-wrap{position:relative;height:220px;margin-top:10px}

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
  .grid4{grid-template-columns:repeat(2,1fr)}
  .grid2{grid-template-columns:1fr}
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

const MESES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const getMesLabel = (m: string) => { const [y, mo] = m.split('-'); return `${MESES_NOM[parseInt(mo) - 1]} ${y}` }
const fmt = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function last6Meses(): string[] { const out: string[] = [], now = new Date(); for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) } return out }

// Tooltips de columna — verbatim del legacy (plataforma-core.js:2166-2176)
const TOOLTIPS: Record<string, string> = {
  'cont-col': 'Contactos totales del período. Cada persona en la bitácora = 1 contacto.',
  'gap-cont-col': 'Gap contactos: real menos meta semanal × 4 semanas. Verde = sobre meta.',
  'prosp-col': 'Prospectos totales: referidos que cada contacto entregó al asesor.',
  'gap-prosp-col': 'Gap prospectos: real vs potencial máximo (contactos × 5).',
  'pc-col': 'Prospectos por Contacto. Meta ideal 5.0. Verde ≥4.5 · Amarillo ≥3.0 · Rojo <3.0.',
  'meta-col': '% cumplimiento meta mensual de prospectos del Simulador.',
  'nodos-col': 'Nodos activos: contactos que refieren más de una vez. El activo más valioso.',
  'ingreso-col': 'Ingreso real del período.',
  'meta-ing-col': 'Meta de ingresos del Simulador para este asesor.',
  'gap-ing-col': 'Gap ingresos: real menos meta. Verde = superó. Rojo = bajo meta.',
  'sr-col': 'Semanas Sin Reporte. Verde=0 · Amarillo=1 · Rojo≥2.',
}

// Selects: el legacy usa la clase .sel-std (no incluida en el diff aprobado) → estilo inline.
const selStyle: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--g200)', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, background: 'white', color: 'var(--g900)', outline: 'none', cursor: 'pointer' }

type Tip = { show: boolean; x: number; y: number; title: string; body: string }
type EquipoFila = { nombre: string; totC: number; gapC: number; totP: number; brecha: number; promG: number; avMes: number; nodos: number; ingrTot: number; metaIng: number; gapIng: number; sinReporte: number }
type EquipoKpi = { lbl: string; val: number | string; sub: string; cls?: string; thermo?: boolean }
type EquipoGap = { lbl: string; val: number | string; sub: string; desc: string }
type EquipoCharts = {
  nodos: { labels: string[]; dAcum: number[]; dNuevos: number[]; dProspNodos: number[]; dProspTotal: number[]; dPct: number[] }
  tendencia: { labels: string[]; trendC: number[]; trendP: number[]; trendPC: number[] }
  ranking: { name: string; val: number; sinDatos: boolean }[]
}
type EquipoDTO = { periodoLabel: string; meta: { meses: number; asesores: number; reportes: number }; kpis: EquipoKpi[]; gaps: EquipoGap[]; filas: EquipoFila[]; indice: number; charts: EquipoCharts }

// Calco de interpretarNodos() con esEquipo=true (plataforma-core.js:620-651). Solo presentación.
function interpretarNodosEquipo(ch: EquipoCharts['nodos']): { color: string; txt: string }[] {
  const { dAcum, dNuevos, dPct, labels } = ch
  if (!dAcum.length) return []
  const ultimo = dAcum[dAcum.length - 1], ultNuevos = dNuevos[dNuevos.length - 1], ultPct = dPct[dPct.length - 1]
  const msgs: { color: string; txt: string }[] = []
  let planos = 0; for (let i = dNuevos.length - 1; i >= 0; i--) { if (dNuevos[i] === 0) planos++; else break }
  if (planos >= 2) msgs.push({ color: '#BA7517', txt: `El equipo lleva ${planos} mes${planos > 1 ? 'es' : ''} sin nuevos nodos — es momento de reactivar contactos anteriores.` })
  else if (ultNuevos >= 2) msgs.push({ color: '#0F6E56', txt: `Mes destacado: ${ultNuevos} nodos nuevos en ${labels[labels.length - 1]}. La red está creciendo activamente.` })
  else if (ultNuevos === 1) msgs.push({ color: '#0F6E56', txt: `Se agregó 1 nodo nuevo este mes. Ritmo constante de profundización.` })
  if (dPct.length >= 2) {
    const diff = ultPct - (dPct[dPct.length - 2] || 0)
    if (diff >= 10) msgs.push({ color: '#0F6E56', txt: `La proporción de prospectos de nodos subió ${diff}% este mes — la red está rindiendo más.` })
    else if (diff <= -10) msgs.push({ color: '#BA7517', txt: `La proporción de prospectos de nodos bajó ${Math.abs(diff)}% — los nodos están menos activos.` })
  }
  if (ultPct >= 40) msgs.push({ color: '#0F6E56', txt: `Más del ${ultPct}% de los prospectos ya vienen de la red de nodos — hábito consolidado.` })
  else if (ultPct >= 20) msgs.push({ color: '#185FA5', txt: `${ultPct}% de los prospectos vienen de nodos. El objetivo es superar el 40%.` })
  else if (ultimo > 0) msgs.push({ color: '#BA7517', txt: `Solo el ${ultPct}% de los prospectos vienen de nodos — la red aún no está rindiendo su potencial.` })
  return msgs
}

// KPI card — calco de kpiCard (plataforma-core.js:1757, inline styles, sin clase). cls='nodos' = variante teal.
function KpiCard({ k }: { k: EquipoKpi }) {
  const bg = k.cls === 'ok' ? 'var(--teal-lt)' : k.cls === 'warn' ? 'var(--amber-lt)' : k.cls === 'bad' ? 'var(--red-lt)' : k.cls === 'nodos' ? 'var(--teal-lt)' : 'var(--g100)'
  const vc = k.cls === 'ok' ? 'var(--teal)' : k.cls === 'warn' ? 'var(--amber)' : k.cls === 'bad' ? 'var(--red)' : k.cls === 'nodos' ? 'var(--teal)' : 'var(--g900)'
  const muted = k.cls === 'nodos' ? 'var(--teal)' : 'var(--g400)'
  return (
    <div style={{ background: bg, borderRadius: 'var(--r)', padding: '13px 15px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: muted, marginBottom: 4 }}>{k.lbl}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: vc, lineHeight: 1.1 }}>{k.val}</div>
      <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>{k.sub}</div>
      {k.thermo && <div style={{ height: 5, background: 'var(--g200)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}><div style={{ height: '100%', width: `${Math.min(parseInt(String(k.val)) || 0, 100)}%`, background: vc, borderRadius: 3 }} /></div>}
    </div>
  )
}
// Gap card — calco de gapCard (plataforma-core.js:1767, inline).
function GapCard({ g }: { g: EquipoGap }) {
  const neg = typeof g.val === 'number' ? g.val < 0 : String(g.val).startsWith('-')
  const vc = neg ? '#A32D2D' : '#0F6E56'
  return (
    <div style={{ background: 'white', border: '1px solid var(--g200)', borderRadius: 'var(--r)', padding: '13px 15px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--g400)', marginBottom: 4 }}>{g.lbl}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: vc, lineHeight: 1.1 }}>{g.val}</div>
      <div style={{ fontSize: 11, color: 'var(--g400)', marginTop: 3 }}>{g.sub}</div>
      <div style={{ fontSize: 10, fontWeight: 500, color: vc, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{g.desc}</div>
    </div>
  )
}

export default function TrackerConsorcioPage() {
  const { token, login: signIn, logout, loadIdentity } = useAuth()
  const [uf, setUf] = useState('…')
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  // Tab activo del Tracker supervisor (calco de buildTrackerTabs/switchTrackerTab). Default: 'equipo'.
  const [tab, setTab] = useState('equipo')
  // Estado del panel "Equipo completo" (T2): DTO de /api/app/equipo + selectores.
  const [eqData, setEqData] = useState<EquipoDTO | null>(null)
  const [eqMes, setEqMes] = useState(mesActual())
  const [eqPeriodos, setEqPeriodos] = useState('1')
  const [eqLoading, setEqLoading] = useState(false)
  const [eqErr, setEqErr] = useState('')
  const [tip, setTip] = useState<Tip>({ show: false, x: 0, y: 0, title: '', body: '' })
  // Estado del panel "Desempeño individual" (T3d): { roster, informe } de /api/app/individual.
  const [indData, setIndData] = useState<{ roster: { persona_id: string; nombre: string }[]; informe: Informe | null } | null>(null)
  const [indAsesor, setIndAsesor] = useState('')
  const [indMes, setIndMes] = useState(mesActual())
  const [indLoading, setIndLoading] = useState(false)
  const [indErr, setIndErr] = useState('')

  useEffect(() => {
    fetch('https://mindicador.cl/api/uf').then((r) => r.json())
      .then((d) => setUf('$' + Math.round(d.serie[0].valor).toLocaleString('es-CL')))
      .catch(() => setUf('—'))
  }, [])

  // Validación de sesión al cargar (calco de cargarIdent): /api/app/me con 401→logout,
  // ahora vía el AuthProvider. El header de esta página no usa la identidad (Consorcio hardcodeado).
  useEffect(() => { if (token) loadIdentity() }, [token, loadIdentity])

  // Carga del panel Equipo completo (solo lectura; el cálculo vive en /api/app/equipo).
  const cargarEquipo = useCallback(async () => {
    if (!token) return
    setEqLoading(true); setEqErr('')
    try {
      const r = await fetch(`/api/app/equipo?mes=${eqMes}&periodos=${eqPeriodos}`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (!r.ok) { setEqErr(d.error ?? 'Error al cargar el equipo'); setEqData(null); return }
      setEqData(d)
    } catch { setEqErr('No se pudo conectar') }
    finally { setEqLoading(false) }
  }, [token, eqMes, eqPeriodos])
  useEffect(() => { if (token && tab === 'equipo') cargarEquipo() }, [token, tab, cargarEquipo])

  // Carga del panel "Desempeño individual" (solo lectura; reutiliza /api/app/individual + <MiInforme>).
  const cargarIndividual = useCallback(async () => {
    if (!token) return
    setIndLoading(true); setIndErr('')
    try {
      const r = await fetch(`/api/app/individual?persona_id=${indAsesor}&mes=${indMes}`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (!r.ok) { setIndErr(d.error ?? 'Error al cargar el asesor'); setIndData(null); return }
      setIndData(d)
    } catch { setIndErr('No se pudo conectar') }
    finally { setIndLoading(false) }
  }, [token, indAsesor, indMes])
  useEffect(() => { if (token && tab === 'individual') cargarIndividual() }, [token, tab, cargarIndividual])

  // ── Gráficos del equipo (T2c) — Chart.js, patrón de /informe; datos ya calculados en charts del DTO ──
  const nodRef = useRef<HTMLCanvasElement>(null)
  const tendRef = useRef<HTMLCanvasElement>(null)
  const rankRef = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartsRef = useRef<any[]>([])
  useEffect(() => {
    chartsRef.current.forEach((c) => c.destroy())
    chartsRef.current = []
    if (tab !== 'equipo' || !eqData) return
    const ch = eqData.charts
    let cancelado = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('chart.js/auto').then((mod: any) => {
      if (cancelado) return
      const Chart = mod.default
      // 1) Nodos del equipo (calco buildNodosChart) — solo si hay meses con nodos
      const n = ch.nodos
      if (n.labels.length > 0 && nodRef.current) {
        chartsRef.current.push(new Chart(nodRef.current, {
          data: { labels: n.labels, datasets: [
            { type: 'bar', label: 'Nuevos nodos', data: n.dNuevos, backgroundColor: n.dNuevos.map((v: number) => v === 0 ? 'rgba(242,91,91,.18)' : 'rgba(15,110,86,.3)'), borderColor: n.dNuevos.map((v: number) => v === 0 ? '#F7C1C1' : '#5DCAA5'), borderWidth: 1, borderRadius: 3, yAxisID: 'y2', order: 3 },
            { type: 'line', label: 'Nodos acumulados', data: n.dAcum, borderColor: '#0F6E56', backgroundColor: 'rgba(15,110,86,.08)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: n.dNuevos.map((v: number) => v === 0 ? '#E24B4A' : '#0F6E56'), pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y', order: 1 },
            { type: 'line', label: 'Prospectos de nodos', data: n.dProspNodos, borderColor: '#185FA5', borderDash: [5, 4], backgroundColor: 'transparent', tension: .3, pointRadius: 3, borderWidth: 2, yAxisID: 'y3', order: 2 },
          ] },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            plugins: { legend: { display: false }, tooltip: { callbacks: { afterBody: (items: any) => { const i = items[0]?.dataIndex; const pct = n.dPct[i]; const nn = n.dNuevos[i]; const lines: string[] = []; if (pct != null) lines.push('% del total: ' + pct + '%'); if (nn === 0) lines.push('⚠ Sin nodo nuevo este mes'); return lines } } } },
            scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { position: 'left', min: 0, title: { display: true, text: 'Acumulados', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { stepSize: 1, font: { size: 10 } } }, y2: { position: 'right', min: 0, max: Math.max(...n.dNuevos) + 1, title: { display: true, text: 'Nuevos', font: { size: 10 } }, grid: { display: false }, ticks: { stepSize: 1, font: { size: 10 } } }, y3: { display: false } } },
        }))
      }
      // 2) Tendencia mensual (calco renderEquipo:2017-2025)
      if (tendRef.current) {
        const t = ch.tendencia
        chartsRef.current.push(new Chart(tendRef.current, {
          data: { labels: t.labels, datasets: [
            { type: 'bar', label: 'Prospectos', data: t.trendP, backgroundColor: '#003781', yAxisID: 'y' },
            { type: 'bar', label: 'Contactos', data: t.trendC, backgroundColor: '#B5D4F4', yAxisID: 'y' },
            { type: 'line', label: 'P/C', data: t.trendPC, borderColor: '#BA7517', backgroundColor: 'transparent', yAxisID: 'y2', pointRadius: 4, borderWidth: 2, tension: .3 },
          ] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { position: 'left', ticks: { font: { size: 10 } } }, y2: { position: 'right', min: 0, max: 6, grid: { display: false }, ticks: { font: { size: 10 } } } } },
        }))
      }
      // 3) Ranking prospectos (calco renderEquipo:2035-2042)
      if (rankRef.current) {
        const r = ch.ranking
        chartsRef.current.push(new Chart(rankRef.current, {
          type: 'bar',
          data: { labels: r.map((d) => d.sinDatos ? d.name + ' —' : d.name), datasets: [{ data: r.map((d) => d.val), backgroundColor: r.map((d) => d.sinDatos ? '#E8E7E2' : d.val >= 30 ? '#0F6E56' : d.val >= 15 ? '#BA7517' : '#A32D2D'), borderRadius: 4 }] },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ctx.raw === 0 ? 'Sin reportes' : ctx.raw + ' prospectos' } } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } } },
        }))
      }
    })
    return () => { cancelado = true; chartsRef.current.forEach((c) => c.destroy()); chartsRef.current = [] }
  }, [tab, eqData])

  // Tooltip flotante (calco de showTooltip/#tooltip-modal; patrón de /informe). Título = clave capitalizada (fiel al legacy).
  function moverTip(k: string, e: React.MouseEvent) {
    const body = TOOLTIPS[k]; if (!body) return
    const title = k.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    setTip({ show: true, title, body, x: Math.min(e.clientX + 12, window.innerWidth - 300), y: Math.max(e.clientY - 60, 10) })
  }
  const ocultarTip = () => setTip((t) => ({ ...t, show: false }))
  const Info = ({ k }: { k: string }) => (
    <span onMouseEnter={(e) => moverTip(k, e)} onMouseMove={(e) => moverTip(k, e)} onMouseLeave={ocultarTip}> <span className="ico-info">i</span></span>
  )
  const pill = (cls: string, txt: React.ReactNode) => <span className={`pill ${cls}`}>{txt}</span>

  async function login() {
    setErr(''); setCargando(true)
    const res = await signIn(email, pass)
    if (!res.ok) setErr(res.error ?? 'Credenciales incorrectas')
    setCargando(false)
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
            {/* Supervisora Consorcio hardcodeada (paralelo a simulador-consorcio). Deuda de tenant en DISENO_CONSOLIDACION.md. */}
            <div className="hrole">{CONSORCIO_SUPERVISORA} · <strong>Supervisora</strong></div>
            <a href="/" className="hinicio">← Inicio</a>
            <button className="hout" onClick={logout}>Salir</button>
          </div>
        </header>

        {/* Module bar — Tracker activo, Simulador inerte (sin handler; mejora futura: link a /app/simulador-consorcio) */}
        <div className="module-bar">
          <div className="mod-btn">📊 Simulador de Metas</div>
          <div className="mod-btn active">📋 Tracker de Prospección</div>
        </div>

        {/* Barra de tabs del supervisor (calco buildTrackerTabs:304); toggle de clase active (calco switchTrackerTab) */}
        <div className="tabs" id="tracker-tabs">
          <div className={`tab${tab === 'equipo' ? ' active' : ''}`} onClick={() => setTab('equipo')}>Equipo completo</div>
          <div className={`tab${tab === 'individual' ? ' active' : ''}`} onClick={() => setTab('individual')}>Desempeño individual</div>
        </div>

        {/* Paneles — los 3 en el DOM, la CSS muestra solo el .active (display:block). Contenido = T2-T4. */}
        <div className={`tab-panel${tab === 'equipo' ? ' active' : ''}`} id="panel-equipo">
          {/* Header + selectores (calco plataforma:572-583) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div><h2 style={{ fontSize: 18, fontWeight: 600 }}>Equipo completo</h2><p style={{ fontSize: 13, color: 'var(--g400)' }}>Consolidado de actividad y gaps del equipo</p></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={eqMes} onChange={(e) => setEqMes(e.target.value)} style={selStyle}>
                {last6Meses().map((m) => <option key={m} value={m}>{getMesLabel(m)}</option>)}
              </select>
              <select value={eqPeriodos} onChange={(e) => setEqPeriodos(e.target.value)} style={selStyle}>
                <option value="1">1 mes</option><option value="2">2 meses</option>
                <option value="3">Trimestre</option><option value="6">Semestre</option><option value="12">Anual</option>
              </select>
            </div>
          </div>

          {eqLoading && <div className="ib bl">⏳ Cargando datos del equipo…</div>}
          {eqErr && <div className="ib rd">{eqErr}</div>}
          {!eqLoading && !eqErr && eqData && (
            <>
              <div className="ib bl" style={{ marginBottom: 4 }}>Período: {eqData.periodoLabel} · {eqData.meta.meses} mes{eqData.meta.meses > 1 ? 'es' : ''} · {eqData.meta.asesores} asesores · {eqData.meta.reportes} reportes cargados</div>

              {/* Fila 1: KPIs (calco renderEquipo:1863-1874) */}
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--g400)', marginBottom: 8 }}>Resultados del período</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 8, marginBottom: 8 }}>
                {eqData.kpis.map((k, i) => <KpiCard key={i} k={k} />)}
              </div>

              {/* Fila 2: gaps (calco renderEquipo:1877-1886) */}
              <div style={{ fontSize: 11, color: 'var(--g700)', lineHeight: 1.6, padding: '8px 12px', background: 'var(--blue-lt)', borderRadius: 'var(--r)', borderLeft: '3px solid var(--blue-mid)', marginBottom: 8 }}>El período de seguimiento define cuánto tiempo abarca el análisis de gaps. Reiniciarlo <strong>trimestralmente</strong> permite comparar entre trimestres y ver si el equipo está cerrando su brecha. <strong>Recomendación:</strong> incentiva que los asesores vuelvan a sus contactos conocidos y los conviertan en nodos activos — un gap que baja trimestre a trimestre indica que la red se está profundizando.</div>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--g400)', marginBottom: 8 }}>Gaps del equipo — meta de supervisión</p>
              <div className="grid4" style={{ marginBottom: 14 }}>
                {eqData.gaps.map((g, i) => <GapCard key={i} g={g} />)}
              </div>

              {/* Tabla (calco renderEquipo:1889-1926) */}
              <div className="card"><div className="card-title">Desempeño individual — {eqData.periodoLabel}</div>
                <div style={{ overflowX: 'auto' }}><table className="dt" style={{ fontSize: 11 }}>
                  <thead><tr>
                    <th>Asesor</th>
                    <th>Cont. <Info k="cont-col" /></th>
                    <th>Gap cont. <Info k="gap-cont-col" /></th>
                    <th>Prosp. <Info k="prosp-col" /></th>
                    <th>Gap prosp. <Info k="gap-prosp-col" /></th>
                    <th>P/C <Info k="pc-col" /></th>
                    <th>% meta <Info k="meta-col" /></th>
                    <th>Nodos ✦ <Info k="nodos-col" /></th>
                    <th>Ingreso <Info k="ingreso-col" /></th>
                    <th>Meta ing. <Info k="meta-ing-col" /></th>
                    <th>Gap ing. <Info k="gap-ing-col" /></th>
                    <th>S/R <Info k="sr-col" /></th>
                  </tr></thead>
                  <tbody>{eqData.filas.map((f, i) => {
                    const nombre = f.nombre.split(' ').slice(0, 2).join(' ')
                    return (
                      <tr key={i}>
                        <td><strong>{nombre}</strong></td>
                        <td>{f.totC}</td>
                        <td>{f.gapC >= 0 ? pill('pill-gn', `+${f.gapC}`) : pill('pill-rd', f.gapC)}</td>
                        <td>{f.totP}</td>
                        <td>{f.brecha <= 0 ? pill('pill-gn', '0') : pill(f.brecha < 20 ? 'pill-am' : 'pill-rd', `−${f.brecha}`)}</td>
                        <td>{f.promG >= 4.5 ? pill('pill-gn', f.promG) : f.promG >= 3 ? pill('pill-am', f.promG) : pill('pill-rd', f.promG)}</td>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ flex: 1, height: 5, background: 'var(--g200)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(f.avMes, 100)}%`, background: f.avMes >= 80 ? '#639922' : f.avMes >= 50 ? '#BA7517' : '#E24B4A', borderRadius: 3 }} /></div><span style={{ fontSize: 10 }}>{f.avMes}%</span></div></td>
                        <td style={{ textAlign: 'center' }}>{f.nodos > 0 ? pill('pill-gn', f.nodos) : <span style={{ color: 'var(--g400)' }}>0</span>}</td>
                        <td style={{ fontSize: 11 }}>{f.ingrTot ? fmt(f.ingrTot) : <span style={{ color: 'var(--g400)' }}>—</span>}</td>
                        <td style={{ fontSize: 11, color: 'var(--g400)' }}>{fmt(f.metaIng)}</td>
                        <td>{f.ingrTot ? (f.gapIng >= 0 ? pill('pill-gn', `+${fmt(f.gapIng)}`) : pill('pill-rd', fmt(f.gapIng))) : <span style={{ color: 'var(--g400)' }}>—</span>}</td>
                        <td>{f.sinReporte === 0 ? pill('pill-gn', '0') : f.sinReporte <= 1 ? pill('pill-am', f.sinReporte) : pill('pill-rd', f.sinReporte)}</td>
                      </tr>
                    )
                  })}</tbody>
                </table></div>
                <div style={{ fontSize: 11, color: 'var(--g700)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--amber-lt)', borderRadius: 'var(--r)', borderLeft: '3px solid var(--amber)', marginTop: 12 }}><strong>Observe la relación entre los gaps:</strong> cuando el gap de contactos y el gap P/C son negativos, el gap de ingreso tiende a ser mayor. Un P/C bajo no se compensa con más contactos — la calidad de la solicitud de referidos es determinante.</div>
              </div>
              {/* Gráficos del equipo (T2c) — calco renderEquipo:1929-1951 */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="card-title">✦ Evolución de Nodos del equipo</div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 6, fontSize: 11, color: 'var(--g400)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 4, background: '#0F6E56', borderRadius: 2, display: 'inline-block' }} />Nodos acumulados</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 0, borderTop: '2px dashed #185FA5', display: 'inline-block' }} />Prospectos de nodos</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'rgba(15,110,86,.3)', borderRadius: 2, display: 'inline-block' }} />Nuevos nodos</span>
                </div>
                <div style={{ position: 'relative', height: 160 }}><canvas ref={nodRef} role="img" aria-label="Nodos del equipo y prospectos" /></div>
                {(() => { const m = interpretarNodosEquipo(eqData.charts.nodos); return m.length > 0 ? (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {m.map((x, i) => <div key={i} style={{ fontSize: 11, lineHeight: 1.5, padding: '7px 10px', borderRadius: 'var(--r)', borderLeft: `3px solid ${x.color}`, background: `${x.color}18`, color: 'var(--g700)' }}>{x.txt}</div>)}
                  </div>
                ) : null })()}
              </div>
              <div className="grid2" style={{ marginTop: 12 }}>
                <div className="card"><div className="card-title">Evolución mensual — contactos y prospectos</div>
                  <div style={{ position: 'relative', height: 180 }}><canvas ref={tendRef} /></div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, background: '#003781', borderRadius: 2 }} /><span style={{ fontSize: 10, color: 'var(--g400)' }}>Prospectos</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, background: '#B5D4F4', borderRadius: 2 }} /><span style={{ fontSize: 10, color: 'var(--g400)' }}>Contactos</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 10, height: 3, background: '#BA7517', borderRadius: 2 }} /><span style={{ fontSize: 10, color: 'var(--g400)' }}>P/C prom.</span></div>
                  </div>
                </div>
                <div className="card"><div className="card-title">Ranking prospectos — período</div>
                  <div style={{ position: 'relative', height: 180 }}><canvas ref={rankRef} /></div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className={`tab-panel${tab === 'individual' ? ' active' : ''}`} id="panel-individual">
          {/* Header + selectores (calco plataforma:587-594) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div><h2 style={{ fontSize: 18, fontWeight: 600 }}>Desempeño individual</h2></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={indAsesor || indData?.roster[0]?.persona_id || ''} onChange={(e) => setIndAsesor(e.target.value)} style={selStyle}>
                {(indData?.roster ?? []).map((a) => <option key={a.persona_id} value={a.persona_id}>{a.nombre}</option>)}
              </select>
              <select value={indMes} onChange={(e) => setIndMes(e.target.value)} style={selStyle}>
                {last6Meses().map((m) => <option key={m} value={m}>{getMesLabel(m)}</option>)}
              </select>
            </div>
          </div>
          {indLoading && <div className="ib bl">⏳ Cargando informe…</div>}
          {indErr && <div className="ib rd">{indErr}</div>}
          {!indLoading && !indErr && indData?.informe && (
            indData.informe.hasReportes
              ? <MiInforme dto={indData.informe} mes={indMes} />
              : <div className="ib am"><strong>{indData.informe.identidad?.nombre}</strong> no tiene reportes en {getMesLabel(indMes)}.</div>
          )}
        </div>
      </div>

      {/* Tooltip flotante (calco de #tooltip-modal; patrón de /informe) */}
      <div style={{ display: tip.show ? 'block' : 'none', position: 'fixed', zIndex: 900, pointerEvents: 'none', left: tip.x, top: tip.y }}>
        <div style={{ background: 'var(--g900)', color: 'white', borderRadius: 10, padding: '10px 14px', maxWidth: 280, fontSize: 12, lineHeight: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tip.title}</div>
          <div>{tip.body}</div>
        </div>
      </div>
    </>
  )
}
