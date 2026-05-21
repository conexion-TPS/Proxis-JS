'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

type Step = {
  scene: string
  icon: string
  title: string
  desc: string
  h: string | null
  isEnd?: boolean
}

const STEPS: Step[] = [
  { scene:'scene-intro', icon:'👋', title:'Bienvenida — Tutorial para Supervisoras',
    desc:'Aprenderás a usar el Simulador de Metas y el Tracker de Prospección. Usa ← → o Espacio para navegar.', h:null },
  { scene:'scene-login', icon:'🔐', title:'Ingreso — Selecciona tu nombre',
    desc:'En el selector de ingreso aparecen todos los usuarios autorizados. Como supervisora, tu acceso desbloquea el Simulador de Metas y las vistas de equipo.', h:'#l-name' },
  { scene:'scene-login', icon:'🔑', title:'Tu clave personal',
    desc:'Cada usuario tiene una clave propia. El sistema diferencia automáticamente el rol: supervisora ve el Simulador y el Tracker completo; asesores solo ven su actividad.', h:'#l-pass' },
  { scene:'scene-login', icon:'✅', title:'Entrar al sistema',
    desc:'Al ingresar como supervisora, el sistema te mostrará directamente los dos módulos: Simulador de Metas y Tracker de Prospección. Haz clic para continuar.', h:'#l-btn' },
  { scene:'scene-sim', icon:'📊', title:'Simulador de Metas — visión general',
    desc:'Este es el módulo principal de la supervisora. Panel izquierdo: configuras los parámetros del asesor. Panel derecho: el sistema proyecta sus ingresos estimados en tiempo real.', h:'#module-bar' },
  { scene:'scene-sim', icon:'👤', title:'Selector de asesor',
    desc:'Elige el asesor que quieres simular. El sistema recuerda la última configuración y puedes cambiar de asesor en cualquier momento para comparar escenarios.', h:'#asesor-sel-wrap' },
  { scene:'scene-sim', icon:'📅', title:'Antigüedad del asesor',
    desc:'La antigüedad afecta los tramos de persistencia exigidos y el bono. Un asesor de mes 12 o más tiene las exigencias completas. Ajusta este parámetro para simular distintos momentos de carrera.', h:'#ant-wrap' },
  { scene:'scene-sim', icon:'🎯', title:'Meta de ingreso mensual — la más importante',
    desc:'Esta es la meta de ingreso que el asesor necesita para su plan de vida. No es un número arbitrario: la construyes en conjunto basándote en sus gastos reales y sueños personales. Mira el panel para entender cómo se define.', h:'#meta-wrap' },
  { scene:'scene-sim', icon:'📈', title:'Persistencia real estimada',
    desc:'Refleja qué % de pólizas vendidas se mantienen vigentes. Afecta directamente el bono: persistencia ≥90% = 100% del bono. Úsala para proyectar escenarios conservadores o optimistas.', h:'#persist-wrap' },
  { scene:'scene-sim', icon:'🔄', title:'Campaña activa — modo de contrato',
    desc:'Al activar la campaña, el Factor de Producción de ciertos productos sube al 100%, ampliando el bono. Puedes comparar el escenario con y sin campaña para mostrarle al asesor el impacto real de aprovecharla.', h:'#camp-wrap' },
  { scene:'scene-sim', icon:'🌐', title:'Origen de prospectos — Contactos/Nodos vs. otros',
    desc:'Define qué % de los prospectos vienen de contactos directos y nodos, vs. otros orígenes. La meta es ≥80% vía nodos, porque son los prospectos de mayor calidad y menor costo de adquisición.', h:'#prosp-wrap' },
  { scene:'scene-sim', icon:'📋', title:'Mix de productos — pólizas por tipo',
    desc:'Ingresa cuántas pólizas de cada tipo el asesor vende en un mes típico. Cada producto tiene un Factor de Producción (FP) diferente que determina cuántos Puntos de Producción genera. El mix define el bono total.', h:'#mix-wrap' },
  { scene:'scene-sim', icon:'💡', title:'¿Qué es el Factor de Producción?',
    desc:'"FP" es el peso productivo de cada póliza. Un FP de 200% significa que esa póliza genera el doble de Puntos de Producción respecto a la prima. Los PP acumulados determinan en qué tramo de bono cae el asesor.', h:'#mix-wrap' },
  { scene:'scene-sim', icon:'⚠️', title:'Alerta de meta — ¿se alcanza o no?',
    desc:'Esta caja roja o verde es el primer indicador a revisar. Si la meta no se alcanza, ajusta el mix de productos, la cantidad de ventas o el origen de prospectos hasta encontrar el escenario viable.', h:'#meta-status-box' },
  { scene:'scene-sim', icon:'💾', title:'Guardar metas en el Tracker',
    desc:'Este botón envía las metas simuladas directamente al Tracker de Prospección del asesor. A partir de ese momento, el sistema mide el avance real contra las metas que configuraste aquí.', h:'#guardar-btn' },
  { scene:'scene-sim', icon:'💰', title:'Sueldo Base + Bono + Total',
    desc:'Tres tarjetas resumen el ingreso estimado. El Sueldo Base es fijo. El Bono de Producción depende de los Puntos de Producción acumulados y la persistencia. El Total Estimado se muestra en rojo si no alcanza la meta.', h:'#res-cards' },
  { scene:'scene-sim', icon:'🔢', title:'Funnel: contactos → prospectos → ventas',
    desc:'Tres barras muestran la cadena productiva: cuántos contactos semanales necesita, cuántos prospectos generan y cuántas ventas resultan. El sistema calcula esto en base al mix y las tasas de cierre.', h:'#prosp-funnel' },
  { scene:'scene-sim', icon:'📊', title:'Tasas de cierre — la tabla clave',
    desc:'Muestra cuántos prospectos se necesitan por venta según el origen. Un referido presentado por el nodo en vivo requiere 1-2 prospectos; en frío necesitas 7-10. Esta tabla justifica por qué los nodos son tan valiosos.', h:'#tasas-card' },
  { scene:'scene-sim', icon:'📑', title:'Desglose del mix — tabla de producción',
    desc:'Detalle por producto: cuántas pólizas, Factor de Producción aplicado, Prima Promedio Anualizada (PPA en UF), Puntos de Producción generados y comisión de venta. La suma de PP determina el bono.', h:'#mix-desglose' },
  { scene:'scene-sim', icon:'🏦', title:'Conversión Puntos → Bono en UF',
    desc:'Los Puntos de Producción se convierten en UF según tramos progresivos: a mayor producción, mayor porcentaje de conversión. Esta tabla muestra exactamente cuánto UF y pesos genera cada tramo, y cuánto falta para saltar al siguiente.', h:'#bono-card' },
  { scene:'scene-sim', icon:'🔄', title:'Del Simulador al Tracker — el flujo completo',
    desc:'Una vez que simulaste el escenario ideal, guardas las metas. En el Tracker podrás ver semana a semana si el asesor está cumpliendo el ritmo proyectado. Pasemos al Tracker ahora.', h:'#guardar-btn' },
  { scene:'scene-tracker', icon:'📋', title:'Tracker de Prospección — Equipo completo',
    desc:'Vista general del equipo: prospectos, contactos, tasa de reunión, eficiencia y nodos de todos los asesores en un solo pantallazo. El semáforo de color te da una señal rápida por asesor.', h:'#kpi-equipo' },
  { scene:'scene-tracker', icon:'📊', title:'Tabla de desempeño por asesor',
    desc:'Compara a todos tus asesores en una fila. La barra de eficiencia muestra visualmente qué tan cerca está cada uno de su potencial máximo. En rojo: necesita apoyo urgente. Verde: en buen ritmo.', h:'#equipo-table-card' },
  { scene:'scene-tracker', icon:'🌐', title:'Nodos del equipo — red activa',
    desc:'Vista consolidada de todos los nodos confirmados del equipo. Un nodo activo es el activo más valioso: ya está produciendo referidos sin necesitar intervención directa. Cultiva los que tienes y ayuda a crear nuevos.', h:'#nodos-equipo-card' },
  { scene:'scene-tracker', icon:'👤', title:'Desempeño individual — zoom por asesor',
    desc:'Selecciona cualquier asesor para ver sus indicadores en detalle: prospectos, contactos, tasa de reunión y sus nodos activos. Úsala para preparar las conversaciones de coaching.', h:'#kpi-ind' },
  { scene:'scene-tracker', icon:'★', title:'Nodos del asesor en la vista individual',
    desc:'Cada nodo aparece con nombre, número de activaciones y total de prospectos que ha dado. Este historial muestra el valor acumulado de cada relación y te ayuda a guiar conversaciones sobre cómo profundizar en ellos.', h:'#nodos-ind-card' },
  { scene:'scene-tracker', icon:'💵', title:'Ingresos mensuales — historial del asesor',
    desc:'Historial de ingresos reales vs. meta por asesor. Úsalo para identificar tendencias: si el asesor lleva 3 meses por debajo del 60%, es momento de revisar la meta o la estrategia de prospección.', h:'#ing-kpi' },
  { scene:'scene-tracker', icon:'📈', title:'Tabla histórica — evolución mensual',
    desc:'Mes a mes verás el sueldo base, bono y total real. El porcentaje de cumplimiento es el número más importante: muestra si el asesor se acerca o aleja de su meta de vida cada mes.', h:'#ing-table-card' },
  { scene:'scene-end', icon:'🎉', title:'¡Tutorial completado!',
    desc:'Ya tienes el mapa completo de las herramientas de supervisión. Simulador para planificar, Tracker para dar seguimiento, y Nodos para ver cómo la red de cada asesor cobra vida.', h:null, isEnd:true },
]

