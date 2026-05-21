/* ═══════════════════════════════════════════════════════
   COMPAÑÍA Z — DATOS DEL SIMULADOR
   Productos, constantes, tablas de cálculo y estado global (simState)
   Dependencia: cargado después de plataforma-core.js
   Futuro: reemplazar este archivo para simular otra compañía
═══════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   BUILD APP
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   SIMULADOR STATE (needed here for G.simState)
══════════════════════════════════════════════════════════════ */
// ── PRODUCTOS VIDA VI (factor AE, comisiones según contrato) ──
const SIM_PRODS=[
  // id, nombre, z:factorAE, c:comVenta(%), q:qty inicial, p:prima inicial, pMax:prima máx
  // incM12/M24/M120: incentivo mantención por tramo antigüedad, cTopeUF: tope comisión en UF
  {id:'BL',  n:'Vida Empresarial',   z:2.00, c:.32,  q:1, p:200000, pMax:2000000, incM12:.32, incM24:.06,  incM120:.036},
  {id:'PM',  n:'Vida Mujer',        z:2.00, c:.32,  q:0, p:180000, pMax:2000000, incM12:.32, incM24:.06,  incM120:.036},
  {id:'TP',  n:'Seguro Temporal',  z:1.00, c:.16,  q:0, p:80000,  pMax:1500000, cTopeUF:10, incM12:.024, incM24:.024, incM120:.024},
  {id:'FP',  n:'El Futuro es Hoy AE', z:1.00, c:.056, q:0, p:100000, pMax:1500000, cTopeUF:0.22, incM12:.056, incM12TopeUF:.22, incM24:.024, incM24TopeUF:.10},
  {id:'AP',  n:'Acc. Personales', z:1.00, c:.08,  q:0, p:30000,  pMax:500000,  incM12:.08, incM24:.08, incM120:.08},
  {id:'APV', n:'APV',             z:0.50, cUF:.08,q:1, p:120000, pMax:2000000},
  {id:'SS',  n:'Salud', z:0.50, c:.08,  q:0, p:50000,  pMax:1000000, incM12:.08, incM24:.08, incM120:.08},
  {id:'BLF', n:'Vida Empresarial Flexible',         z:0.50, c:.32,  q:0, p:80000,  pMax:2000000, incM12:.32, incM24:.06,  incM120:.036},
  {id:'RP',  n:'Futura Renta',z:0.50, c:.24,  q:0, p:200000, pMax:2000000},
  {id:'APVF',n:'APV AE Flexible',        z:0.25, cUF:.08,q:0, p:100000, pMax:1500000},
];
// ── PRODUCTOS GENERALES GI (Auto 50%, Hogar 100%) ──
const SIM_PRODS_GI=[
  {id:'AUTO', n:'Auto',  z:0.50, q:0, p:25000, pMax:200000},
  {id:'HOGAR',n:'Hogar', z:1.00, q:0, p:15000, pMax:100000},
];
// Premios Top 20 APE y Crecimiento (UF/mes)
const TOP20_APE_UF =[23,18,13,11,9,7,6,6,4,4,3,3,3,2,2,2,1,1,1,1];
const TOP20_CV_UF  =[11,8,8,8,5,5,5,2,2,2,1,1,1,1,1,1,1,1,1,1];
const SIM_METODOS=[
  // Con contacto/nodo activo — 3 niveles de patrocinio
  {id:'ref1',nombre:'Contacto/Nodo — nombre dado',desc:'El contacto/nodo da un nombre y teléfono. El asesor llega con referencia pero sin presentación activa.',tasa:'25-30%',cPV:5,reunRate:0.40,cierreRate:0.40,nPorNodo:5,color:'#1D9E75',bg:'#E1F5EE',esNodo:true,
   cadena:[{n:1,l:'contacto/\nnodo'},{n:5,l:'nombres\ndados'},{n:2,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}]},
  {id:'ref2',nombre:'Contacto/Nodo — presentado con patrocinio',desc:'El nodo hace una introducción activa. El prospecto espera el contacto del asesor. Mayor credibilidad.',tasa:'40-50%',cPV:2.5,reunRate:0.60,cierreRate:0.67,nPorNodo:5,color:'#0F6E56',bg:'#E1F5EE',esNodo:true,
   cadena:[{n:1,l:'contacto/\nnodo'},{n:5,l:'referidos\navisados'},{n:3,l:'con\nreunión'},{n:2,l:'cierres\nest.',hi:true}]},
  {id:'ref3',nombre:'Contacto/Nodo — transferencia en vivo',desc:'El nodo presenta en persona, llamada o videollamada en ese momento. Máxima credibilidad.',tasa:'55-70%',cPV:1.5,reunRate:0.50,cierreRate:1.0,nPorNodo:2,color:'#5DCAA5',bg:'#E1F5EE',esNodo:true,
   cadena:[{n:1,l:'contacto/\nnodo'},{n:2,l:'presentes\nen vivo'},{n:1,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}]},
  {id:'ref4',nombre:'Referidos tras cierre o entrega de póliza',desc:'Pre-calificados por clientes actuales tras el cierre, transferidos en vivo.',tasa:'20-25%',cPV:5,reunRate:0.50,cierreRate:0.22,nPorNodo:5,color:'#a8cc1a',bg:'#f5ffcc',esNodo:true,esPostCierre:true,
   cadena:[{n:1,l:'cliente\ntras cierre'},{n:5,l:'prospectos\nentregados'},{n:2,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}]},
  // Sin contacto/nodo
  {id:'dig',nombre:'Leads digitales de alta intención',desc:'Leads online (formularios, calculadoras, ads). Ya mostraron interés previo.',tasa:'10-15%',cPV:7,color:'#378ADD',bg:'#E6F1FB',esNodo:false,
   cadena:[{n:'—',l:'sin\nnodo'},{n:7,l:'leads\nrecibidos'},{n:4,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:'blue'}]},
  {id:'frio',nombre:'Prospección en frío',desc:'Contacto masivo sin pre-calificación. Alto volumen, baja conversión.',tasa:'2-4%',cPV:40,color:'#BA7517',bg:'#FAEEDA',esNodo:false,
   cadena:[{n:'—',l:'sin\nnodo'},{n:40,l:'contactos\nfríos'},{n:10,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:'amber'}]},
];
const SIM_TRAMOS=[
  {min:0,   max:49.99, pct:.10, lbl:'0 – 49,99'},
  {min:50,  max:99.99, pct:.12, lbl:'50 – 99,99'},
  {min:100, max:149.99,pct:.15, lbl:'100 – 149,99'},
  {min:150, max:200,   pct:.18, lbl:'150 – 200'},
  {min:200.01,max:9999,pct:.10, lbl:'200+ (tramo 5)'},
];
const TOPES_ORIG=[[6,300],[23,700],[47,800],[71,900],[95,1000],[119,1100],[999,1200]];
const TOPES_CAMP=[[6,1000],[12,1500],[24,2000],[999,99999]];
// Campaña Complemento Producción Emitida — Tabla 2
const CAMP_PRODS={
  'BL': {z:1.00,tope:300},
  'PM': {z:1.00,tope:300},
  'TP': {z:1.00,tope:null},
  'AP': {z:1.00,tope:null},
  'APV':{z:1.00,tope:600,capUF:500},
  'BLF':{z:0.50,tope:300},
  'SS': {z:1.00,tope:null},
  'RP': {z:0.50,tope:300},
  'APVF':{z:0.50,tope:600,capUF:500},
};
let UF_VAL=39357;
let SUELDO_BASE=539000;
const fmtUF=n=>n.toFixed(2)+' UF';
// TOPE_T5: tope del tramo 5 según antigüedad (NO es cap de AE total)
const TOPE_T5=(a,c)=>{const t=c?TOPES_CAMP:TOPES_ORIG;for(const[m,v]of t)if(a<=m)return v;return c?null:1200};
const PMIN=a=>a<=12?.90:a<=24?.82:.78;
// Factor persistencia: 1.20 SOLO para ant > 12 meses
const FP=(r,m,ant)=>{const c=r/m;if(c<=.5)return 0;if(c<=.85)return .5;if(c<=.9)return .65;if(c<=.95)return .9;if(c<=1)return 1;return ant>12?1.2:1.0};
let simState={
  meta:2000000, ant:3, persist:92, campana:true,
  pcts:{ref1:40,ref2:40,ref3:0,ref4:0,dig:10,frio:10},
  qty:{}, prima:{}, qtyGI:{}, primaGI:{},
  rpMonto:0, apvEx:0, apvFlexEx:0,
  t5:{r1:false,r2:false,r3:false,r4:false,r5:false},
  bonos:{top20ape:false,top20cv:false,grati:true},
  rankApe:10, rankCv:10,
  asesor:ASESORES[0]
};
SIM_PRODS.forEach(p=>{simState.qty[p.id]=p.q;
  // Store prima in UF (convert initial value from CLP to UF)
  simState.prima[p.id]=parseFloat((p.p/UF_VAL).toFixed(2));
});
SIM_PRODS_GI.forEach(p=>{simState.qtyGI[p.id]=p.q;simState.primaGI[p.id]=parseFloat((p.p/UF_VAL).toFixed(2));});

