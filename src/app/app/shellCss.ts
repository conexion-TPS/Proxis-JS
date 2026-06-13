// Shell CSS compartido del /app (C2.1) — tokens de diseño + app-shell + module-bar.
// Estas 34 líneas son BYTE-IDÉNTICAS hoy en las 4 pantallas (informe, simulador,
// simulador-consorcio, tracker); se extraen aquí como única fuente.
// El CSS por-módulo (tabs, simulador-layout, tablas, cards, etc.) NO se toca: queda
// en cada página, porque NO es duplicación. Verificado con diff (líneas 1-35 del bloque).
export const SHELL_CSS = `
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
  --shadow-3:0 24px 64px rgba(0,0,0,0.22),0 4px 12px rgba(0,0,0,0.08);
  --ring:0 0 0 3px rgba(11,10,9,0.08);
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
`