const PROXIS_SVG = (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
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
)

function ProxisLogo({ size = 17 }: { size?: number }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'7px',background:'#000',borderRadius:'8px',padding:'6px 12px'}}>
      {PROXIS_SVG}
      <span style={{fontWeight:800,fontSize:size,color:'white',letterSpacing:'-0.04em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
    </div>
  )
}

export default function TutorialSupervisora() {
  const [cur, setCur] = useState(0)
  const [activeScene, setActiveScene] = useState('scene-intro')
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({ display:'none' })
  const [userName, setUserName] = useState('Fernanda Peña')
  const [metaCalloutVisible, setMetaCalloutVisible] = useState(false)
  const [trackerTab, setTrackerTab] = useState<'equipo'|'individual'|'ingresos'>('equipo')
  const [metaSliderVal, setMetaSliderVal] = useState(2000000)
  const prevSceneRef = useRef<string|null>(null)
  const metaAnimRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const curRef = useRef(0)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('proxis_user') || 'null')
      if (user?.role === 'supervisor') setUserName(user.name)
    } catch {}
  }, [])

  const updateSpotlight = useCallback((sel: string|null) => {
    if (!sel) { setSpotlightStyle({ display:'none' }); return }
    const el = document.querySelector(sel)
    if (!el) { setSpotlightStyle({ display:'none' }); return }
    el.scrollIntoView({ behavior:'smooth', block:'center' })
    setTimeout(() => {
      const r = el.getBoundingClientRect(), p = 8
      setSpotlightStyle({
        display:'block',
        top: r.top - p,
        left: r.left - p,
        width: r.width + p * 2,
        height: r.height + p * 2,
        animation:'spulse 2s ease-in-out infinite',
      })
    }, 420)
  }, [])

  const animateMeta = useCallback(() => {
    if (metaAnimRef.current) clearInterval(metaAnimRef.current)
    let v = 500000
    setMetaSliderVal(v)
    metaAnimRef.current = setInterval(() => {
      v = Math.min(v + 80000, 2000000)
      setMetaSliderVal(v)
      if (v >= 2000000) { clearInterval(metaAnimRef.current!); metaAnimRef.current = null }
    }, 60)
  }, [])

  const goToStep = useCallback((n: number) => {
    n = Math.max(0, Math.min(n, STEPS.length - 1))
    const step = STEPS[n]
    curRef.current = n
    setCur(n)
    setActiveScene(step.scene)

    if (step.scene !== prevSceneRef.current) {
      const stage = document.getElementById('stage')
      if (stage) stage.scrollTop = 0
      prevSceneRef.current = step.scene
    }

    // tracker tab logic
    if (step.scene === 'scene-tracker') {
      if (n === 24 || n === 25) setTrackerTab('individual')
      else if (n === 26 || n === 27) setTrackerTab('ingresos')
      else setTrackerTab('equipo')
    }

    // meta callout logic
    if (n === 7) { setMetaCalloutVisible(true); animateMeta() }
    else setMetaCalloutVisible(false)

    setTimeout(() => updateSpotlight(step.h), 80)
  }, [animateMeta, updateSpotlight])

  const prevStep = useCallback(() => { if (curRef.current > 0) goToStep(curRef.current - 1) }, [goToStep])
  const nextStep = useCallback(() => { if (curRef.current < STEPS.length - 1) goToStep(curRef.current + 1) }, [goToStep])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextStep() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [nextStep, prevStep])

  useEffect(() => { goToStep(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const step = STEPS[cur]
  const firstName = userName.split(' ')[0]
  const progress = ((cur + 1) / STEPS.length * 100).toFixed(1)
  const fmtMeta = (v: number) => '$' + v.toLocaleString('es-CL').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  const sc = (id: string) => `scene${activeScene === id ? ' active' : ''}${id === 'scene-intro' || id === 'scene-login' || id === 'scene-end' ? ' centered' : ''}`

  const handleStageScroll = () => {
    const h = STEPS[curRef.current]?.h
    if (h) setTimeout(() => updateSpotlight(h), 50)
  }

  return (
    <>
      <style>{`
:root{
  --blue:#0b0a09;--blue-mid:#2a2926;--blue-lt:#f0eeeb;--blue-pale:#f7f6f3;
  --teal:#1a9e4a;--teal-lt:#e6f9ee;
  --lime:#cbf135;--lime-dk:#a8cc1a;
  --amber:#BA7517;--amber-lt:#FAEEDA;
  --red:#A32D2D;--red-lt:#FCEBEB;
  --g100:#F5F4F0;--g200:#E8E7E2;--g400:#9E9D97;--g700:#3C3B37;--g900:#1A1A18;
  --r:10px;--rl:16px;--guide-h:162px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-jakarta,sans-serif);background:var(--g100);color:var(--g900);font-size:14px;line-height:1.6;overflow:hidden;height:100vh}
#tut-wrap{display:flex;flex-direction:column;height:100vh}
#stage{flex:1;overflow-y:auto;overflow-x:hidden;position:relative}
.scene{display:none;min-height:calc(100vh - var(--guide-h))}
.scene.active{display:block}
.scene.centered{display:none;align-items:center;justify-content:center;background:var(--blue)}
.scene.centered.active{display:flex}
#scene-end.centered.active{background:#f0eeeb;background-image:radial-gradient(circle,rgba(0,0,0,0.1) 1px,transparent 1px);background-size:24px 24px}
#guide{height:var(--guide-h);flex-shrink:0;background:var(--blue);border-top:3px solid #1a5fa8;display:flex;flex-direction:column;z-index:600}
#g-progress{height:4px;background:rgba(255,255,255,.12)}
#g-fill{height:100%;background:#cbf135;border-radius:0 2px 2px 0;transition:width .4s ease}
#g-body{flex:1;display:flex;align-items:center;gap:16px;padding:10px 24px}
#g-icon{font-size:24px;flex-shrink:0;width:36px;text-align:center}
#g-text{flex:1;min-width:0}
#g-step{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#cbf135;margin-bottom:1px}
#g-title{font-size:14px;font-weight:600;color:white;margin-bottom:2px;line-height:1.2}
#g-desc{font-size:12px;color:rgba(255,255,255,.72);line-height:1.4}
#g-nav{display:flex;gap:8px;flex-shrink:0;align-items:center}
.nbtn{padding:8px 16px;border:none;border-radius:8px;font-family:var(--font-jakarta,sans-serif);font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap}
.nbtn-prev{background:rgba(255,255,255,.08);color:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.18)}
.nbtn-prev:hover{background:rgba(255,255,255,.15)}
.nbtn-prev:disabled{opacity:.3;cursor:not-allowed}
.nbtn-next{background:#cbf135;color:#003781}.nbtn-next:hover{background:#a8cc1a}
#g-hint{font-size:10px;color:rgba(255,255,255,.35);text-align:center;padding:4px 24px 8px}
#g-hint a{opacity:1!important}
#spotlight{position:fixed;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,25,70,.74);transition:all .42s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:400;display:none;outline:2.5px solid rgba(202,252,5,.7)}
@keyframes spulse{0%,100%{outline-color:rgba(202,252,5,.5)}50%{outline-color:rgba(202,252,5,1)}}
.sh{background:var(--blue);color:white;padding:10px 22px;display:flex;align-items:center;gap:12px;border-bottom:3px solid #0052b4}
.sh-div{width:1.5px;height:32px;background:rgba(255,255,255,.22);flex-shrink:0}
.sh-lbl{font-size:11px;font-weight:600;color:white;line-height:1.3}
.sh-lbl span{display:block;font-size:10px;opacity:.65;letter-spacing:.07em;text-transform:uppercase}
.sh-uf{font-size:11px;opacity:.8;margin-left:4px}
.sh-uf-badge{font-family:var(--font-mono,monospace);font-size:11px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:2px 9px}
.sh-role{font-size:12px;opacity:.8;margin-left:auto}.sh-role strong{font-weight:600}
.sh-out{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:white;font-family:var(--font-jakarta,sans-serif);font-size:12px;padding:5px 12px;border-radius:20px;cursor:pointer;margin-left:8px}
.mb{background:white;border-bottom:2px solid var(--g200);padding:0 22px;display:flex;gap:0}
.mb-btn{padding:13px 20px;font-size:13px;font-weight:600;color:var(--g400);border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap;cursor:pointer}
.mb-btn.on{color:var(--blue);border-bottom-color:var(--blue)}
.sim-wrap{display:grid;grid-template-columns:380px 1fr;min-height:calc(100vh - var(--guide-h) - 94px)}
.sim-left{background:white;border-right:1px solid var(--g200);padding:20px;overflow-y:auto}
.sim-right{padding:20px 24px;background:var(--g100)}
.stabs{display:flex;border-bottom:1px solid var(--g200);background:var(--g100);padding:0 22px;overflow-x:auto}
.stab{padding:10px 16px;font-size:13px;font-weight:500;color:var(--g400);border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;cursor:default}
.stab.on{color:var(--blue);border-bottom-color:var(--blue)}
.sc{padding:20px 22px}
.stitle{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--g400);margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--g200);margin-top:16px}
.stitle:first-child{margin-top:0}
.fg{margin-bottom:11px}
.flbl{font-size:12px;font-weight:500;color:var(--g700);display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
.flbl span{font-family:var(--font-mono,monospace);font-size:12px;font-weight:500;color:var(--blue);background:var(--blue-pale);padding:2px 7px;border-radius:6px}
input[type=range]{width:100%;height:4px;-webkit-appearance:none;appearance:none;background:var(--g200);border-radius:2px;outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--blue);border:3px solid white;box-shadow:0 0 0 1.5px var(--blue);cursor:pointer}
select.fsel{width:100%;padding:8px 12px;border:1.5px solid var(--g200);border-radius:var(--r);font-family:var(--font-jakarta,sans-serif);font-size:13px;color:var(--g900);background:white;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239E9D97' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer}
.metodo-row{display:grid;grid-template-columns:1fr 80px;gap:8px;align-items:center;background:var(--g100);border-radius:var(--r);padding:8px 10px;margin-bottom:5px;border:1px solid transparent}
.metodo-row.on{border-color:var(--blue-mid);background:var(--blue-pale)}
.metodo-name{font-size:12px;font-weight:600;color:var(--g700)}
.metodo-row.on .metodo-name{color:var(--blue)}
.metodo-sub{font-size:11px;color:var(--g400);line-height:1.3}
.metodo-tag{font-size:10px;font-family:var(--font-mono,monospace);background:var(--teal-lt);color:var(--teal);padding:1px 6px;border-radius:5px;margin-top:3px;display:inline-block}
.mpct-wrap{display:flex;align-items:center;gap:3px;justify-content:flex-end}
.mpct-wrap button{width:20px;height:20px;border-radius:5px;border:1.5px solid var(--g200);background:white;font-size:12px;cursor:pointer;color:var(--g700);display:flex;align-items:center;justify-content:center;line-height:1;font-family:var(--font-mono,monospace)}
.mpct-num{font-family:var(--font-mono,monospace);font-size:13px;font-weight:500;color:var(--blue);min-width:30px;text-align:center}
.prod-row{display:grid;grid-template-columns:1fr 86px;gap:8px;align-items:center;background:var(--g100);border-radius:var(--r);padding:7px 10px;border:1px solid var(--g200);margin-bottom:4px}
.prod-name{font-size:12px;font-weight:500;color:var(--g700)}
.prod-sub{font-size:11px;color:var(--g400)}
.mix-qty{display:flex;align-items:center;gap:3px;justify-content:flex-end}
.mix-qty button{width:22px;height:22px;border-radius:5px;border:1.5px solid var(--g200);background:white;font-size:13px;cursor:pointer;color:var(--g700);display:flex;align-items:center;justify-content:center;line-height:1}
.mix-qty-n{font-family:var(--font-mono,monospace);font-size:13px;font-weight:500;color:var(--blue);min-width:18px;text-align:center}
.toggle-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.toggle-lbl{font-size:12px;color:var(--g700);flex:1}
.toggle-sw{position:relative;width:38px;height:20px;cursor:pointer;flex-shrink:0}
.toggle-sw input{opacity:0;width:0;height:0}
.toggle-sl{position:absolute;inset:0;background:var(--g200);border-radius:10px;transition:.3s}
.toggle-sl::before{content:'';position:absolute;width:14px;height:14px;left:3px;top:3px;background:white;border-radius:50%;transition:.3s}
.toggle-sw input:checked+.toggle-sl{background:var(--blue)}
.toggle-sw input:checked+.toggle-sl::before{transform:translateX(18px)}
.res-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
.res-card{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:14px 16px}
.res-card.highlight{border-color:var(--red);border-width:2px}
.res-lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--g400);margin-bottom:6px}
.res-val{font-size:22px;font-weight:600;font-family:var(--font-mono,monospace);color:var(--g900);letter-spacing:-.5px}
.res-card.highlight .res-val{color:var(--red)}
.res-sub{font-size:11px;color:var(--g400);margin-top:3px}
.fbar-row{display:grid;grid-template-columns:100px 1fr 50px 110px;align-items:center;gap:10px;margin-bottom:9px}
.fbar-lbl{font-size:12px;font-weight:500;color:var(--g700)}
.fbar-wrap{height:32px;background:var(--g100);border-radius:8px;overflow:hidden}
.fbar{height:100%;border-radius:8px;display:flex;align-items:center;padding-left:10px;font-size:12px;font-weight:600;transition:width .5s;min-width:30px}
.fbar-c{background:#B5D4F4;color:#0C447C}
.fbar-p{background:#9FE1CB;color:#085041}
.fbar-v{background:#003781;color:white}
.fbar-num{font-family:var(--font-mono,monospace);font-size:18px;font-weight:500;text-align:right}
.fbar-eq{font-size:11px;color:var(--g400);text-align:right;line-height:1.3}
.prosp-chips{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.chip{border-radius:var(--r);padding:10px 14px;border:1px solid var(--g200)}
.chip.blue{background:var(--blue-lt);border-color:var(--blue-mid)}
.chip.amber{background:var(--amber-lt);border-color:rgba(186,117,23,.25)}
.chip-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);margin-bottom:4px}
.chip.blue .chip-lbl{color:var(--blue-mid)}
.chip.amber .chip-lbl{color:var(--amber)}
.chip-val{font-size:28px;font-weight:600;font-family:var(--font-mono,monospace);color:var(--g900)}
.chip.blue .chip-val{color:var(--blue)}
.chip.amber .chip-val{color:var(--amber)}
.chip-sub{font-size:11px;color:var(--g400)}
.dt{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
.dt th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);padding:6px 8px;border-bottom:1px solid var(--g200)}
.dt td{padding:8px;border-bottom:1px solid var(--g100);color:var(--g700)}
.dt td:first-child{color:var(--g900);font-weight:500}
.dt tfoot td{font-weight:600;color:var(--g900);border-top:2px solid var(--g200)}
.pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
.pill-bl{background:var(--blue-lt);color:var(--blue)}
.pill-tl{background:var(--teal-lt);color:var(--teal)}
.tag-camp{background:var(--amber-lt);color:var(--amber);font-size:10px;font-weight:600;padding:2px 6px;border-radius:5px;white-space:nowrap}
.tag-only{background:#FEF3C7;color:#92400E;font-size:10px;padding:2px 6px;border-radius:5px;white-space:nowrap}
.ib{padding:10px 14px;border-radius:var(--r);font-size:12px;line-height:1.5;margin-bottom:12px}
.ib.rd{background:var(--red-lt);color:var(--red);border-left:3px solid var(--red)}
.ib.bl{background:var(--blue-lt);color:var(--blue);border-left:3px solid var(--blue-mid)}
.ib.tl{background:var(--teal-lt);color:var(--teal);border-left:3px solid var(--teal)}
.ib.am{background:var(--amber-lt);color:#7a4d0a;border-left:3px solid var(--amber)}
.ib strong{font-weight:600}
.card{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:18px 20px;margin-bottom:14px}
.ctitle{font-size:13px;font-weight:600;color:var(--g700);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.ctitle::before{content:'';display:block;width:4px;height:16px;background:var(--blue);border-radius:2px}
.mc{background:var(--g100);border-radius:var(--r);padding:12px 14px;position:relative}
.mc.ok{background:var(--teal-lt);border:1px solid rgba(15,110,86,.2)}
.mc.warn{background:var(--amber-lt);border:1px solid rgba(186,117,23,.2)}
.mc.bad{background:var(--red-lt);border:1px solid rgba(163,45,45,.2)}
.mc-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);margin-bottom:4px}
.mc.ok .mc-lbl{color:var(--teal)}.mc.warn .mc-lbl{color:var(--amber)}.mc.bad .mc-lbl{color:var(--red)}
.mc-val{font-size:20px;font-weight:600;font-family:var(--font-mono,monospace);color:var(--g900)}
.mc.ok .mc-val{color:var(--teal)}.mc.warn .mc-val{color:var(--amber)}.mc.bad .mc-val{color:var(--red)}
.mc-sub{font-size:11px;color:var(--g400);margin-top:2px}
.mcg4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.mcg2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.eq-table{width:100%;border-collapse:collapse;font-size:12px}
.eq-table th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);padding:6px 10px;border-bottom:1px solid var(--g200)}
.eq-table td{padding:8px 10px;border-bottom:1px solid var(--g100);color:var(--g700)}
.eq-table td:first-child{font-weight:600;color:var(--g900)}
.bar-mini-wrap{height:8px;background:var(--g200);border-radius:4px;overflow:hidden;min-width:80px}
.bar-mini{height:100%;border-radius:4px}
.bar-ok{background:#22c55e}.bar-warn{background:#f59e0b}.bar-bad{background:#ef4444}
.sem{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px}
.sem-ok{background:#22c55e}.sem-warn{background:#f59e0b}.sem-rd{background:#ef4444}
.nodo-card-s{background:white;border:2px solid var(--teal);border-radius:var(--rl);padding:14px 16px;margin-bottom:10px}
.nodo-av{width:34px;height:34px;border-radius:50%;background:var(--teal);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;flex-shrink:0}
.btn{padding:10px 18px;border:none;border-radius:var(--r);font-family:var(--font-jakarta,sans-serif);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.btn-pri{background:var(--blue);color:white}
.btn-suc{background:var(--teal-lt);color:var(--teal);border:1.5px solid var(--teal)}
.btn-w{width:100%;justify-content:center}
.btn-lg{padding:13px 22px;font-size:14px}
#meta-callout{display:none;background:linear-gradient(135deg,#E6F1FB 0%,#F0F6FF 100%);border:1.5px solid var(--blue-mid);border-radius:var(--rl);padding:14px 16px;margin-top:10px;font-size:12px;color:var(--blue);line-height:1.6}
#meta-callout.show{display:block}
.intro-card,.end-card{background:white;border-radius:20px;padding:44px 36px;max-width:520px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.32);margin:24px}
.lcard{background:white;border-radius:20px;padding:36px 32px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.lfld{margin-bottom:14px}
.lfld label{display:block;font-size:12px;font-weight:500;color:var(--g700);margin-bottom:6px}
.lfld select,.lfld input{width:100%;padding:11px 14px;border:1.5px solid var(--g200);border-radius:var(--r);font-family:var(--font-jakarta,sans-serif);font-size:14px;color:var(--g900);background:white;outline:none;appearance:none}
.lfld input[type=password]{letter-spacing:.1em}
@media(max-width:900px){.sim-wrap{grid-template-columns:1fr}.sim-left{max-height:none}}
`}</style>

      <div id="tut-wrap">
        <div id="stage" onScroll={handleStageScroll}>

          {/* ═══ INTRO ═══ */}
          <div className={sc('scene-intro')} id="scene-intro" style={{background:'#0b0a09'}}>
            <div className="intro-card">
              <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'#0b0a09',padding:'10px 16px',borderRadius:'12px',marginBottom:'22px'}}>
                {PROXIS_SVG}
                <span style={{fontWeight:800,fontSize:'17px',color:'white',letterSpacing:'-0.04em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
              </div>
              <div style={{display:'inline-block',background:'rgba(202,252,5,.15)',color:'#cbf135',fontSize:'11px',fontWeight:600,padding:'4px 14px',borderRadius:'20px',marginBottom:'14px',letterSpacing:'.05em',border:'1px solid rgba(202,252,5,.3)'}}>📊 Tutorial para Supervisoras</div>
              <h1 style={{fontSize:'24px',fontWeight:700,color:'#0b0a09',marginBottom:'10px',lineHeight:1.2,letterSpacing:'-0.03em'}}>
                {firstName ? `Hola, ${firstName}. Aprende a usar el Simulador de Metas y el Tracker` : 'Aprende a usar el Simulador de Metas y el Tracker'}
              </h1>
              <p style={{fontSize:'13px',color:'#4a4844',lineHeight:1.7,marginBottom:'22px'}}>Aprenderás a simular los ingresos de cada asesor, configurar metas y revisar el desempeño del equipo. Usa ← → o Espacio para navegar.</p>
              <div style={{background:'#f0eeeb',borderRadius:'12px',padding:'14px 16px',textAlign:'left',fontSize:'13px',color:'#3C3B37',display:'flex',flexDirection:'column',gap:'9px',marginBottom:'22px'}}>
                <div>📊 <strong>Simulador de Metas</strong> — Proyecta ingresos y define objetivos por asesor</div>
                <div>📋 <strong>Tracker de Prospección</strong> — Desempeño del equipo, nodos y actividad semanal</div>
                <div>💾 <strong>Guardar y vincular</strong> — Las metas simuladas pasan directo al Tracker</div>
              </div>
              <button className="btn btn-lg" style={{background:'#cbf135',color:'#0b0a09',fontWeight:700,width:'100%',justifyContent:'center'}} onClick={nextStep}>Comenzar el tutorial →</button>
            </div>
          </div>

          {/* ═══ LOGIN ═══ */}
          <div className={sc('scene-login')} id="scene-login" style={{background:'var(--blue)'}}>
            <div className="lcard">
              <div style={{display:'flex',alignItems:'center',gap:'8px',background:'#000',borderRadius:'10px',padding:'10px 14px',marginBottom:'20px'}}>
                {PROXIS_SVG}
                <span style={{fontWeight:800,fontSize:'17px',color:'white',letterSpacing:'-0.04em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
              </div>
              <div style={{fontSize:'18px',fontWeight:600,color:'var(--blue)',marginBottom:'4px'}}>Acceso a tu cuenta</div>
              <div style={{fontSize:'13px',color:'var(--g400)',marginBottom:'22px'}}>Selecciona tu nombre e ingresa tu clave personal</div>
              <div className="lfld" id="l-name">
                <label>Nombre</label>
                <select style={{borderColor:'var(--blue)',backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239E9D97' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:'36px'}}>
                  <option>Fernanda Peña</option>
                </select>
              </div>
              <div className="lfld" id="l-pass">
                <label>Clave personal</label>
                <input type="password" defaultValue="fernanda2026" readOnly />
              </div>
              <div id="l-btn">
                <button className="btn btn-pri btn-w" onClick={() => goToStep(4)}>Entrar →</button>
              </div>
              <div style={{fontSize:'11px',color:'var(--g400)',textAlign:'center',marginTop:'16px'}}>The Precision Selling · Chile</div>
            </div>
          </div>

          {/* ═══ SIMULADOR ═══ */}
          <div className={sc('scene-sim')} id="scene-sim">
            <div className="sh">
              <ProxisLogo />
              <div className="sh-div"></div>
              <div className="sh-lbl">Proxis<span>Prospección en práctica</span></div>
              <div className="sh-uf" style={{marginLeft:'14px'}}>UF: <span className="sh-uf-badge">$40.080</span></div>
              <div className="sh-role">{userName} · <strong>Supervisora</strong></div>
              <a href="/" style={{fontSize:'12px',color:'rgba(255,255,255,.5)',textDecoration:'none',padding:'4px 10px',border:'1px solid rgba(255,255,255,.15)',borderRadius:'20px',transition:'all .15s',marginLeft:'auto'}}>← Proxis</a>
              <button className="sh-out">Salir</button>
            </div>
            <div className="mb" id="module-bar">
              <div className="mb-btn on" id="mod-btn-sim">📊 Simulador de Metas</div>
              <div className="mb-btn" id="mod-btn-tracker" onClick={() => goToStep(21)}>📋 Tracker de Prospección</div>
            </div>

            <div className="sim-wrap">
              {/* LEFT */}
              <div className="sim-left" id="sim-left">
                <div className="stitle" style={{marginTop:0}}>Selección de asesor</div>
                <div className="fg" id="asesor-sel-wrap">
                  <div className="flbl">Asesor a simular</div>
                  <select className="fsel" id="asesor-sel">
                    <option>Francisca Rivadeneyra</option>
                    <option>Sebastián Molina</option>
                    <option>Valentina Cruz</option>
                    <option>Andrés Poblete</option>
                  </select>
                </div>
                <div className="fg" id="ant-wrap">
                  <div className="flbl">Antigüedad del asesor <span id="lbl-ant">12 meses</span></div>
                  <input type="range" id="sl-ant" min="1" max="120" defaultValue="12" readOnly />
                </div>
                <div className="fg" id="meta-wrap">
                  <div className="flbl">Meta de ingreso mensual <span id="lbl-meta">{fmtMeta(metaSliderVal)}</span></div>
                  <input type="range" id="sl-meta" min="500000" max="8000000" step="50000" value={metaSliderVal} readOnly onChange={() => {}} />
                  <div id="meta-callout" className={metaCalloutVisible ? 'show' : ''}>
                    <strong>💡 ¿Cómo se define esta meta?</strong><br/>
                    Es el ingreso que el asesor necesita para cubrir sus gastos familiares y avanzar hacia sus sueños personales: vivienda, educación de los hijos, ahorro y bienestar. Se construye en una conversación inicial entre asesor y supervisor — no la impone el sistema, la define la persona. Una meta conectada a un sueño real tiene más poder de motivación que un número arbitrario.
                  </div>
                </div>
                <div className="fg" id="persist-wrap">
                  <div className="flbl">Persistencia real estimada <span id="lbl-persist">90%</span></div>
                  <input type="range" id="sl-persist" min="0" max="120" defaultValue="90" readOnly />
                  <div style={{marginTop:'6px',fontSize:'11px',color:'var(--g700)',background:'var(--blue-lt)',padding:'7px 10px',borderRadius:'8px'}}>
                    Mínima exigida (mes 12): <strong>90%</strong> · Cumplimiento: <strong>100% → 100% del bono</strong>
                  </div>
                </div>

                <div className="stitle">Modo de contrato</div>
                <div id="camp-wrap">
                  <div className="toggle-row">
                    <div className="toggle-lbl" style={{fontWeight:600}}>Activar campaña 2026</div>
                    <label className="toggle-sw"><input type="checkbox" defaultChecked readOnly /><div className="toggle-sl"></div></label>
                  </div>
                  <div className="ib am" style={{fontSize:'11px',marginBottom:0}}>Campaña Activa 2026: el Factor de Producción de Plan Ahorro Previsional sube al 100%, ampliando el bono de manera significativa.</div>
                </div>

                <div className="stitle">Origen de prospectos referidos</div>
                <div id="prosp-wrap">
                  <div className="ib am" style={{marginBottom:'8px',fontSize:'11px'}}><strong>Define el % por método</strong> (pasos de 5%). Meta: ≥80% Contactos/Nodos Referidores.</div>
                  <div className="metodo-row on">
                    <div>
                      <div className="metodo-name">Prospectos Referidos por Contactos / Nodos</div>
                      <div className="metodo-sub">Pre-calificados por clientes, familiares, amigos y conocidos, transferidos con patrocinio.</div>
                      <div className="metodo-tag">3 prospectos → 1 venta</div>
                    </div>
                    <div className="mpct-wrap"><button>−</button><div className="mpct-num">80%</div><button>+</button></div>
                  </div>
                  <div className="metodo-row" style={{marginTop:'4px'}}>
                    <div>
                      <div className="metodo-name" style={{color:'var(--amber)'}}>Leads digitales de alta intención</div>
                      <div className="metodo-sub">Solicitudes directas vía formularios o ads. Alta intención pero menor conversión.</div>
                      <div className="metodo-tag" style={{background:'var(--amber-lt)',color:'var(--amber)'}}>5 prospectos → 1 venta</div>
                    </div>
                    <div className="mpct-wrap"><button>−</button><div className="mpct-num" style={{color:'var(--amber)'}}>20%</div><button>+</button></div>
                  </div>
                </div>

                <div className="stitle">Mix de productos mensual</div>
                <div id="mix-wrap">
                  <div className="ib am" style={{fontSize:'11px',marginBottom:'8px'}}>Número de pólizas por tipo en un mes típico.</div>
                  <div className="prod-row" style={{borderColor:'var(--blue-mid)',background:'var(--blue-pale)'}}>
                    <div><div className="prod-name" style={{color:'var(--blue)'}}>Vida Protegida</div><div className="prod-sub">FP 200% · Com: 32%</div></div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">1</div><button>+</button></div>
                  </div>
                  <div className="prod-row">
                    <div><div className="prod-name">Cobertura Mujer</div><div className="prod-sub">FP 200% · Com: 32%</div></div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">0</div><button>+</button></div>
                  </div>
                  <div className="prod-row">
                    <div><div className="prod-name">Vida Temporal</div><div className="prod-sub">FP 100% · Com: 15%</div></div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">0</div><button>+</button></div>
                  </div>
                  <div className="prod-row">
                    <div><div className="prod-name">Accidentes Personales</div><div className="prod-sub">FP 100% · Com: 8%</div></div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">0</div><button>+</button></div>
                  </div>
                  <div className="prod-row" style={{borderColor:'var(--blue-mid)',background:'var(--blue-pale)'}}>
                    <div>
                      <div className="prod-name" style={{color:'var(--blue)'}}>Plan Ahorro Previsional <span className="tag-camp">campaña 100%</span></div>
                      <div className="prod-sub">FP 50% → FP campaña 100% · Com: 4%</div>
                    </div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">1</div><button>+</button></div>
                  </div>
                  <div className="prod-row">
                    <div><div className="prod-name">Vida Flexible</div><div className="prod-sub">FP 50% · Com: 8%</div></div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">0</div><button>+</button></div>
                  </div>
                  <div className="prod-row">
                    <div><div className="prod-name">Salud Complementaria</div><div className="prod-sub">FP 50% · Com: 8%</div></div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">0</div><button>+</button></div>
                  </div>
                  <div className="prod-row">
                    <div><div className="prod-name">Renta Prima Única <span className="tag-only">prima única</span></div><div className="prod-sub">FP 0% · Com: 5%</div></div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">0</div><button>+</button></div>
                  </div>
                  <div className="prod-row">
                    <div><div className="prod-name">Ahorro Flexible</div><div className="prod-sub">FP 25% · Com: 4%</div></div>
                    <div className="mix-qty"><button>−</button><div className="mix-qty-n">0</div><button>+</button></div>
                  </div>
                </div>

                <div className="stitle">Prima mensual promedio por producto</div>
                <div id="prima-wrap">
                  <div className="fg">
                    <div className="flbl">Vida Protegida <span>$200.000</span></div>
                    <input type="range" min="50000" max="500000" defaultValue="200000" readOnly />
                  </div>
                  <div className="fg">
                    <div className="flbl">Plan Ahorro Previsional <span>$200.000</span></div>
                    <input type="range" min="50000" max="500000" defaultValue="200000" readOnly />
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="sim-right" id="sim-right">
                <div className="ib rd" id="meta-status-box">
                  <strong>Meta no alcanzada.</strong> Ingreso: $1.169.797 · Brecha: $830.203.
                </div>
                <div style={{display:'flex',gap:'10px',marginBottom:'12px',flexWrap:'wrap'}}>
                  <button className="btn btn-suc" id="guardar-btn" style={{flex:1,justifyContent:'center'}}>📊 Guardar metas de Francisca Rivadeneyra en Tracker</button>
                  <button className="btn" style={{background:'var(--blue)',color:'white',flex:1,justifyContent:'center'}}>📄 Generar Informe PDF — <strong>Francisca Rivadeneyra</strong></button>
                </div>
                <div style={{fontSize:'12px',color:'var(--g400)',marginBottom:'14px'}}>Francisca Rivadeneyra · Contactos/sem: 1 · Prospectos/mes: 23 · Ventas/mes: 2 · Meta ingresos: $1.169.797</div>

                <div className="res-3" id="res-cards">
                  <div className="res-card"><div className="res-lbl">Sueldo base</div><div className="res-val">$539.000</div><div className="res-sub">Sueldo mínimo vigente</div></div>
                  <div className="res-card"><div className="res-lbl">Bono producción</div><div className="res-val">$558.797</div><div className="res-sub">13.94 UF × 100% persist.</div></div>
                  <div className="res-card highlight"><div className="res-lbl">Total estimado</div><div className="res-val">$1.169.797</div><div className="res-sub">PP: 119.8 → ef. 119.8/1500</div></div>
                </div>

                <div className="card" id="prosp-funnel">
                  <div className="ctitle">Prospectos Referidos por Contactos / Nodos</div>
                  <div className="prosp-chips">
                    <div className="chip blue"><div className="chip-lbl">Prospectos Referidos por Contactos…</div><div className="chip-val">20</div><div className="chip-sub">80% · 20 prosp. · 5 cont.</div></div>
                    <div className="chip amber"><div className="chip-lbl">Leads de captación digital…</div><div className="chip-val">3</div><div className="chip-sub">20% · 3 prosp.</div></div>
                  </div>
                  <div id="funnel-rows">
                    <div className="fbar-row">
                      <div className="fbar-lbl">Contactos</div>
                      <div className="fbar-wrap"><div className="fbar fbar-c" style={{width:'50%'}}>5</div></div>
                      <div className="fbar-num">5</div>
                      <div className="fbar-eq">2 contactos por semana</div>
                    </div>
                    <div className="fbar-row">
                      <div className="fbar-lbl">Prospectos</div>
                      <div className="fbar-wrap"><div className="fbar fbar-p" style={{width:'80%'}}>23</div></div>
                      <div className="fbar-num">23</div>
                      <div className="fbar-eq">4.6 por contacto</div>
                    </div>
                    <div className="fbar-row">
                      <div className="fbar-lbl">Ventas / Pólizas</div>
                      <div className="fbar-wrap"><div className="fbar fbar-v" style={{width:'20%'}}>2</div></div>
                      <div className="fbar-num">2</div>
                      <div className="fbar-eq">2 pólizas/mes</div>
                    </div>
                  </div>
                </div>

                <div className="card" id="tasas-card">
                  <div className="ctitle">Tasas de cierre de referencia</div>
                  <table className="dt">
                    <thead><tr><th>Origen del prospecto</th><th>Tasa de cierre</th><th>Prospectos / venta</th></tr></thead>
                    <tbody>
                      <tr><td>Sin referido</td><td>10–15%</td><td style={{fontFamily:'var(--font-mono,monospace)',color:'var(--red)',fontWeight:600}}>7–10</td></tr>
                      <tr><td>Referido (nombre dado)</td><td>25–30%</td><td style={{fontFamily:'var(--font-mono,monospace)',color:'var(--amber)',fontWeight:600}}>3–4</td></tr>
                      <tr><td>Referido con presentación del nodo</td><td>40–50%</td><td style={{fontFamily:'var(--font-mono,monospace)',color:'var(--teal)',fontWeight:600}}>2–3</td></tr>
                      <tr><td>Transferencia en vivo (nodo presenta)</td><td>55–70%</td><td style={{fontFamily:'var(--font-mono,monospace)',color:'var(--teal)',fontWeight:600}}>1–2</td></tr>
                    </tbody>
                  </table>
                  <div style={{marginTop:'10px',background:'var(--g100)',borderRadius:'8px',padding:'10px 12px',fontSize:'11px',color:'var(--g700)',lineHeight:1.6,borderLeft:'3px solid var(--blue)'}}>
                    <strong>Sistema TPS — Nodos Referidores:</strong> 1 contacto/nodo activo genera en promedio 5 prospectos referidos. Con presentación activa del nodo, la tasa de cierre base alcanza 50–65%, resultando en 1.5–2 ventas por nodo.
                  </div>
                </div>

                <div className="card" id="mix-desglose">
                  <div className="ctitle">Desglose del mix — Campaña Complemento Producción Emitida</div>
                  <table className="dt">
                    <thead><tr><th>Producto</th><th>Pólizas</th><th>Factor producción</th><th>PPA (UF)</th><th>Puntos Prod.</th><th>Comisión venta</th><th>Nota</th></tr></thead>
                    <tbody>
                      <tr><td>Vida Protegida</td><td>1</td><td>100%</td><td>59.88</td><td style={{fontFamily:'var(--font-mono,monospace)',fontWeight:600}}>59.9</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>$64.000</td><td><span className="tag-camp">campaña 100%</span></td></tr>
                      <tr><td>Plan Ahorro Previsional</td><td>1</td><td>100%</td><td>59.88</td><td style={{fontFamily:'var(--font-mono,monospace)',fontWeight:600}}>59.9</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>$8.000</td><td><span className="tag-camp">campaña 100%</span></td></tr>
                    </tbody>
                    <tfoot>
                      <tr><td>Total</td><td>2</td><td>—</td><td>—</td><td style={{fontFamily:'var(--font-mono,monospace)',fontWeight:700,color:'var(--blue)'}}>119.8 PP</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>$72.000</td><td></td></tr>
                    </tfoot>
                  </table>
                  <div style={{marginTop:'14px'}}>
                    <div className="ctitle" style={{marginBottom:'8px'}}>Puntos de campaña — Desglose por póliza</div>
                    <table className="dt">
                      <thead><tr><th>Producto</th><th>Pólizas</th><th>Fact. Campaña</th><th>PPA (UF)</th><th>PP Campaña</th><th>Tope por póliza</th><th>Nota</th></tr></thead>
                      <tbody>
                        <tr><td>Vida Protegida</td><td>1</td><td>100%</td><td>59.88</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>59.9</td><td style={{fontFamily:'var(--font-mono,monospace)',color:'var(--g400)'}}>300 PP/pól.</td><td></td></tr>
                        <tr><td>Plan Ahorro Previsional</td><td>1</td><td>100%</td><td>59.88</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>59.9</td><td style={{fontFamily:'var(--font-mono,monospace)',color:'var(--g400)'}}>600 PP/pól.</td><td><span className="tag-only">Solo sobre UF500</span></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card" id="bono-card">
                  <div className="ctitle">Conversión Puntos de Producción → Bono en UF</div>
                  <table className="dt">
                    <thead><tr><th>Tramo PP</th><th>Puntos aplicados</th><th>%</th><th>UF generadas</th><th>$ CLP</th></tr></thead>
                    <tbody>
                      <tr><td>0 – 49.9</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>49.9</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>10%</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>4.99 UF</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>$200.001</td></tr>
                      <tr><td>50 – 99.9</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>49.9</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>12%</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>5.99 UF</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>$240.001</td></tr>
                      <tr><td>100 – 149.9</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>19.8</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>15%</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>2.96 UF</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>$118.796</td></tr>
                      <tr><td>150 – 299.9</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>0</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>18%</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>0 UF</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>$0</td></tr>
                    </tbody>
                    <tfoot>
                      <tr><td>Total</td><td style={{fontFamily:'var(--font-mono,monospace)'}}>119.8 PP</td><td></td><td style={{fontFamily:'var(--font-mono,monospace)',color:'var(--teal)'}}>13.94 UF</td><td style={{fontFamily:'var(--font-mono,monospace)',color:'var(--teal)'}}>$558.797</td></tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ TRACKER ═══ */}
          <div className={sc('scene-tracker')} id="scene-tracker">
            <div className="sh">
              <ProxisLogo />
              <div className="sh-div"></div>
              <div className="sh-lbl">Proxis<span>Prospección en práctica</span></div>
              <div className="sh-uf" style={{marginLeft:'14px'}}>UF: <span className="sh-uf-badge">$40.080</span></div>
              <div className="sh-role">{userName} · <strong>Supervisora</strong></div>
              <a href="/" style={{fontSize:'12px',color:'rgba(255,255,255,.5)',textDecoration:'none',padding:'4px 10px',border:'1px solid rgba(255,255,255,.15)',borderRadius:'20px',marginLeft:'auto'}}>← Proxis</a>
              <button className="sh-out">Salir</button>
            </div>
            <div className="mb">
              <div className="mb-btn" onClick={() => goToStep(4)}>📊 Simulador de Metas</div>
              <div className="mb-btn on">📋 Tracker de Prospección</div>
            </div>
            <div className="stabs" id="tracker-tabs">
              <div className={`stab${trackerTab === 'equipo' ? ' on' : ''}`} id="tab-equipo">Equipo completo</div>
              <div className={`stab${trackerTab === 'individual' ? ' on' : ''}`} id="tab-individual">Desempeño individual</div>
              <div className={`stab${trackerTab === 'ingresos' ? ' on' : ''}`} id="tab-ingresos">Ingresos mensuales</div>
            </div>

            {/* panel equipo */}
            <div id="panel-equipo" className="sc" style={{display: trackerTab === 'equipo' ? 'block' : 'none'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',flexWrap:'wrap',gap:'8px'}}>
                <div style={{fontWeight:600,fontSize:'15px',color:'var(--g900)'}}>Mes en curso: <span style={{color:'var(--blue)'}}>abril 2026</span></div>
                <select style={{padding:'6px 12px',border:'1.5px solid var(--g200)',borderRadius:'8px',fontFamily:'var(--font-jakarta,sans-serif)',fontSize:'13px',background:'white',appearance:'none'}}><option>abril 2026</option></select>
              </div>
              <div className="mcg4" id="kpi-equipo">
                <div className="mc ok"><div className="mc-lbl">Prospectos totales</div><div className="mc-val">47</div><div className="mc-sub">4 asesores activos</div></div>
                <div className="mc warn"><div className="mc-lbl">Contactos realizados</div><div className="mc-val">28</div><div className="mc-sub">prom. 7 por asesor</div></div>
                <div className="mc warn"><div className="mc-lbl">Tasa de reunión</div><div className="mc-val">54%</div><div className="mc-sub">Meta equipo: ≥60%</div></div>
                <div className="mc ok"><div className="mc-lbl">Nodos activos</div><div className="mc-val">3</div><div className="mc-sub">en 4 asesores</div></div>
              </div>
              <div className="card" id="equipo-table-card">
                <div className="ctitle">Desempeño por asesor — abril 2026</div>
                <div style={{overflowX:'auto'}}>
                  <table className="eq-table">
                    <thead><tr><th>Asesor</th><th>Meta ingreso</th><th>Prospectos</th><th>Contactos</th><th>Tasa reunión</th><th>Eficiencia</th><th>Nodos</th><th>Estado</th></tr></thead>
                    <tbody>
                      <tr>
                        <td>Francisca Rivadeneyra</td>
                        <td style={{fontFamily:'var(--font-mono,monospace)',fontSize:'12px'}}>$2.000.000</td>
                        <td><strong>10</strong></td><td>17</td><td>41%</td>
                        <td><div className="bar-mini-wrap"><div className="bar-mini bar-bad" style={{width:'12%'}}></div></div><div style={{fontSize:'10px',color:'var(--red)',fontFamily:'var(--font-mono,monospace)'}}>12%</div></td>
                        <td><span className="sem sem-warn"></span>1</td>
                        <td><span className="pill" style={{background:'var(--amber-lt)',color:'var(--amber)'}}>En progreso</span></td>
                      </tr>
                      <tr>
                        <td>Sebastián Molina</td>
                        <td style={{fontFamily:'var(--font-mono,monospace)',fontSize:'12px'}}>$1.800.000</td>
                        <td><strong>18</strong></td><td>5</td><td>80%</td>
                        <td><div className="bar-mini-wrap"><div className="bar-mini bar-ok" style={{width:'72%'}}></div></div><div style={{fontSize:'10px',color:'var(--teal)',fontFamily:'var(--font-mono,monospace)'}}>72%</div></td>
                        <td><span className="sem sem-ok"></span>2</td>
                        <td><span className="pill" style={{background:'var(--teal-lt)',color:'var(--teal)'}}>En meta</span></td>
                      </tr>
                      <tr>
                        <td>Valentina Cruz</td>
                        <td style={{fontFamily:'var(--font-mono,monospace)',fontSize:'12px'}}>$1.500.000</td>
                        <td><strong>12</strong></td><td>4</td><td>75%</td>
                        <td><div className="bar-mini-wrap"><div className="bar-mini bar-ok" style={{width:'60%'}}></div></div><div style={{fontSize:'10px',color:'var(--teal)',fontFamily:'var(--font-mono,monospace)'}}>60%</div></td>
                        <td><span className="sem sem-warn"></span>0</td>
                        <td><span className="pill" style={{background:'var(--amber-lt)',color:'var(--amber)'}}>En progreso</span></td>
                      </tr>
                      <tr>
                        <td>Andrés Poblete</td>
                        <td style={{fontFamily:'var(--font-mono,monospace)',fontSize:'12px'}}>$2.200.000</td>
                        <td><strong>7</strong></td><td>2</td><td>50%</td>
                        <td><div className="bar-mini-wrap"><div className="bar-mini bar-bad" style={{width:'14%'}}></div></div><div style={{fontSize:'10px',color:'var(--red)',fontFamily:'var(--font-mono,monospace)'}}>14%</div></td>
                        <td><span className="sem sem-rd"></span>0</td>
                        <td><span className="pill" style={{background:'var(--red-lt)',color:'var(--red)'}}>Bajo meta</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card" id="nodos-equipo-card">
                <div className="ctitle">Nodos activos del equipo</div>
                <div className="ib bl" style={{marginBottom:'12px'}}>3 nodos confirmados en el equipo este mes — Sebastián Molina lidera con 2 nodos activos.</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <div className="nodo-card-s">
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                      <div className="nodo-av">LT</div>
                      <div><div style={{fontSize:'13px',fontWeight:600}}>Luis Torres</div><div style={{fontSize:'11px',color:'var(--g400)'}}>Nodo de Francisca Rivadeneyra</div></div>
                      <div style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:'4px',padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:'var(--teal-lt)',color:'var(--teal)'}}>🌐 Activo</div>
                    </div>
                    <div style={{fontSize:'12px',color:'var(--g700)'}}>2 activaciones · 8 prospectos</div>
                  </div>
                  <div className="nodo-card-s">
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                      <div className="nodo-av" style={{background:'var(--blue)'}}>MV</div>
                      <div><div style={{fontSize:'13px',fontWeight:600}}>Marcos Villanueva</div><div style={{fontSize:'11px',color:'var(--g400)'}}>Nodo de Sebastián Molina</div></div>
                      <div style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:'4px',padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:'var(--teal-lt)',color:'var(--teal)'}}>🌐 Activo</div>
                    </div>
                    <div style={{fontSize:'12px',color:'var(--g700)'}}>3 activaciones · 14 prospectos</div>
                  </div>
                </div>
              </div>
            </div>

            {/* panel individual */}
            <div id="panel-individual" className="sc" style={{display: trackerTab === 'individual' ? 'block' : 'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',flexWrap:'wrap'}}>
                <label style={{fontSize:'13px',color:'var(--g700)',fontWeight:500}}>Asesor:</label>
                <select style={{padding:'8px 12px',border:'1.5px solid var(--g200)',borderRadius:'8px',fontFamily:'var(--font-jakarta,sans-serif)',fontSize:'13px',background:'white',appearance:'none',minWidth:'160px'}}><option>Francisca Rivadeneyra</option></select>
                <label style={{fontSize:'13px',color:'var(--g700)',fontWeight:500}}>Mes:</label>
                <select style={{padding:'8px 12px',border:'1.5px solid var(--g200)',borderRadius:'8px',fontFamily:'var(--font-jakarta,sans-serif)',fontSize:'13px',background:'white',appearance:'none',minWidth:'130px'}}><option>abril 2026</option></select>
              </div>
              <div className="mcg4" id="kpi-ind">
                <div className="mc warn"><div className="mc-lbl">Prospectos</div><div className="mc-val">10</div><div className="mc-sub">Meta: 20</div></div>
                <div className="mc ok"><div className="mc-lbl">Contactos</div><div className="mc-val">17</div><div className="mc-sub">Meta: 12</div></div>
                <div className="mc warn"><div className="mc-lbl">Tasa reunión</div><div className="mc-val">41%</div><div className="mc-sub">Meta: ≥60%</div></div>
                <div className="mc ok"><div className="mc-lbl">Nodos activos</div><div className="mc-val">1</div><div className="mc-sub">Luis Torres</div></div>
              </div>
              <div className="card" id="nodos-ind-card">
                <div className="ctitle">★ Nodos activos — Francisca Rivadeneyra</div>
                <div className="nodo-card-s">
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                    <div className="nodo-av">LT</div>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:600}}>Luis Torres</div>
                      <div style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:'var(--teal-lt)',color:'var(--teal)',marginTop:'3px'}}>🌐 Nodo activo</div>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',fontSize:'12px'}}>
                    <div><div style={{color:'var(--g400)',marginBottom:'2px'}}>Activaciones</div><div style={{fontFamily:'var(--font-mono,monospace)',fontWeight:600,fontSize:'15px'}}>2</div></div>
                    <div><div style={{color:'var(--g400)',marginBottom:'2px'}}>Prospectos dados</div><div style={{fontFamily:'var(--font-mono,monospace)',fontWeight:600,fontSize:'15px'}}>8</div></div>
                    <div><div style={{color:'var(--g400)',marginBottom:'2px'}}>Desde</div><div style={{fontFamily:'var(--font-mono,monospace)',fontWeight:600,fontSize:'12px'}}>Sem. 2 / abril</div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* panel ingresos */}
            <div id="panel-ingresos" className="sc" style={{display: trackerTab === 'ingresos' ? 'block' : 'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',flexWrap:'wrap'}}>
                <label style={{fontSize:'13px',color:'var(--g700)',fontWeight:500}}>Asesor:</label>
                <select style={{padding:'8px 12px',border:'1.5px solid var(--g200)',borderRadius:'8px',fontFamily:'var(--font-jakarta,sans-serif)',fontSize:'13px',background:'white',appearance:'none',minWidth:'160px'}}><option>Francisca Rivadeneyra</option></select>
              </div>
              <div className="mcg2" id="ing-kpi">
                <div className="mc warn"><div className="mc-lbl">Ingreso estimado</div><div className="mc-val">$1.169.797</div><div className="mc-sub">Meta: $2.000.000</div></div>
                <div className="mc bad"><div className="mc-lbl">Brecha</div><div className="mc-val">$830.203</div><div className="mc-sub">57.5% de la meta no alcanzada</div></div>
              </div>
              <div className="card" id="ing-table-card">
                <div className="ctitle">Histórico de ingresos — Francisca Rivadeneyra</div>
                <table className="eq-table">
                  <thead><tr><th>Mes</th><th>Sueldo Base</th><th>Bono</th><th>Total</th><th>Meta</th><th>Cumplimiento</th></tr></thead>
                  <tbody>
                    <tr><td>Enero 2026</td><td>$539.000</td><td>$420.000</td><td>$959.000</td><td>$2.000.000</td><td style={{color:'var(--red)',fontWeight:600}}>48%</td></tr>
                    <tr><td>Febrero 2026</td><td>$539.000</td><td>$510.000</td><td>$1.049.000</td><td>$2.000.000</td><td style={{color:'var(--red)',fontWeight:600}}>52%</td></tr>
                    <tr><td>Marzo 2026</td><td>$539.000</td><td>$490.000</td><td>$1.029.000</td><td>$2.000.000</td><td style={{color:'var(--red)',fontWeight:600}}>51%</td></tr>
                    <tr><td>Abril 2026</td><td>$539.000</td><td>$558.797</td><td>$1.169.797</td><td>$2.000.000</td><td style={{color:'var(--amber)',fontWeight:600}}>58%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ═══ END ═══ */}
          <div className={sc('scene-end')} id="scene-end">
            <div className="end-card">
              <div style={{fontSize:'52px',marginBottom:'14px'}}>🎉</div>
              <div style={{fontSize:'11px',fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--teal)',marginBottom:'9px'}}>Tutorial completado</div>
              <h2 style={{fontSize:'22px',fontWeight:600,color:'var(--g900)',marginBottom:'12px',lineHeight:1.2}}>¡Ya dominas Proxis!</h2>
              <p style={{fontSize:'13px',color:'var(--g700)',lineHeight:1.7,marginBottom:'22px'}}>Con estas herramientas puedes proyectar ingresos, definir metas realistas con cada asesor y hacer seguimiento semanal del desempeño del equipo.</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'22px',fontSize:'12px'}}>
                <div style={{background:'var(--blue-lt)',borderRadius:'10px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'18px',marginBottom:'4px'}}>📊</div><div style={{fontWeight:600,color:'var(--blue)'}}>Simulador</div><div style={{color:'var(--g400)',fontSize:'11px'}}>Proyecta y ajusta</div></div>
                <div style={{background:'var(--teal-lt)',borderRadius:'10px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'18px',marginBottom:'4px'}}>📋</div><div style={{fontWeight:600,color:'var(--teal)'}}>Tracker</div><div style={{color:'var(--g400)',fontSize:'11px'}}>Sigue el equipo</div></div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'4px'}}>
                <a href="/" className="btn btn-lg" style={{background:'#cbf135',color:'#0b0a09',fontWeight:800,width:'100%',justifyContent:'center',textDecoration:'none'}}>Ir a Proxis →</a>
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn" style={{flex:1,justifyContent:'center',background:'#f0eeeb',border:'1px solid #E8E7E2',color:'#3C3B37',fontSize:'13px'}} onClick={() => goToStep(0)}>↩ Ver de nuevo</button>
                  <a href="/" style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'10px 18px',borderRadius:'10px',background:'#f0eeeb',border:'1px solid #E8E7E2',color:'#3C3B37',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>← Inicio</a>
                </div>
              </div>
            </div>
          </div>

        </div>{/* #stage */}

        <div id="spotlight" style={spotlightStyle}></div>

        <div id="guide">
          <div id="g-progress"><div id="g-fill" style={{width:`${progress}%`}}></div></div>
          <div id="g-body">
            <div id="g-icon">{step.icon}</div>
            <div id="g-text">
              <div id="g-step">Paso {cur + 1} de {STEPS.length}</div>
              <div id="g-title">{step.title}</div>
              <div id="g-desc">{step.desc}</div>
            </div>
            <div id="g-nav">
              <button className="nbtn nbtn-prev" onClick={prevStep} disabled={cur === 0}>← Anterior</button>
              {step.isEnd
                ? <button className="nbtn nbtn-next" onClick={() => goToStep(0)}>↩ Repetir</button>
                : <button className="nbtn nbtn-next" onClick={nextStep}>{cur === STEPS.length - 2 ? '¡Finalizar! →' : 'Siguiente →'}</button>
              }
            </div>
          </div>
          <div id="g-hint" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'16px',padding:'4px 24px 8px'}}>
            <span>usa ← → o Espacio para navegar</span>
            <a href="https://theprecisionselling.com/" target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',pointerEvents:'auto'}}>
              <img src="/tps-logo.png" alt="The Precision Selling" style={{height:'80px',width:'160px',objectFit:'contain',display:'block',pointerEvents:'none'}} />
            </a>
          </div>
        </div>

      </div>{/* #tut-wrap */}
    </>
  )
}
