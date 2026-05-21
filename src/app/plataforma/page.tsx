'use client'
import { useEffect } from 'react'

export default function PlataformaPage() {
  useEffect(() => {
    if ((window as any).__plataformaLoaded) return
    ;(window as any).__plataformaLoaded = true

    function loadScript(src: string, onload?: () => void) {
      const s = document.createElement('script')
      s.src = src
      if (onload) s.onload = onload
      document.body.appendChild(s)
    }

    import('chart.js/auto').then(mod => {
      ;(window as any).Chart = mod.default
      const v = Date.now()
      // v= cache-buster: forces fresh load of public JS files on every page load
      loadScript('/plataforma-core.js?v='+v, () =>
        loadScript('/compensacion/compania-z/datos.js?v='+v, () =>
          loadScript('/compensacion/compania-z/perfil.js?v='+v, () =>
            loadScript('/compensacion/compania-z/nodos.js?v='+v, () =>
              loadScript('/compensacion/compania-z/renta.js?v='+v)
            )
          )
        )
      )
    })
  }, [])

  return (
    <>
      <style>{`
/* ══ TOKENS ══ */
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
  --shadow-2:0 1px 3px rgba(20,18,12,0.05),0 6px 16px rgba(20,18,12,0.04);
  --shadow-3:0 24px 64px rgba(0,0,0,0.22),0 4px 12px rgba(0,0,0,0.08);
  --ring:0 0 0 3px rgba(11,10,9,0.08);
  --ring-lime:0 0 0 3px rgba(203,241,53,0.22);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--g100);color:var(--g900);font-size:13.5px;line-height:1.55;min-height:100vh;-webkit-font-smoothing:antialiased;letter-spacing:-0.005em}

/* ══ LOGIN ══ */
#screen-login{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0a09;padding:24px;background-image:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(203,241,53,0.08),transparent 60%),radial-gradient(circle at 15% 85%,rgba(203,241,53,0.05),transparent 45%);position:relative}
#screen-login::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:24px 24px;pointer-events:none}
.lcard{background:white;border-radius:var(--rx);padding:40px 36px;width:100%;max-width:420px;box-shadow:var(--shadow-3);position:relative;z-index:1}
.llogo-wrap{display:flex;align-items:center;gap:12px;background:#0b0a09;border-radius:10px;padding:11px 14px;margin-bottom:24px}
.llogo-img{width:110px;height:auto}
.llogo-text{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#cbf135;line-height:1.5}
.ltitle{font-size:22px;font-weight:700;color:#0b0a09;margin-bottom:5px;letter-spacing:-0.028em;line-height:1.2}
.lsub{font-size:13px;color:var(--g600);margin-bottom:24px;line-height:1.5}
.lfield{margin-bottom:14px}
.lfield label{display:block;font-size:11px;font-weight:600;color:var(--g700);margin-bottom:7px;text-transform:uppercase;letter-spacing:0.07em}
.lfield select,.lfield input{width:100%;padding:11px 14px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:14px;color:var(--g900);background:white;outline:none;transition:all .18s;appearance:none;-webkit-appearance:none}
.lfield select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239E9D97' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}
.lfield input[type=password]{letter-spacing:.1em}
.lfield select:focus,.lfield input:focus{border-color:var(--blue);box-shadow:var(--ring)}
.lfooter{font-size:11px;color:var(--g400);text-align:center;margin-top:18px}

/* ══ BUTTONS ══ */
.btn{padding:10px 18px;border:none;border-radius:var(--r);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;display:inline-flex;align-items:center;gap:7px;letter-spacing:-0.005em}
.btn-primary{background:#0b0a09;color:white;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
.btn-primary:hover{background:#2a2926;transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,0.14)}
.btn-secondary{background:white;color:var(--g700);border:1px solid var(--g200)}
.btn-secondary:hover{border-color:var(--g700);color:var(--g900);background:var(--g50)}
.btn-success{background:var(--teal);color:white;border:1px solid var(--teal)}
.btn-success:hover{background:#175743}
.btn-full{width:100%;justify-content:center;margin-top:14px;padding:13px}
.btn:disabled{opacity:.5;cursor:not-allowed}

/* ══ MESSAGES ══ */
.msg{padding:10px 12px;border-radius:var(--r);font-size:12px;margin-top:10px;display:none;border:1px solid transparent}
.msg.rd{background:var(--red-lt);color:var(--red);border-color:rgba(176,58,58,0.18)}
.msg.gn{background:var(--teal-lt);color:var(--teal);border-color:rgba(31,111,86,0.18)}
.msg.am{background:var(--amber-lt);color:#7a4d0a;border-color:rgba(168,105,26,0.18)}
.msg.bl{background:var(--blue-lt);color:var(--blue);border-color:rgba(11,10,9,0.08)}

/* ══ APP SHELL ══ */
#screen-app{display:none;min-height:100vh}
.header{background:#0b0a09;color:white;padding:11px 24px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:100;border-bottom:1px solid rgba(255,255,255,0.05);box-shadow:0 1px 0 0 var(--lime-dk),0 4px 14px rgba(0,0,0,0.06)}
.hlogo-wrap{display:flex;align-items:center;background:transparent;border-radius:8px;padding:0;margin:0;flex-shrink:0}
.hlogo-img{width:72px;height:auto}
.hdiv{width:1px;height:22px;background:rgba(255,255,255,.14);flex-shrink:0}
.hlogo-text{font-size:11px;font-weight:600;color:white;line-height:1.3}
.hlogo-text span{display:block;font-size:9.5px;font-weight:400;opacity:.55;letter-spacing:.1em;text-transform:uppercase;margin-top:1px}
.huf{font-size:11px;opacity:.7;display:inline-flex;align-items:center;gap:5px}
#uf-display{font-family:var(--mono);font-size:11px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:3px 10px;margin-left:2px;color:white;font-feature-settings:"tnum"}
.hrole{font-size:12px;opacity:.7}.hrole strong{font-weight:600;opacity:1}
.hml{margin-left:auto;display:flex;align-items:center;gap:10px}
.hout{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:white;font-family:var(--font);font-size:12px;font-weight:500;padding:6px 14px;border-radius:20px;cursor:pointer;transition:all .15s}
.hout:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.24)}

/* ══ MODULE BAR ══ */
.module-bar{background:white;border-bottom:1px solid var(--g200);padding:0 24px;display:flex;gap:0;overflow-x:auto}
.mod-btn{padding:14px 18px;font-size:13px;font-weight:600;color:var(--g400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:all .18s;display:flex;align-items:center;gap:7px;letter-spacing:-0.005em}
.mod-btn:hover{color:var(--g700)}
.mod-btn.active{color:#0b0a09;border-bottom-color:#0b0a09}
.module{display:none}.module.active{display:block}

/* ══ SIMULATOR LAYOUT ══ */
.two-col{display:grid;grid-template-columns:380px 1fr;min-height:calc(100vh - 120px)}
.left{background:#fafaf7;border-right:1px solid var(--g200);padding:24px 22px;overflow-y:auto;max-height:calc(100vh - 120px);position:sticky;top:120px}
.right{padding:26px 30px;max-width:1240px}

/* ══ TRACKER TABS ══ */
.tabs{display:flex;border-bottom:1px solid var(--g200);background:white;padding:0 24px;overflow-x:auto;gap:2px}
.tab{padding:11px 14px;font-size:13px;font-weight:500;color:var(--g400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:all .15s;letter-spacing:-0.005em}
.tab:hover{color:var(--g700)}
.tab.active{color:#0b0a09;border-bottom-color:#0b0a09;font-weight:600}
.tab-panel{display:none;padding:24px}.tab-panel.active{display:block}

/* ══ FORM ELEMENTS ══ */
.stitle{font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--g600);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--g200);margin-top:22px}
.stitle:first-child{margin-top:0}
.fg{margin-bottom:13px}
.flbl{font-size:12px;font-weight:500;color:var(--g700);display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
.flbl span{font-family:var(--mono);font-size:11.5px;font-weight:500;color:#0b0a09;background:white;padding:3px 8px;border-radius:6px;border:1px solid var(--g200);box-shadow:var(--shadow-1);font-feature-settings:"tnum"}
input[type=range]{width:100%;height:4px;-webkit-appearance:none;appearance:none;background:var(--g200);border-radius:2px;outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#0b0a09;border:2px solid white;box-shadow:0 0 0 1px var(--g300),0 1px 4px rgba(0,0,0,0.14);cursor:pointer;transition:transform .15s}
input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.1)}
input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#0b0a09;border:2px solid white;box-shadow:0 0 0 1px var(--g300),0 1px 4px rgba(0,0,0,0.14);cursor:pointer}
select.fsel{width:100%;padding:9px 12px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:13px;color:var(--g900);background:white;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239E9D97' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer;transition:all .15s}
select.fsel:focus{border-color:var(--blue);box-shadow:var(--ring)}
.sel-std{padding:8px 12px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:13px;color:var(--g900);background:white;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239E9D97' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer;min-width:180px;transition:all .15s}
.sel-std:focus{border-color:var(--blue);box-shadow:var(--ring)}
.inp-num{width:100px;padding:7px 10px;border:1px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center;outline:none;transition:all .15s;background:white;font-feature-settings:"tnum"}
.inp-num:focus{border-color:var(--blue);box-shadow:var(--ring)}

/* ══ CARDS ══ */
.card{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:20px 22px;margin-bottom:14px;box-shadow:var(--shadow-1)}
.card-title{font-size:13px;font-weight:600;color:var(--g900);margin-bottom:16px;display:flex;align-items:center;gap:10px;letter-spacing:-0.005em}
.card-title::before{content:'';display:block;width:3px;height:14px;background:var(--lime-dk);border-radius:2px;flex-shrink:0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.mcrow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}

/* ══ METRIC CARDS (tracker) ══ */
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

/* ══ METRIC CARDS (simulator) ══ */
.smc{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:14px 16px;box-shadow:var(--shadow-1);text-align:center}
.smc.ok{background:linear-gradient(180deg,#edf4fb 0%,#d9ecf8 100%);border:1.5px solid #185FA5}
.smc.ok .smc-lbl{color:#185FA5}.smc.ok .smc-val{color:#0C447C;font-size:27px}.smc.ok .smc-sub{color:#185FA5;opacity:.85}
.smc.ng{border-color:var(--red);border-width:1.5px}
.card-collapsible .card-title{cursor:pointer;display:flex;align-items:center;user-select:none;margin-bottom:0;padding:2px 0;transition:color .15s}
.card-collapsible .card-title:hover{color:#0b0a09}
.card-collapsible.open .card-title{margin-bottom:16px}
.card-collapsible .card-body{display:none}
.card-collapsible.open .card-body{display:block;animation:cardOpen .22s ease}
@keyframes cardOpen{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.coll-arrow{font-size:12px;color:var(--g400);transition:transform .22s;margin-left:auto;font-weight:400}
.card-collapsible.open .coll-arrow{transform:rotate(180deg)}
.smc-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--g400);margin-bottom:6px}
.smc-val{font-size:20px;font-weight:600;color:var(--g900);font-family:var(--font);letter-spacing:-.022em;font-feature-settings:"tnum";line-height:1.15}
.smc-sub{font-size:11px;color:var(--g600);margin-top:3px}
.smc.ng .smc-val{color:var(--red)}

/* ══ INFO BOXES ══ */
.ib{padding:10px 13px;border-radius:var(--r);font-size:12px;line-height:1.55;margin-bottom:12px;border:1px solid transparent}
.ib.am{background:var(--amber-lt);color:#7a4d0a;border-color:rgba(168,105,26,0.18)}
.ib.bl{background:var(--blue-lt);color:var(--blue);border-color:rgba(11,10,9,0.08)}
.ib.rd{background:var(--red-lt);color:var(--red);border-color:rgba(176,58,58,0.18)}
.ib.gn{background:var(--teal-lt);color:var(--teal);border-color:rgba(31,111,86,0.18)}
.ib strong{font-weight:600}

/* ══ TOGGLE ══ */
.toggle-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:6px 0}
.toggle-lbl{font-size:12px;color:var(--g700);flex:1;line-height:1.5}
.toggle-sw{position:relative;width:38px;height:22px;cursor:pointer;flex-shrink:0}
.toggle-sw input{opacity:0;width:0;height:0}
.toggle-sl{position:absolute;inset:0;background:var(--g300);border-radius:11px;transition:.25s}
.toggle-sl::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:white;border-radius:50%;transition:.25s;box-shadow:0 1px 3px rgba(0,0,0,0.18)}
.toggle-sw input:checked+.toggle-sl{background:#0b0a09}
.toggle-sw input:checked+.toggle-sl::before{transform:translateX(16px)}

/* ══ METODOS (text) ══ */
.metodo-name{font-size:12px;font-weight:600;color:var(--g900);margin-bottom:1px}
.metodo-sub{font-size:11px;color:var(--g400);line-height:1.4}
.metodo-tag{font-size:10px;font-family:var(--mono);background:var(--teal-lt);color:var(--teal);padding:2px 7px;border-radius:5px;margin-top:3px;display:inline-block;font-feature-settings:"tnum"}
.mpct-wrap{display:flex;align-items:center;gap:2px;justify-content:flex-end;flex-shrink:0;background:var(--g100);padding:2px;border-radius:7px;border:1px solid var(--g200)}
.mpct-wrap button{width:22px;height:22px;border-radius:5px;border:none;background:transparent;font-size:13px;cursor:pointer;color:var(--g700);display:flex;align-items:center;justify-content:center;transition:all .12s;line-height:1;font-family:var(--mono);font-weight:600}
.mpct-wrap button:hover{background:white;color:#0b0a09;box-shadow:var(--shadow-1)}
.mpct-num{font-family:var(--mono);font-size:13px;font-weight:600;color:#0b0a09;min-width:36px;text-align:center;font-feature-settings:"tnum"}

/* ══ MIX ROWS ══ */
.mix-row{display:grid;grid-template-columns:1fr 96px;gap:8px;align-items:center;background:white;border-radius:var(--r);padding:9px 12px;border:1px solid var(--g200);margin-bottom:5px;transition:all .15s}
.mix-row.active{border-color:var(--g700);background:var(--g50)}
.mix-name{font-size:12px;font-weight:600;color:var(--g900)}
.mix-sub{font-size:11px;color:var(--g400);margin-top:1px}
.mix-qty{display:flex;align-items:center;gap:2px;justify-content:flex-end;background:var(--g100);padding:2px;border-radius:7px;border:1px solid var(--g200)}
.mix-qty button{width:24px;height:24px;border-radius:5px;border:none;background:transparent;font-size:14px;cursor:pointer;color:var(--g700);display:flex;align-items:center;justify-content:center;transition:all .12s;line-height:1;font-weight:600}
.mix-qty button:hover{background:white;color:#0b0a09;box-shadow:var(--shadow-1)}
.mix-qty-n{font-family:var(--mono);font-size:13px;font-weight:600;color:#0b0a09;min-width:24px;text-align:center;font-feature-settings:"tnum"}

/* ══ FUNNEL ══ */
.fstep{display:grid;grid-template-columns:170px 1fr 64px 160px;align-items:center;gap:12px;margin-bottom:10px}
.fstep:last-child{margin-bottom:0}
.fstep-lbl{font-size:12px;font-weight:500;color:var(--g700)}
.fbar-wrap{height:34px;background:var(--g100);border-radius:8px;overflow:hidden;border:1px solid var(--g200)}
.fbar{height:100%;border-radius:7px;display:flex;align-items:center;padding-left:12px;font-size:12px;font-weight:600;transition:width .5s cubic-bezier(.4,0,.2,1);min-width:30px;white-space:nowrap;letter-spacing:-0.005em;font-feature-settings:"tnum"}
.fnum{font-family:var(--font);font-size:19px;font-weight:600;color:var(--g900);text-align:right;letter-spacing:-0.022em;font-feature-settings:"tnum"}
.feq{font-size:11px;color:var(--g400);text-align:right;line-height:1.35}
.bar-c{background:#cfe2f6;color:#0C447C}
.bar-p{background:#b8e5d2;color:#085041}
.bar-v{background:#0b0a09;color:#cbf135}
.metodo-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px}
.mmcard{background:white;border-radius:var(--r);padding:10px 12px;border:1px solid var(--g200);box-shadow:var(--shadow-1)}
.mmcard-name{font-size:9.5px;font-weight:600;margin-bottom:4px;line-height:1.3;color:var(--g600);text-transform:uppercase;letter-spacing:0.06em}
.mmcard-val{font-size:18px;font-weight:600;color:var(--g900);letter-spacing:-0.02em;font-feature-settings:"tnum"}
.mmcard-sub{font-size:10px;color:var(--g400);margin-top:2px}

/* ══ LITERATURE ══ */
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

/* ══ TRACKER TABLES ══ */
.form-table{width:100%;border-collapse:collapse}
.form-table th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--g400);padding:8px 10px;border-bottom:1px solid var(--g200)}
.form-table td{padding:8px;border-bottom:1px solid var(--g100);vertical-align:middle}
.form-table input[type=text],.form-table select{width:100%;padding:8px 10px;border:1px solid var(--g200);border-radius:8px;font-family:var(--font);font-size:13px;outline:none;background:white;transition:all .15s}
.form-table input[type=text]:focus,.form-table select:focus{border-color:var(--blue);box-shadow:var(--ring)}
.form-table input[type=number]{width:72px;padding:8px 10px;border:1px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none;text-align:center;transition:all .15s;background:white;font-feature-settings:"tnum"}
.form-table input[type=number]:focus{border-color:var(--blue);box-shadow:var(--ring)}
.check-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--g200);background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all .15s;margin:auto;color:var(--g400)}
.check-btn:hover{border-color:var(--g700);color:var(--g700)}
.check-btn.on{background:var(--teal);border-color:var(--teal);color:white}
.del-btn{width:28px;height:28px;border-radius:7px;border:1px solid rgba(176,58,58,0.22);background:var(--red-lt);color:var(--red);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;margin:auto;transition:all .15s}
.del-btn:hover{background:var(--red);color:white;border-color:var(--red)}
table.dt{width:100%;border-collapse:collapse;font-size:13px}
.dt th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--g400);padding:8px 10px;border-bottom:1px solid var(--g200)}
.dt td{padding:9px 10px;border-bottom:1px solid var(--g100);color:var(--g700)}
.dt tr:last-child td{border-bottom:none}
.dt tfoot td{font-weight:600;color:var(--g900);border-top:1px solid var(--g300);border-bottom:none;padding-top:10px;background:var(--g50)}

.pill{display:inline-block;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:-0.005em;line-height:1.3}
.pill-am{background:var(--amber-lt);color:var(--amber)}
.pill-rd{background:var(--red-lt);color:var(--red)}
.pill-gn{background:var(--teal-lt);color:var(--teal)}
.pill-bl{background:var(--blue-lt);color:var(--blue)}
.locked-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:600;background:var(--teal-lt);color:var(--teal);border:1px solid rgba(31,111,86,0.2)}
.chart-wrap{position:relative;height:220px;margin-top:10px}

/* ══ PRINT ══ */
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
  .smc.ok{background:linear-gradient(180deg,#edf4fb 0%,#d9ecf8 100%)!important;border:1.5px solid #185FA5!important}.smc.ng{border-color:var(--red)!important;border-width:1.5px!important}
  .smc.ok .smc-val{color:#0C447C!important;font-size:27px!important}.smc.ng .smc-val{color:#b03a3a!important}
}
@media screen{.print-header{display:none}}

/* ══ MODAL ══ */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(11,10,9,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:500;align-items:center;justify-content:center;padding:24px}
.modal-overlay.open{display:flex;animation:modalFade .18s ease}
@keyframes modalFade{from{opacity:0}to{opacity:1}}
.modal-box{background:white;border-radius:var(--rx);padding:30px;max-width:440px;width:100%;box-shadow:var(--shadow-3)}
.copyright{text-align:center;font-size:11px;color:var(--g400);padding:28px 18px;border-top:1px solid var(--g200);margin-top:8px;display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}

@media(max-width:900px){
  .two-col{grid-template-columns:1fr}
  .left{max-height:none;position:static;border-right:none;border-bottom:1px solid var(--g200)}
  .right{padding:18px}
  .mcrow,.grid4{grid-template-columns:repeat(2,1fr)}
  .grid2{grid-template-columns:1fr}
  .fstep{grid-template-columns:90px 1fr 44px 90px;gap:8px}
  .module-bar,.tabs{padding:0 14px}
  .tab-panel{padding:16px}
  .header{padding:9px 14px}
}

/* ══ METODOS (rows + chain) ══ */
.metodo-group-lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:var(--lime-dk);display:flex;align-items:center;gap:10px;margin:18px 0 8px;padding:4px 0}
.metodo-group-lbl:before,.metodo-group-lbl:after{content:'';flex:1;border-top:1px solid var(--g200)}
.metodo-group-sin{color:var(--amber)}
.metodo-group-sin:before,.metodo-group-sin:after{border-color:var(--g200)}
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

/* ══ ORIG-CHART ══ */
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
.ico-info{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:var(--g300);color:var(--g700);font-size:9px;font-weight:700;cursor:default;vertical-align:middle;margin-left:3px;font-style:normal;flex-shrink:0;line-height:1;font-family:var(--font)}
.ico-info:hover{opacity:1}
      `}</style>

      {/* LOGIN */}
      <div id="screen-login">
        <div className="lcard">
          <div className="llogo-wrap" style={{gap:'10px'}}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{flexShrink:0}}>
              <circle cx="16" cy="16" r="4.5" fill="#a8cc1a"/>
              <circle cx="6" cy="9" r="3" fill="#a8cc1a" opacity="0.85"/>
              <circle cx="26" cy="9" r="3" fill="#a8cc1a" opacity="0.85"/>
              <circle cx="6" cy="23" r="3" fill="#a8cc1a" opacity="0.6"/>
              <circle cx="26" cy="23" r="3" fill="#a8cc1a" opacity="0.6"/>
              <line x1="8.6" y1="10.6" x2="13.2" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
              <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
              <line x1="8.6" y1="21.4" x2="13.2" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
            <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:'18px',color:'white',letterSpacing:'-0.04em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
          </div>
          <div className="ltitle">Ingresa a tu cuenta</div>
          <div className="lsub">Acceso restringido al personal autorizado.</div>
          <div className="lfield">
            <label>Tu nombre completo</label>
            <input type="text" id="ln" placeholder="Escribe tu nombre..." autoComplete="off" spellCheck={false} />
          </div>
          <div className="lfield">
            <label>Clave personal</label>
            <input type="password" id="lp" placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-full" onClick={() => (window as any).doLogin()}>Ingresar</button>
          <div className="msg rd" id="lerr"></div>
          <div className="msg bl" id="lload" style={{display:'none'}}>Iniciando sesión…</div>
          <div className="lfooter">© 2026 The Precision Selling · Todos los derechos reservados</div>
        </div>
      </div>

      {/* APP */}
      <div id="screen-app">

        {/* Print header */}
        <div className="print-header">
          <div className="print-logo-wrap">
            <svg width="80" height="24" viewBox="0 0 80 24" fill="none">
              <circle cx="12" cy="12" r="3.4" fill="#a8cc1a"/>
              <circle cx="4.5" cy="6.75" r="2.25" fill="#a8cc1a" opacity="0.85"/>
              <circle cx="19.5" cy="6.75" r="2.25" fill="#a8cc1a" opacity="0.85"/>
              <circle cx="4.5" cy="17.25" r="2.25" fill="#a8cc1a" opacity="0.6"/>
              <circle cx="19.5" cy="17.25" r="2.25" fill="#a8cc1a" opacity="0.6"/>
            </svg>
          </div>
          <div><div className="print-title">Proxis · Chile</div><div className="print-asesor" id="print-name"></div></div>
        </div>

        <header className="header">
          <div className="hlogo-wrap" style={{gap:'8px',padding:'6px 12px'}}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{flexShrink:0}}>
              <circle cx="16" cy="16" r="4.5" fill="#a8cc1a"/>
              <circle cx="6" cy="9" r="3" fill="#a8cc1a" opacity="0.85"/>
              <circle cx="26" cy="9" r="3" fill="#a8cc1a" opacity="0.85"/>
              <circle cx="6" cy="23" r="3" fill="#a8cc1a" opacity="0.6"/>
              <circle cx="26" cy="23" r="3" fill="#a8cc1a" opacity="0.6"/>
              <line x1="8.6" y1="10.6" x2="13.2" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
              <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
              <line x1="8.6" y1="21.4" x2="13.2" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
            <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:'18px',color:'white',letterSpacing:'-0.04em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
          </div>
          <div className="hdiv"></div>
          <div className="hlogo-text" style={{fontSize:'11px',fontWeight:600,color:'white',lineHeight:1.3}}>
            Prospección<span style={{display:'block',fontSize:'10px',fontWeight:400,opacity:.7,letterSpacing:'.07em',textTransform:'uppercase'}}>en práctica</span>
          </div>
          <span className="huf">UF: <span id="uf-display">…</span></span>
          <div className="hml">
            <div className="hrole" id="h-role"></div>
            <a href="/" style={{fontSize:'12px',color:'rgba(255,255,255,.5)',textDecoration:'none',padding:'5px 12px',border:'1px solid rgba(255,255,255,.2)',borderRadius:'20px',transition:'all .15s'}}
              onMouseOver={e => (e.currentTarget.style.color='rgba(255,255,255,.9)')}
              onMouseOut={e => (e.currentTarget.style.color='rgba(255,255,255,.5)')}>← Inicio</a>
            <button className="hout" onClick={() => (window as any).doLogout()}>Salir</button>
          </div>
        </header>

        <div className="module-bar" id="module-bar"></div>

        {/* MÓDULO: SIMULADOR */}
        <div className="module" id="mod-simulador">
          <div className="two-col">
            <div className="left" id="sim-left"></div>
            <div className="right" id="sim-right">
              <div id="alert-box" style={{marginBottom:'12px'}}></div>
              <div style={{display:'flex',justifyContent:'center',marginBottom:'14px'}}>
                <button className="btn btn-primary report-btn" onClick={() => window.print()} style={{display:'flex',alignItems:'center',gap:'7px'}}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="white" strokeWidth="1.3" fill="none" strokeLinejoin="round"/><path d="M10 2v3h3M5 7h6M5 9.5h6M5 12h4" stroke="white" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  Generar informe PDF — <span id="btn-asesor" style={{fontStyle:'italic'}}>—</span>
                </button>
              </div>
              <div className="mcrow" id="metric-row"></div>
              <div style={{fontSize:'11px',color:'#185FA5',lineHeight:1.6,marginBottom:'12px',padding:'9px 12px',background:'#E6F1FB',borderLeft:'3px solid #185FA5',borderRadius:'0 6px 6px 0'}}>ℹ️ * Cifra referencial. Valores aproximados. Es posible que haya diferencias con los valores reales. El objetivo del &quot;Ingreso Bruto Aproximado Total&quot; es servir solo de referencia general para el cálculo de las metas de prospección.</div>
              <div id="metric-contacts"></div>
              <div className="card"><div className="card-title">Prospectos Referidos por Contactos / Nodos</div><div id="funnel-content"></div></div>
              <div className="lit-box">
                <div className="lit-title">Tasas de cierre de referencia — Granum · LIMRA · MDRT · Finseca · NAIFA</div>
                <table className="lit-table"><thead><tr><th>Origen del prospecto</th><th>Tasa de cierre</th><th>Prospectos por venta</th></tr></thead>
                <tbody><tr><td>Frío (sin referido)</td><td>10–15%</td><td>7–10</td></tr><tr><td>Referido (nombre dado)</td><td>25–30%</td><td>3–4</td></tr><tr><td>Referido con presentación del nodo</td><td>40–50%</td><td>2–3</td></tr><tr><td>Transferencia en vivo (nodo presenta)</td><td>55–70%</td><td>1–2</td></tr></tbody></table>
                <div className="lit-note"><strong>Sistema TPS — Nodos Referidores:</strong> 1 contacto/nodo activo genera en promedio 5 prospectos referidos. Con presentación activa del nodo, la tasa de cierre base alcanza 50–65%, resultando en 1,5–2 ventas por nodo.<br /><br />
                <strong>Factor de efectividad del asesor para Transferencia en vivo (nodo presenta):</strong> <strong>Baja (33%)</strong> → 1 venta cada 4–5 prospectos · <strong>Media (66%)</strong> → 1 venta cada 2–3 · <strong>Alta (100%)</strong> → 1 venta cada 1–2. Mejora con entrenamiento y dominio del cierre.</div>
              </div>
              <div className="card card-collapsible" id="card-mix">
                <div className="card-title" id="mix-card-title" onClick={() => (window as any).toggleCard('card-mix')}>Desglose del mix de productos — Contrato original <span className="coll-arrow">▾</span></div>
                <div className="card-body" style={{textAlign:'left'}}>
                  <table className="dt"><thead><tr><th>Producto</th><th>Pólizas</th><th>Factor AE</th><th>PPA (UF)</th><th>AE Puntos</th><th>Nota</th></tr></thead>
                  <tbody id="mix-tbody"></tbody><tfoot id="mix-tfoot"></tfoot></table>
                  <p style={{fontSize:'11px',color:'var(--g400)',marginTop:'8px',lineHeight:1.6}}>*Valores aproximados de referencia general. Es posible que haya diferencias con los valores reales.</p>
                  <div id="mix-camp-wrap" style={{display:'none',marginTop:'16px',paddingTop:'14px',borderTop:'1px solid var(--g200)'}}>
                    <div className="card-title" style={{marginBottom:'10px'}}>Desglose bajo Campaña Complemento Producción Emitida</div>
                    <table className="dt"><thead><tr><th>Producto</th><th>Pólizas</th><th>Factor AE campaña</th><th>PPA (UF)</th><th>AE Campaña</th><th>Tope AE/póliza</th><th>Nota</th></tr></thead>
                    <tbody id="mix-camp-tbody"></tbody><tfoot id="mix-camp-tfoot"></tfoot></table>
                    <p style={{fontSize:'11px',color:'var(--g400)',marginTop:'8px',lineHeight:1.6}}>*Valores aproximados de referencia general. Es posible que haya diferencias con los valores reales.</p>
                  </div>
                </div>
              </div>
              <div className="card card-collapsible" id="card-tramos">
                <div className="card-title" onClick={() => (window as any).toggleCard('card-tramos')}>Transformación AE Puntos → Bono UF <span className="coll-arrow">▾</span></div>
                <div className="card-body">
                  <table className="dt"><thead><tr><th>Tramo AE Puntos</th><th>Puntos aplicados</th><th>%</th><th>UF generadas</th><th>$ CLP</th></tr></thead>
                  <tbody id="tramos-tbody"></tbody><tfoot id="tramos-tfoot"></tfoot></table>
                  <p style={{fontSize:'11px',color:'var(--g400)',marginTop:'8px',lineHeight:1.6}}>*Valores aproximados de referencia general. Es posible que haya diferencias con los valores reales.</p>
                </div>
              </div>
              <div className="card card-collapsible" id="card-consol" style={{marginTop:'14px'}}>
                <div className="card-title" onClick={() => (window as any).toggleCard('card-consol')}>🧾 Consolidado mensual completo <span className="coll-arrow">▾</span></div>
                <div className="card-body">
                  <table className="dt"><thead><tr><th>Componente</th><th>Detalle</th><th>$ mes</th></tr></thead>
                  <tbody id="consolidado-tbody"></tbody></table>
                  <p style={{fontSize:'11px',color:'var(--g400)',marginTop:'8px',lineHeight:1.6}}>*Valores aproximados de referencia general. Es posible que haya diferencias con los valores reales.</p>
                </div>
              </div>
              <p className="disclaimer" id="disclaimer-txt" style={{fontSize:'11px',color:'var(--g400)',borderTop:'1px solid var(--g200)',paddingTop:'12px',marginTop:'4px',lineHeight:1.6}}></p>
              <div id="metas-content" style={{display:'none'}}></div>
              <div className="copyright" style={{marginTop:'24px'}}>
                <span style={{color:'var(--g400)'}}>© 2026 The Precision Selling · Todos los derechos reservados</span>
              </div>
            </div>
          </div>
        </div>

        {/* MÓDULO: TRACKER */}
        <div className="module" id="mod-tracker">
          <div className="tabs" id="tracker-tabs"></div>
          <div className="tab-panel" id="panel-informe">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
              <div><h2 style={{fontSize:'18px',fontWeight:600}}>Mi informe de avance</h2><p style={{fontSize:'13px',color:'var(--g400)'}}>Indicadores de gestión de prospección</p></div>
              <select className="sel-std" id="sel-mes-informe" onChange={() => (window as any).renderInforme()}></select>
            </div>
            <div id="informe-content"></div>
            <div className="copyright" style={{marginTop:'24px'}}><span style={{color:'var(--g400)'}}>© 2026 The Precision Selling · Todos los derechos reservados</span></div>
          </div>
          <div className="tab-panel" id="panel-reporte">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
              <div><h2 style={{fontSize:'18px',fontWeight:600}}>Bitácora Semanal</h2><p style={{fontSize:'13px',color:'var(--g400)'}} id="lbl-mes-actual"></p></div>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <button className="btn btn-secondary" style={{fontSize:'12px',padding:'7px 12px'}} onClick={() => (window as any).toggleBitacoraGuia()} id="btn-guia">💡 ¿Cómo funciona?</button>
                <button className="btn btn-primary" onClick={() => (window as any).abrirNuevaSemana()}>+ Nueva semana</button>
              </div>
            </div>
            <div id="bitacora-guia" style={{display:'none',marginBottom:'16px'}}>
              <div style={{background:'var(--blue)',borderRadius:'var(--rl)',padding:'20px 22px',color:'white'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                  <div style={{fontSize:'14px',fontWeight:600}}>📋 Cómo usar tu Bitácora Semanal</div>
                  <button onClick={() => (window as any).toggleBitacoraGuia()} style={{background:'rgba(255,255,255,.15)',border:'none',color:'white',borderRadius:'20px',padding:'4px 12px',fontSize:'12px',cursor:'pointer'}}>Cerrar ✕</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                  <div style={{background:'rgba(255,255,255,.1)',borderRadius:'var(--r)',padding:'14px 16px'}}>
                    <div style={{fontSize:'13px',fontWeight:600,marginBottom:'8px'}}>📅 Informe semanal</div>
                    <p style={{fontSize:'12px',lineHeight:1.6,opacity:.9}}>Cada lunes abre una nueva semana y registra tus contactos: nombre, vínculo, si llamaste, si te reuniste y cuántos prospectos te dio. La meta es ≥5 prospectos por contacto.</p>
                    <div style={{marginTop:'10px',fontSize:'11px',background:'rgba(255,255,255,.15)',borderRadius:'8px',padding:'8px 10px',lineHeight:1.5}}>
                      <strong>¿Un contacto volvió a darte prospectos?</strong><br />
                      Agrégalo en la semana nueva. El sistema detectará que ya estuvo antes y te preguntará si es la misma persona. Si confirmas → ¡se convierte en tu Nodo! 🌳
                    </div>
                  </div>
                  <div style={{background:'rgba(255,255,255,.1)',borderRadius:'var(--r)',padding:'14px 16px'}}>
                    <div style={{fontSize:'13px',fontWeight:600,marginBottom:'8px'}}>🌳 Mis Nodos Activos</div>
                    <p style={{fontSize:'12px',lineHeight:1.6,opacity:.9}}>Un <strong>nodo</strong> es un contacto que te refirió prospectos en más de una ocasión. Es la señal de que confían en ti y siguen ayudándote a crecer.</p>
                    <div style={{marginTop:'10px',fontSize:'11px',background:'rgba(255,255,255,.15)',borderRadius:'8px',padding:'8px 10px',lineHeight:1.5}}>
                      <strong>¿Quieres trabajar enfocado en tus nodos?</strong><br />
                      Usa la sección &quot;Mis Nodos Activos&quot; arriba para registrar activaciones directamente sobre cada nodo, sin pasar por el formulario semanal.
                    </div>
                  </div>
                </div>
                <div style={{marginTop:'14px',fontSize:'11px',opacity:.75,textAlign:'center'}}>
                  Las semanas anteriores se cierran automáticamente cuando abres una nueva · Solo la semana más reciente es editable
                </div>
              </div>
            </div>
            <div id="proximo-lunes-banner" style={{display:'none',marginBottom:'14px'}}></div>
            <div id="nodos-panel" style={{display:'none',marginBottom:'16px'}}></div>
            <div id="reporte-content"></div>
            <div className="copyright" style={{marginTop:'24px'}}><span style={{color:'var(--g400)'}}>© 2026 The Precision Selling · Todos los derechos reservados</span></div>
          </div>
          <div className="tab-panel" id="panel-equipo">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
              <div><h2 style={{fontSize:'18px',fontWeight:600}}>Equipo completo</h2><p style={{fontSize:'13px',color:'var(--g400)'}}>Consolidado de actividad y gaps del equipo</p></div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                <select className="sel-std" id="sel-mes-equipo" onChange={() => (window as any).renderEquipo()}></select>
                <select className="sel-std" id="sel-asesor-equipo" style={{display:'none'}}></select>
                <select className="sel-std" id="sel-periodo-equipo" onChange={() => (window as any).renderEquipo()}>
                  <option value="1">1 mes</option><option value="2">2 meses</option>
                  <option value="3">Trimestre</option><option value="6">Semestre</option>
                  <option value="12">Anual</option>
                </select>
              </div>
            </div>
            <div id="equipo-content"></div>
            <div className="copyright" style={{marginTop:'24px'}}><span style={{color:'var(--g400)'}}>© 2026 The Precision Selling · Todos los derechos reservados</span></div>
          </div>
          <div className="tab-panel" id="panel-individual">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
              <div><h2 style={{fontSize:'18px',fontWeight:600}}>Desempeño individual</h2></div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <select className="sel-std" id="sel-asesor-individual" onChange={() => (window as any).renderIndividual()}></select>
                <select className="sel-std" id="sel-mes-individual" onChange={() => (window as any).renderIndividual()}></select>
              </div>
            </div>
            <div id="individual-content"></div>
            <div className="copyright" style={{marginTop:'24px'}}><span style={{color:'var(--g400)'}}>© 2026 The Precision Selling · Todos los derechos reservados</span></div>
          </div>
          <div className="tab-panel" id="panel-ingresos">
            <h2 style={{fontSize:'18px',fontWeight:600,marginBottom:'16px'}}>Ingresos mensuales por asesor</h2>
            <div id="ingresos-content"></div>
            <div className="copyright" style={{marginTop:'24px'}}><span style={{color:'var(--g400)'}}>© 2026 The Precision Selling · Todos los derechos reservados</span></div>
          </div>
        </div>
      </div>

      {/* Modal general */}
      <div className="modal-overlay" id="modal">
        <div className="modal-box">
          <h3 style={{fontSize:'16px',fontWeight:600,marginBottom:'10px'}} id="modal-title"></h3>
          <p style={{fontSize:'13px',color:'var(--g700)',marginBottom:'20px'}} id="modal-body"></p>
          <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
            <button className="btn btn-secondary" onClick={() => (window as any).cerrarModal()}>Cancelar</button>
            <button className="btn btn-primary" id="modal-ok">Confirmar</button>
          </div>
        </div>
      </div>

      {/* Modal homónimo */}
      <div className="modal-overlay" id="modal-homonimo" style={{zIndex:600}}>
        <div className="modal-box" style={{maxWidth:'480px'}}>
          <div style={{fontSize:'20px',textAlign:'center',marginBottom:'8px'}}>🔍</div>
          <h3 style={{fontSize:'15px',fontWeight:600,marginBottom:'8px',textAlign:'center'}} id="hom-title"></h3>
          <div id="hom-prev" style={{background:'var(--teal-lt)',borderRadius:'var(--r)',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:'var(--g700)'}}></div>
          <p style={{fontSize:'13px',color:'var(--g700)',marginBottom:'16px'}}>¿Es la misma persona o es alguien distinto con el mismo nombre?</p>
          <div style={{display:'flex',gap:'10px',flexDirection:'column'}}>
            <button className="btn btn-success" style={{justifyContent:'center'}} onClick={() => (window as any).homonimoEsMismo()}>✓ Es la misma persona — marcar como reactivación</button>
            <button className="btn btn-secondary" style={{justifyContent:'center'}} onClick={() => (window as any).homonimoEsDistinto()}>Es otra persona — agregar identificador</button>
          </div>
        </div>
      </div>

      {/* Modal celebración nodo */}
      <div className="modal-overlay" id="modal-nodo" style={{zIndex:700}}>
        <div className="modal-box" style={{maxWidth:'440px',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'8px'}}>🌳</div>
          <h3 style={{fontSize:'18px',fontWeight:600,color:'var(--teal)',marginBottom:'8px'}} id="nodo-cel-title"></h3>
          <p style={{fontSize:'13px',color:'var(--g700)',lineHeight:1.6,marginBottom:'20px'}} id="nodo-cel-body"></p>
          <button className="btn btn-success" style={{width:'100%',justifyContent:'center'}} onClick={() => (window as any).cerrarModalNodo()}>¡Excelente! Ver mis nodos →</button>
        </div>
      </div>

      {/* Onboarding modal */}
      <div className="modal-overlay" id="modal-onboarding" style={{zIndex:800,background:'rgba(0,55,129,.92)'}}>
        <div style={{background:'white',borderRadius:'20px',padding:0,width:'100%',maxWidth:'540px',overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,.4)'}}>
          <div style={{height:'4px',background:'var(--g200)'}}>
            <div id="ob-progress" style={{height:'100%',background:'var(--blue)',borderRadius:'2px',transition:'width .4s'}}></div>
          </div>
          <div style={{padding:'32px 36px'}}>
            <div style={{fontSize:'36px',marginBottom:'12px',textAlign:'center'}} id="ob-icon"></div>
            <h2 style={{fontSize:'20px',fontWeight:600,color:'var(--blue)',marginBottom:'10px',textAlign:'center'}} id="ob-title"></h2>
            <p style={{fontSize:'14px',color:'var(--g700)',lineHeight:1.7,marginBottom:'24px',textAlign:'center'}} id="ob-body"></p>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button className="btn btn-secondary" id="ob-prev" onClick={() => (window as any).obPrev()} style={{visibility:'hidden'}}>← Anterior</button>
              <span id="ob-counter" style={{fontSize:'12px',color:'var(--g400)'}}></span>
              <button className="btn btn-primary" id="ob-next" onClick={() => (window as any).obNext()}>Siguiente →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip modal */}
      <div id="tooltip-modal" style={{display:'none',position:'fixed',zIndex:900,pointerEvents:'none'}}>
        <div style={{background:'var(--g900)',color:'white',borderRadius:'10px',padding:'10px 14px',maxWidth:'280px',fontSize:'12px',lineHeight:1.5,boxShadow:'0 8px 24px rgba(0,0,0,.3)'}}>
          <div style={{fontWeight:600,marginBottom:'4px'}} id="tt-title"></div>
          <div id="tt-body"></div>
        </div>
      </div>
    </>
  )
}
