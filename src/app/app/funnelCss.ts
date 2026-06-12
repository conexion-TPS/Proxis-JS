// Bloque CSS de embudo (FUNNEL + ORIG-CHART) — verbatim del legacy plataforma (C2.1-bis).
// Byte-idéntico en /app/simulador, /app/simulador-consorcio y /app/tracker;
// se centraliza aquí. NO incluye el override responsive `@media .fstep{…}` (vive en el
// bloque @media general de cada página). La copia en /plataforma (legacy) NO se toca.
export const FUNNEL_CSS = `/* ══ FUNNEL ══ (verbatim del legacy plataforma) */
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
.orig-total{border-top:1px solid var(--g200);padding:6px 13px;font-size:10.5px;color:var(--g700);text-align:right;background:var(--g50);font-feature-settings:"tnum"}`
