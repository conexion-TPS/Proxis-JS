'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface Step {
  scene: string
  icon: string
  title: string
  desc: string
  h: string | null
  enter?: () => void
  isEnd?: boolean
}

export default function TutorialAsesorPage() {
  const [cur, setCur] = useState(0)
  const [activeScene, setActiveScene] = useState('scene-intro')
  const [nodoOpen, setNodoOpen] = useState(false)
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({ display: 'none' })
  const [userName, setUserName] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const STEPS: Step[] = [
    { scene:'scene-intro', icon:'👋', title:'Bienvenida al tutorial interactivo', desc:'Te guiaremos por la plataforma TPS paso a paso. Usa los botones o las teclas ← → para avanzar a tu propio ritmo.', h:null },
    { scene:'scene-login', icon:'🔐', title:'Paso 1 — Selecciona tu nombre', desc:'En la pantalla de ingreso, elige tu nombre del menú desplegable. Cada asesor tiene su propia cuenta con acceso individual.', h:'#l-name' },
    { scene:'scene-login', icon:'🔑', title:'Tu clave personal', desc:'Ingresa tu clave personal. Es única para cada asesor. Si no la recuerdas, pídela a tu supervisora.', h:'#l-pass' },
    { scene:'scene-login', icon:'✅', title:'Ingresar al sistema', desc:'Haz clic en "Entrar" y accederás directamente a tu módulo de actividad. Haz clic en el botón para continuar el tutorial.', h:'#l-btn' },
    { scene:'scene-bitacora', icon:'📋', title:'Bitácora Semanal — tu espacio de trabajo', desc:'Aquí registras tus contactos semana a semana. Esta pestaña es tu herramienta principal: cada registro alimenta tus indicadores automáticamente.', h:'#stab-bitacora', enter:()=>setNodoOpen(false) },
    { scene:'scene-bitacora', icon:'📅', title:'La semana activa', desc:'Siempre verás la semana en curso con su fecha de inicio. Las semanas anteriores se cierran automáticamente cuando se inicia la semana cada lunes — tu historial queda protegido.', h:'#week-hdr', enter:()=>setNodoOpen(false) },
    { scene:'scene-bitacora', icon:'👤', title:'Registra tus contactos', desc:'Cada fila es una persona contactada esta semana. Los encabezados son: #, Nombre, Vínculo (tipo de relación), Llamó, Reunión y Prospectos.', h:'#contacts-card', enter:()=>setNodoOpen(false) },
    { scene:'scene-bitacora', icon:'✍️', title:'Carlos Medina — contacto nuevo', desc:'Contacto nuevo que dio 3 prospectos esta semana. Logró llamarlo (✓) y tener una reunión (✓). El sistema lo identifica como primer registro de esta persona.', h:'#cr1', enter:()=>setNodoOpen(false) },
    { scene:'scene-bitacora', icon:'📞', title:'"Llamó" — registra el primer contacto', desc:'Marca si lograste hablar con esa persona. Esta columna mide tu alcance inicial y alimenta la Tasa de Contacto en Mi Informe.', h:'#cr1-call', enter:()=>setNodoOpen(false) },
    { scene:'scene-bitacora', icon:'👥', title:'Prospectos dados — el número clave', desc:'¿Cuántas personas te refirió este contacto? Este número es el motor de tu resultado mensual. Más profundidad en la conversación = más prospectos.', h:'#cr1-prosp', enter:()=>setNodoOpen(false) },
    { scene:'scene-bitacora', icon:'🔄', title:'Luis Torres — vuelve a referirte', desc:'Luis Torres ya apareció en la Semana 2. Al volver a darte prospectos esta semana, el sistema detecta que es un contacto especial. El sistema lo incluye como "Reactivación".', h:'#cr3', enter:()=>setNodoOpen(false) },
    { scene:'scene-bitacora', icon:'💾', title:'Guardar Reporte', desc:'Al hacer clic en "Guardar Reporte", el sistema analiza automáticamente si algún contacto ya refirió antes. Si lo detecta, ¡celebra el momento! Haz clic para ver qué pasa.', h:'#save-btn', enter:()=>setNodoOpen(false) },
    { scene:'scene-bitacora', icon:'🌐', title:'¡Nodo Detectado! — reconocimiento automático', desc:'Este aviso aparece al guardar. El sistema reconoció a Luis Torres como Nodo Relacional porque es la segunda vez que te da prospectos.', h:'#nm-content', enter:()=>setNodoOpen(true) },
    { scene:'scene-bitacora', icon:'💡', title:'¿Qué es un Nodo Relacional?', desc:'Un Nodo es un contacto de confianza que vuelve a referirte prospectos más de una vez. Son los más valiosos de tu red porque pueden referir prospectos de mayor calidad sin que tengas que pedirlo cada vez.', h:'#nm-explanation', enter:()=>setNodoOpen(true) },
    { scene:'scene-informe', icon:'📊', title:'Mi Informe — el resumen del mes', desc:'Aquí ves todos tus indicadores acumulados del mes, calculados automáticamente desde tus bitácoras semanales. Nada que calcular a mano.', h:null, enter:()=>{} },
    { scene:'scene-informe', icon:'★', title:'★ Nodos activos — al tope del informe', desc:'Esta sección aparece primero porque los Nodos son tu activo más valioso. Verás cuántos tienes, cuántas veces activaron y cuántos prospectos generaron.', h:'#nodos-section' },
    { scene:'scene-informe', icon:'🃏', title:'La tarjeta de cada Nodo', desc:'Cada Nodo tiene su tarjeta: nombre, activaciones y prospectos totales. Verás su historial crecer mes a mes.', h:'#nodo-card' },
    { scene:'scene-informe', icon:'📈', title:'Evolución de Nodos — el gráfico', desc:'La línea verde muestra nodos acumulados semana a semana. Las barras azules muestran prospectos desde nodos. Cuando ambas suben, tu red está creciendo sola.', h:'#nodo-chart' },
    { scene:'scene-informe', icon:'🎯', title:'Prospectos obtenidos — el resultado central', desc:'Total de personas que tus contactos te refirieron este mes. El semáforo en la esquina te da la señal rápida. La meta la defines con tu supervisora.', h:'#kpi-prosp' },
    { scene:'scene-informe', icon:'👤', title:'Contactos realizados', desc:'Cuántas personas activaste como contactos este mes. Cada contacto debería darte un mínimo de 5 prospectos si el vínculo es fuerte.', h:'#kpi-cont' },
    { scene:'scene-informe', icon:'🤝', title:'Tasa de reunión', desc:'¿Qué porcentaje de tus contactos aceptó reunirse contigo? Una tasa sobre 60% es señal de buena gestión de relaciones.', h:'#kpi-tasa' },
    { scene:'scene-informe', icon:'⚡', title:'Eficiencia de contactos', desc:'¿Qué tan bien aprovechas cada contacto? Meta recomendada: ≥80%. Mide la profundidad de tus conversaciones.', h:'#kpi-ef' },
    { scene:'scene-informe', icon:'📐', title:'Prospectos / contacto', desc:'Cuántos prospectos obtuviste en promedio por cada contacto. Meta: ≥ 4.5. Si es bajo, trabajar el guión de solicitud y la confianza.', h:'#kpi-pc' },
    { scene:'scene-informe', icon:'🗣️', title:'Prospectos / reunión', desc:'Calidad de cada reunión. Al reunirte deberías salir siempre con al menos 4 nombres de referidos calificados. Meta: ≥ 4.', h:'#kpi-pr' },
    { scene:'scene-informe', icon:'⚠️', title:'Brecha de prospectos', desc:'Cuántos prospectos no obtuviste respecto al potencial máximo. No es para castigarse: es para enfocar el trabajo.', h:'#kpi-brecha' },
    { scene:'scene-informe', icon:'🔗', title:'Vínculo más productivo', desc:'El tipo de relación que más prospectos está generando este mes. Úsalo para priorizar a quién contactar.', h:'#kpi-vinculo' },
    { scene:'scene-informe', icon:'📋', title:'Tabla de evolución semanal', desc:'Vista detallada semana a semana de todos tus indicadores. Verás qué semanas tuvieron alta actividad y cuáles quedaron sin reporte.', h:'#ev-table-card' },
    { scene:'scene-informe', icon:'📊', title:'Evolución de actividad — gráfico de barras', desc:'Tres barras por semana: contactos, reuniones y prospectos. De un vistazo verás cómo cada variable varía y dónde está el cuello de botella.', h:'#ev-chart' },
    { scene:'scene-informe', icon:'📉', title:'Potencial vs. Real acumulado', desc:'La línea punteada gris es el potencial máximo acumulado. La línea azul sólida es tu real acumulado. Cuanto más se separan, mayor es la brecha de oportunidad.', h:'#pot-chart' },
    { scene:'scene-informe', icon:'🔗', title:'Productividad por tipo de vínculo', desc:'¿Qué tipo de relación te genera más prospectos? Amigo/a, familiar, cliente o conocido/a.', h:'#vinculo-card' },
    { scene:'scene-end', icon:'🎉', title:'¡Tutorial completado!', desc:'Ya conoces las funciones clave de TPS. Ingresa a la plataforma real y comienza a registrar tu actividad semanal.', h:null, isEnd:true },
  ]

  useEffect(() => {
    const stored = localStorage.getItem('proxis_user')
    if (stored) {
      const user = JSON.parse(stored)
      if (user.role === 'asesor') setUserName(user.name)
    }
  }, [])

  const updateSpotlight = useCallback((sel: string | null) => {
    if (!sel) { setSpotlightStyle({ display: 'none' }); return }
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) { setSpotlightStyle({ display: 'none' }); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => {
      const r = el.getBoundingClientRect()
      const p = 8
      setSpotlightStyle({
        display: 'block',
        position: 'fixed',
        top: r.top - p,
        left: r.left - p,
        width: r.width + p * 2,
        height: r.height + p * 2,
        borderRadius: 12,
        boxShadow: '0 0 0 9999px rgba(0,25,70,0.74)',
        outline: '2.5px solid rgba(202,252,5,0.7)',
        pointerEvents: 'none',
        zIndex: 400,
        animation: 'spulse 2s ease-in-out infinite',
      })
    }, 420)
  }, [])

  const goToStep = useCallback((n: number) => {
    n = Math.max(0, Math.min(n, STEPS.length - 1))
    const step = STEPS[n]
    setCur(n)
    if (step.scene !== activeScene) {
      setActiveScene(step.scene)
      if (stageRef.current) stageRef.current.scrollTop = 0
    }
    if (step.enter) setTimeout(step.enter, 60)
    setTimeout(() => updateSpotlight(step.h), 80)
  }, [activeScene, updateSpotlight]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextStep = useCallback(() => { if (cur < STEPS.length - 1) goToStep(cur + 1) }, [cur, goToStep]) // eslint-disable-line react-hooks/exhaustive-deps
  const prevStep = useCallback(() => { if (cur > 0) goToStep(cur - 1) }, [cur, goToStep])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextStep() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextStep, prevStep])

  useEffect(() => {
    function onScroll() {
      const h = STEPS[cur]?.h
      if (h) setTimeout(() => updateSpotlight(h), 50)
    }
    function onResize() {
      const h = STEPS[cur]?.h
      if (h) updateSpotlight(h)
    }
    const stage = stageRef.current
    stage?.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onResize)
    return () => { stage?.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize) }
  }, [cur, updateSpotlight]) // eslint-disable-line react-hooks/exhaustive-deps

  // Init spotlight on mount
  useEffect(() => { updateSpotlight(STEPS[0].h) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const step = STEPS[cur]
  const guideH = 160

  const ProxisIcon = () => (
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

  const ProxisLogo = () => (
    <div style={{display:'flex',alignItems:'center',gap:7,background:'#000',borderRadius:8,padding:'6px 12px'}}>
      <ProxisIcon/>
      <span style={{fontWeight:800,fontSize:17,color:'white',letterSpacing:'-0.04em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
    </div>
  )

  const AppBar = ({ role }: { role: string }) => (
    <>
      <div className="sh">
        <ProxisLogo/>
        <div className="sh-div"/>
        <div style={{fontSize:11,fontWeight:600,color:'white',lineHeight:1.3}}>Prospección<br/><span style={{fontSize:10,opacity:.65,letterSpacing:'.07em',textTransform:'uppercase'}}>en práctica</span></div>
        <div className="sh-role" style={{marginLeft:8}}>{userName || 'Fernanda Peña'} · <strong>{role}</strong></div>
        <div className="sh-ml" style={{display:'flex',alignItems:'center',gap:8}}>
          <Link href="/" style={{fontSize:12,color:'rgba(255,255,255,.5)',textDecoration:'none',padding:'4px 10px',border:'1px solid rgba(255,255,255,.15)',borderRadius:20}}>← Proxis</Link>
          <button className="sh-out">Salir</button>
        </div>
      </div>
      <div className="mb"><div className="mb-btn on">📋 Mi actividad</div></div>
    </>
  )

  return (
    <div id="tut-wrap" style={{display:'flex',flexDirection:'column',height:'100vh'}}>

      {/* STAGE */}
      <div id="stage" ref={stageRef} style={{flex:1,overflowY:'auto',overflowX:'hidden',position:'relative'}}>

        {/* INTRO */}
        <div className={`scene centered${activeScene==='scene-intro'?' active':''}`} style={{background:'#0b0a09'}}>
          <div className="intro-card">
            <div className="logo-blk" style={{background:'#0b0a09',display:'inline-flex',alignItems:'center',gap:8,padding:'10px 16px',borderRadius:12}}>
              <ProxisIcon/>
              <span style={{fontWeight:800,fontSize:17,color:'white',letterSpacing:'-0.04em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
            </div>
            <div className="intro-badge" style={{background:'rgba(168,204,26,.15)',color:'#a8cc1a',border:'1px solid rgba(168,204,26,.3)'}}>📚 Tutorial Interactivo</div>
            <h1 className="intro-ttl" style={{color:'#0b0a09',letterSpacing:'-0.03em'}}>
              {userName ? `Hola, ${userName.split(' ')[0]}. ` : ''}Aprende a usar la Plataforma de Prospección
            </h1>
            <p className="intro-sub" style={{color:'#4a4844'}}>Te guiaremos paso a paso por las funciones principales de tu plataforma. Usa los botones del panel inferior o las teclas ← → para navegar.</p>
            <div className="checklist" style={{color:'#3C3B37',background:'#f0eeeb'}}>
              <div>📋 <strong>Bitácora Semanal</strong> — Registra contactos y prospectos</div>
              <div>🌐 <strong>Nodo Relacional</strong> — Qué es y cómo el sistema lo detecta</div>
              <div>📊 <strong>Mi Informe</strong> — Cómo leer e interpretar tus indicadores</div>
            </div>
            <button className="btn btn-pri btn-w btn-lg" onClick={nextStep}>Comenzar el tutorial →</button>
          </div>
        </div>

        {/* LOGIN */}
        <div className={`scene centered${activeScene==='scene-login'?' active':''}`}>
          <div className="lcard">
            <div style={{display:'flex',alignItems:'center',gap:8,background:'#000',borderRadius:10,padding:'10px 14px',marginBottom:20}}>
              <ProxisIcon/>
              <span style={{fontWeight:800,fontSize:17,color:'white',letterSpacing:'-0.04em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
            </div>
            <div style={{fontSize:18,fontWeight:600,color:'var(--blue)',marginBottom:4}}>Acceso a tu cuenta</div>
            <div style={{fontSize:13,color:'var(--g400)',marginBottom:22}}>Selecciona tu nombre e ingresa tu clave personal</div>
            <div className="lfld" id="l-name">
              <label>Nombre</label>
              <select><option>Fernanda Peña</option></select>
            </div>
            <div className="lfld" id="l-pass">
              <label>Clave personal</label>
              <input type="password" defaultValue="maria2026" readOnly/>
            </div>
            <div id="l-btn">
              <button className="btn btn-pri btn-w" onClick={() => goToStep(4)}>Entrar →</button>
            </div>
            <div style={{fontSize:11,color:'var(--g400)',textAlign:'center',marginTop:16}}>The Precision Selling · Chile</div>
          </div>
        </div>

        {/* BITÁCORA */}
        <div className={`scene${activeScene==='scene-bitacora'?' active':''}`} id="scene-bitacora">
          <AppBar role="Asesor/a"/>
          <div className="stabs">
            <div className="stab" id="stab-informe">Mi informe</div>
            <div className="stab on" id="stab-bitacora">Bitácora Semanal</div>
          </div>
          <div className="sc">
            <div className="card" id="week-hdr">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div className="ctitle" style={{marginBottom:3}}>Semana 4 · Inicio: 22 de abril 2026</div>
                  <div style={{fontSize:12,color:'var(--g400)'}}>Semana activa — se cierra automáticamente el próximo lunes</div>
                </div>
                <span className="lbadge">✓ Semana abierta</span>
              </div>
            </div>
            <div className="card" id="contacts-card">
              <div className="ctitle">Contactos de la semana</div>
              <div style={{overflowX:'auto'}}>
                <table className="ftbl">
                  <thead>
                    <tr>
                      <th style={{width:28}}>#</th>
                      <th>Nombre</th><th>Vínculo</th>
                      <th style={{textAlign:'center'}}>Llamó</th>
                      <th style={{textAlign:'center'}}>Reunión</th>
                      <th style={{textAlign:'center'}}>Prospectos</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr id="cr1">
                      <td style={{color:'var(--g400)',fontSize:12}}>1</td>
                      <td><input className="fi" defaultValue="Carlos Medina" readOnly/></td>
                      <td><select className="fi" style={{width:'auto',minWidth:110}} disabled><option>Referido</option></select></td>
                      <td style={{textAlign:'center'}}><div id="cr1-call" className="chk on">✓</div></td>
                      <td style={{textAlign:'center'}}><div className="chk on">✓</div></td>
                      <td style={{textAlign:'center'}}><input id="cr1-prosp" className="ni" defaultValue="3" readOnly/></td>
                    </tr>
                    <tr id="cr2">
                      <td style={{color:'var(--g400)',fontSize:12}}>2</td>
                      <td><input className="fi" defaultValue="Ana Rojas" readOnly/></td>
                      <td><select className="fi" style={{width:'auto',minWidth:110}} disabled><option>Amigo/a</option></select></td>
                      <td style={{textAlign:'center'}}><div className="chk on">✓</div></td>
                      <td style={{textAlign:'center'}}><div className="chk">○</div></td>
                      <td style={{textAlign:'center'}}><input className="ni" defaultValue="2" readOnly/></td>
                    </tr>
                    <tr id="cr3">
                      <td style={{color:'var(--g400)',fontSize:12}}>3</td>
                      <td><input className="fi" defaultValue="Luis Torres" readOnly style={{borderColor:'var(--teal)'}}/></td>
                      <td><select className="fi" style={{width:'auto',minWidth:110,borderColor:'var(--teal)'}} disabled><option>Conocido/a</option></select></td>
                      <td style={{textAlign:'center'}}><div className="chk on">✓</div></td>
                      <td style={{textAlign:'center'}}><div className="chk on">✓</div></td>
                      <td style={{textAlign:'center'}}><input className="ni" defaultValue="4" readOnly style={{borderColor:'var(--teal)'}}/></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:14,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                <button className="btn btn-suc" id="save-btn" onClick={() => goToStep(12)}>💾 Guardar Reporte</button>
                <button className="btn btn-sec" id="add-btn">+ Agregar Contacto</button>
                <span style={{fontSize:12,color:'var(--g400)'}}>3 contactos · 9 prospectos</span>
              </div>
            </div>
            <div style={{padding:'10px 14px',borderRadius:'var(--r)',fontSize:12,lineHeight:1.5,background:'var(--blue-lt)',color:'var(--blue)',borderLeft:'3px solid var(--blue-mid)'}}>
              💡 <strong>Recuerda:</strong> Las semanas anteriores se cierran automáticamente cuando comienza una nueva semana cada lunes — tu historial queda protegido.
            </div>
          </div>
          {/* Nodo modal */}
          <div id="nodo-modal" className={nodoOpen ? 'open' : ''}>
            <div className="nm-box" id="nm-content">
              <div style={{fontSize:48,marginBottom:10}}>🌐</div>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--teal)',marginBottom:7}}>¡Nodo Detectado!</div>
              <h2 style={{fontSize:20,fontWeight:600,color:'var(--blue)',marginBottom:10}}>Luis Torres es tu Nodo Relacional</h2>
              <p id="nm-explanation" style={{fontSize:13,color:'var(--g700)',lineHeight:1.7,marginBottom:18}}>
                Luis Torres ya te había referido prospectos en la <strong>Semana 2</strong>. Al volver a referirte esta semana, el sistema lo reconoce automáticamente como un <strong>Nodo Relacional</strong> — un contacto de confianza que activa tu red de manera sostenida.
              </p>
              <div style={{background:'var(--teal-lt)',borderRadius:10,padding:'12px 16px',marginBottom:18,textAlign:'left',fontSize:12,color:'var(--teal)',display:'flex',gap:16,flexWrap:'wrap'}}>
                <div><strong>Activaciones:</strong> 2</div>
                <div><strong>Prospectos totales:</strong> 8</div>
                <div><strong>Primera vez:</strong> Semana 2</div>
              </div>
              <button className="btn btn-pri btn-w" onClick={() => goToStep(13)}>Entendido — continuar tutorial →</button>
            </div>
          </div>
        </div>

        {/* MI INFORME */}
        <div className={`scene${activeScene==='scene-informe'?' active':''}`} id="scene-informe">
          <AppBar role="Asesor/a"/>
          <div className="stabs">
            <div className="stab on">Mi informe</div>
            <div className="stab">Bitácora Semanal</div>
          </div>
          <div className="sc">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:'var(--g900)'}}>Mi informe de avance</div>
                <div style={{fontSize:12,color:'var(--g400)'}}>Indicadores de gestión de prospección</div>
              </div>
              <select style={{padding:'6px 12px',border:'1.5px solid var(--g200)',borderRadius:8,fontFamily:'inherit',fontSize:13,background:'white',appearance:'none'}}><option>Abril 2026</option></select>
            </div>
            {/* Nodos activos */}
            <div className="card" id="nodos-section" style={{borderLeft:'4px solid var(--teal)'}}>
              <div className="ctitle" style={{marginBottom:12}}>★ Nodos activos</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                {[{lbl:'Nodos activos',val:'1',teal:true},{lbl:'Activaciones',val:'2'},{lbl:'Prospectos via Nodo',val:'8'},{lbl:'% del total mes',val:'80%'}].map(c=>(
                  <div key={c.lbl} style={{background:c.teal?'var(--teal-lt)':'var(--g100)',borderRadius:'var(--r)',padding:'12px 14px'}}>
                    <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',color:c.teal?'var(--teal)':'var(--g400)',marginBottom:4}}>{c.lbl}</div>
                    <div style={{fontSize:24,fontWeight:600,fontFamily:'var(--mono)',color:c.teal?'var(--teal)':'var(--g900)'}}>{c.val}</div>
                  </div>
                ))}
              </div>
              <div className="nodo-card" id="nodo-card">
                <div className="nodo-hdr">
                  <div className="nodo-av">LT</div>
                  <div><div className="nodo-nm">Luis Torres</div><div className="nodo-badge">🌐 Nodo activo</div></div>
                </div>
                <div className="nodo-stats">
                  <div><div className="ns-lbl">Activaciones</div><div className="ns-val">2</div></div>
                  <div><div className="ns-lbl">Prospectos dados</div><div className="ns-val">8</div></div>
                  <div><div className="ns-lbl">Desde</div><div className="ns-val" style={{fontSize:12}}>Sem. 2</div></div>
                </div>
              </div>
              <div id="nodo-chart">
                <div style={{fontSize:10,fontWeight:600,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Evolución de nodos · abril 2026</div>
                <svg viewBox="0 0 520 120" height="120" style={{width:'100%',display:'block'}}>
                  <line x1="0" y1="20" x2="520" y2="20" stroke="#e8e7e2" strokeWidth="1"/>
                  <line x1="0" y1="50" x2="520" y2="50" stroke="#e8e7e2" strokeWidth="1"/>
                  <line x1="0" y1="80" x2="520" y2="80" stroke="#e8e7e2" strokeWidth="1"/>
                  <line x1="0" y1="108" x2="520" y2="108" stroke="#e8e7e2" strokeWidth="1"/>
                  <rect x="38" y="102" width="22" height="6" fill="#B5D4F4" rx="2"/>
                  <rect x="163" y="68" width="22" height="40" fill="#B5D4F4" rx="2"/>
                  <rect x="288" y="98" width="22" height="10" fill="#B5D4F4" rx="2"/>
                  <rect x="413" y="60" width="22" height="48" fill="#B5D4F4" rx="2"/>
                  <polyline points="49,106 174,78 299,78 424,52" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="49" cy="106" r="4" fill="#0F6E56"/><circle cx="174" cy="78" r="4" fill="#0F6E56"/>
                  <circle cx="299" cy="78" r="4" fill="#0F6E56"/><circle cx="424" cy="52" r="4" fill="#0F6E56"/>
                  <text x="49" y="118" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem 1</text>
                  <text x="174" y="118" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem 2</text>
                  <text x="299" y="118" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem 3</text>
                  <text x="424" y="118" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem 4</text>
                </svg>
              </div>
            </div>
            {/* KPIs */}
            <div className="card" id="kpi-card">
              <div className="ctitle">Resumen del mes — Abril 2026</div>
              <div className="mcrow4">
                {[
                  {id:'kpi-prosp',cls:'mc-nt',sem:'sem-am',lbl:'Prospectos obtenidos ⓘ',val:'10',sub:'Meta: 15 · 67% cumplido',xp:'Total de personas que tus contactos te refirieron este mes.'},
                  {id:'kpi-cont',cls:'mc-tl',sem:'sem-ok',lbl:'Contactos realizados ⓘ',val:'17',sub:'Meta: 12 (3/sem × 4 sem)',xp:'Número de personas que activaste como contacto este mes.'},
                  {id:'kpi-tasa',cls:'mc-am',sem:'sem-am',lbl:'Tasa de reunión ⓘ',val:'41%',sub:'7 reuniones de 17 contactos · Meta: ≥60%',xp:'% de contactos que aceptaron reunirse.'},
                  {id:'kpi-ef',cls:'mc-rd',sem:'sem-rd',lbl:'Eficiencia de contactos ⓘ',val:'12%',sub:'Prospectos reales vs. potencial (85)',xp:'¿Cuánto del potencial máximo aprovechas? Meta: ≥80%.'},
                ].map(k=>(
                  <div key={k.id} className={`mc ${k.cls}`} id={k.id}>
                    <div className={`sem ${k.sem}`}/>
                    <div className="mc-lbl">{k.lbl}</div>
                    <div className="mc-val">{k.val}</div>
                    <div className="mc-sub">{k.sub}</div>
                    <div className="mc-xp">{k.xp}</div>
                  </div>
                ))}
              </div>
              <div className="mcrow4b">
                {[
                  {id:'kpi-pc',cls:'mc-rd',sem:'sem-rd',lbl:'Prospectos / contacto ⓘ',val:'0.6',sub:'Meta: ≥ 4.5 prospectos',xp:'Indicador clave de efectividad.'},
                  {id:'kpi-pr',cls:'mc-rd',sem:'sem-rd',lbl:'Prospectos / reunión ⓘ',val:'1.4',sub:'7 reuniones · Meta: ≥ 4',xp:'Calidad de cada reunión.'},
                  {id:'kpi-brecha',cls:'mc-rd',sem:'sem-rd',lbl:'Brecha de prospectos ⓘ',val:'75',sub:'Prospectos no obtenidos este mes',xp:'Oportunidad no capitalizada.'},
                  {id:'kpi-vinculo',cls:'mc-tl',sem:'sem-ok',lbl:'Vínculo más productivo ⓘ',val:'Amigo/a',sub:'5 prospectos generados',xp:'El tipo de relación que más referidos produce.'},
                ].map(k=>(
                  <div key={k.id} className={`mc ${k.cls}`} id={k.id}>
                    <div className={`sem ${k.sem}`}/>
                    <div className="mc-lbl">{k.lbl}</div>
                    <div className="mc-val" style={k.id==='kpi-vinculo'?{fontSize:18,marginTop:3}:{}}>{k.val}</div>
                    <div className="mc-sub">{k.sub}</div>
                    <div className="mc-xp">{k.xp}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Tabla evolución */}
            <div className="card" id="ev-table-card">
              <div className="ctitle">Evolución semanal</div>
              <div style={{overflowX:'auto'}}>
                <table className="ev-table">
                  <thead><tr><th>Semana</th><th>Contactos</th><th>Reuniones</th><th>Tasa Reunión</th><th>Prospectos</th><th>Potencial</th><th>Prosp/Cont.</th><th>Estado</th></tr></thead>
                  <tbody>
                    <tr><td>Semana 1 (2026-04-06)</td><td>5</td><td>4</td><td>80%</td><td>5</td><td>25</td><td className="stat-rd">1</td><td><span className="pill pill-gn">Guardado</span></td></tr>
                    <tr style={{background:'#fff8f8'}}><td>Semana 2 (2026-04-06)</td><td>0</td><td>0</td><td>0%</td><td>0</td><td>0</td><td>—</td><td><span className="pill" style={{background:'var(--g100)',color:'var(--g400)'}}>Sin reporte</span></td></tr>
                    <tr><td>Semana 3 (2026-04-13)</td><td>2</td><td>0</td><td>0%</td><td>4</td><td>10</td><td className="stat-rd">2</td><td><span className="pill pill-gn">Guardado</span></td></tr>
                    <tr><td>Semana 4 (2026-04-20)</td><td>10</td><td>3</td><td>30%</td><td>1</td><td>50</td><td className="stat-rd">0.1</td><td><span className="pill pill-gn">Guardado</span></td></tr>
                    <tr className="total-row"><td>Total mes</td><td>17</td><td>7</td><td>41%</td><td>10</td><td>85</td><td className="stat-rd">0.6</td><td></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Charts */}
            <div className="card" id="ev-chart">
              <div className="ctitle">Evolución de actividad</div>
              <svg viewBox="0 0 520 155" height="155" style={{width:'100%',display:'block',marginTop:8}}>
                <line x1="42" y1="10" x2="490" y2="10" stroke="#e8e7e2" strokeWidth="1"/>
                <line x1="42" y1="36" x2="490" y2="36" stroke="#e8e7e2" strokeWidth="1"/>
                <line x1="42" y1="62" x2="490" y2="62" stroke="#e8e7e2" strokeWidth="1"/>
                <line x1="42" y1="88" x2="490" y2="88" stroke="#e8e7e2" strokeWidth="1"/>
                <line x1="42" y1="114" x2="490" y2="114" stroke="#e8e7e2" strokeWidth="1"/>
                <text x="38" y="14" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">10</text>
                <text x="38" y="40" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">8</text>
                <text x="38" y="66" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">6</text>
                <text x="38" y="92" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">4</text>
                <text x="38" y="118" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">2</text>
                <rect x="52" y="62" width="16" height="52" fill="#B5D4F4" rx="2"/>
                <rect x="71" y="75" width="16" height="39" fill="#9FE1CB" rx="2"/>
                <rect x="90" y="62" width="16" height="52" fill="#003781" rx="2" opacity=".7"/>
                <rect x="190" y="101" width="16" height="13" fill="#B5D4F4" rx="2"/>
                <rect x="228" y="88" width="16" height="26" fill="#003781" rx="2" opacity=".7"/>
                <rect x="328" y="10" width="16" height="104" fill="#B5D4F4" rx="2"/>
                <rect x="347" y="88" width="16" height="26" fill="#9FE1CB" rx="2"/>
                <rect x="366" y="107" width="16" height="7" fill="#003781" rx="2" opacity=".7"/>
                <text x="80" y="128" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem. 1</text>
                <text x="200" y="128" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem. 2</text>
                <text x="340" y="128" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem. 3</text>
                <text x="460" y="128" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem. 4</text>
                <rect x="44" y="137" width="10" height="7" fill="#B5D4F4" rx="1"/>
                <text x="57" y="143" fontSize="9" fill="#3C3B37">Contactos</text>
                <rect x="120" y="137" width="10" height="7" fill="#9FE1CB" rx="1"/>
                <text x="133" y="143" fontSize="9" fill="#3C3B37">Reuniones</text>
                <rect x="196" y="137" width="10" height="7" fill="#003781" rx="1" opacity=".7"/>
                <text x="209" y="143" fontSize="9" fill="#3C3B37">Prospectos</text>
              </svg>
            </div>
            <div className="card" id="pot-chart">
              <div className="ctitle">Potencial vs. Real acumulado</div>
              <svg viewBox="0 0 520 150" height="150" style={{width:'100%',display:'block',marginTop:8}}>
                <line x1="42" y1="10" x2="490" y2="10" stroke="#e8e7e2" strokeWidth="1"/>
                <line x1="42" y1="40" x2="490" y2="40" stroke="#e8e7e2" strokeWidth="1"/>
                <line x1="42" y1="70" x2="490" y2="70" stroke="#e8e7e2" strokeWidth="1"/>
                <line x1="42" y1="100" x2="490" y2="100" stroke="#e8e7e2" strokeWidth="1"/>
                <line x1="42" y1="124" x2="490" y2="124" stroke="#e8e7e2" strokeWidth="1"/>
                <text x="38" y="14" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">90</text>
                <text x="38" y="44" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">70</text>
                <text x="38" y="74" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">50</text>
                <text x="38" y="104" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">30</text>
                <text x="38" y="127" textAnchor="end" fontSize="9" fill="#9e9d97" fontFamily="DM Mono">10</text>
                <polyline points="90,116.7 210,116.7 330,103.3 450,13.3" fill="none" stroke="#9E9D97" strokeWidth="2" strokeDasharray="5,4"/>
                <polyline points="90,124.4 210,124.4 330,121.3 450,120" fill="none" stroke="#003781" strokeWidth="2.5" strokeLinecap="round"/>
                <polygon points="90,124.4 210,124.4 330,121.3 450,120 450,126 90,126" fill="#003781" fillOpacity=".07"/>
                <circle cx="90" cy="124.4" r="3.5" fill="#003781"/><circle cx="210" cy="124.4" r="3.5" fill="#003781"/>
                <circle cx="330" cy="121.3" r="3.5" fill="#003781"/><circle cx="450" cy="120" r="3.5" fill="#003781"/>
                <text x="90" y="138" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem. 1</text>
                <text x="210" y="138" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem. 2</text>
                <text x="330" y="138" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem. 3</text>
                <text x="450" y="138" textAnchor="middle" fontSize="10" fill="#9e9d97">Sem. 4</text>
                <line x1="44" y1="147" x2="58" y2="147" stroke="#9E9D97" strokeWidth="2" strokeDasharray="4,3"/>
                <text x="62" y="150" fontSize="9" fill="#3C3B37">Potencial acumulado</text>
                <line x1="165" y1="147" x2="179" y2="147" stroke="#003781" strokeWidth="2.5"/>
                <text x="183" y="150" fontSize="9" fill="#3C3B37">Real acumulado</text>
              </svg>
            </div>
            <div className="card" id="vinculo-card">
              <div className="ctitle">Productividad por tipo de vínculo</div>
              <div style={{fontSize:12,color:'var(--g400)',marginBottom:10}}>Prospectos generados según el tipo de relación con el contacto.</div>
              <div className="vinc-grid">
                <div className="vinc-card best"><div className="vinc-lbl">Amigo/a</div><div className="vinc-val">5</div><div className="vinc-sub">prospectos</div></div>
                <div className="vinc-card"><div className="vinc-lbl">Familiar</div><div className="vinc-val" style={{color:'var(--g400)'}}>0</div><div className="vinc-sub">prospectos</div></div>
                <div className="vinc-card"><div className="vinc-lbl">Cliente</div><div className="vinc-val" style={{color:'var(--g400)'}}>0</div><div className="vinc-sub">prospectos</div></div>
                <div className="vinc-card"><div className="vinc-lbl">Conocido/a</div><div className="vinc-val">5</div><div className="vinc-sub">prospectos</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* END */}
        <div className={`scene centered${activeScene==='scene-end'?' active':''}`} id="scene-end">
          <div className="end-card" style={{background:'white'}}>
            <div style={{fontSize:52,marginBottom:14}}>🎉</div>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--teal)',marginBottom:9}}>Tutorial completado</div>
            <h2 style={{fontSize:22,fontWeight:600,color:'var(--g900)',marginBottom:12,lineHeight:1.2}}>¡Ya sabes usar Proxis!</h2>
            <p style={{fontSize:13,color:'var(--g700)',lineHeight:1.7,marginBottom:22}}>Recuerda los tres momentos: <strong>registra</strong> tus contactos en la Bitácora, deja que el sistema <strong>detecte</strong> tus Nodos automáticamente, y revisa <strong>Mi Informe</strong> para entender tu evolución.</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:22,fontSize:12}}>
              <div style={{background:'var(--teal-lt)',borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:18,marginBottom:4}}>📋</div><div style={{fontWeight:600,color:'var(--teal)'}}>Bitácora</div><div style={{color:'var(--g400)',fontSize:11}}>Cada semana</div></div>
              <div style={{background:'var(--blue-lt)',borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:18,marginBottom:4}}>🌐</div><div style={{fontWeight:600,color:'var(--blue)'}}>Nodos</div><div style={{color:'var(--g400)',fontSize:11}}>Automático</div></div>
              <div style={{background:'var(--g100)',borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:18,marginBottom:4}}>📊</div><div style={{fontWeight:600,color:'var(--g700)'}}>Mi Informe</div><div style={{color:'var(--g400)',fontSize:11}}>Siempre visible</div></div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:4}}>
              <Link href="/plataforma" className="btn btn-lg" style={{background:'#cbf135',color:'#0b0a09',fontWeight:800,width:'100%',justifyContent:'center',textDecoration:'none',display:'inline-flex',alignItems:'center',borderRadius:10,padding:'13px 22px',fontSize:14,border:'none'}}>
                Ir a Proxis →
              </Link>
              <div style={{display:'flex',gap:8}}>
                <button className="btn" style={{flex:1,justifyContent:'center',background:'#f0eeeb',border:'1px solid #E8E7E2',color:'#3C3B37',fontSize:13}} onClick={()=>goToStep(0)}>↩ Ver de nuevo</button>
                <Link href="/" style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 18px',borderRadius:10,background:'#f0eeeb',border:'1px solid #E8E7E2',color:'#3C3B37',fontSize:13,fontWeight:600,textDecoration:'none'}}>← Inicio</Link>
              </div>
            </div>
          </div>
        </div>

      </div>{/* /stage */}

      {/* SPOTLIGHT */}
      <div id="spotlight" style={spotlightStyle}/>

      {/* GUIDE */}
      <div id="guide" style={{height:guideH,flexShrink:0,background:'var(--blue)',borderTop:'3px solid #1a5fa8',display:'flex',flexDirection:'column',position:'relative',zIndex:600}}>
        <div id="g-progress" style={{height:4,background:'rgba(255,255,255,.12)'}}>
          <div id="g-fill" style={{height:'100%',background:'#cbf135',borderRadius:'0 2px 2px 0',transition:'width .4s ease',width:`${(cur+1)/STEPS.length*100}%`}}/>
        </div>
        <div id="g-body" style={{flex:1,display:'flex',alignItems:'center',gap:16,padding:'10px 24px'}}>
          <div id="g-icon" style={{fontSize:24,flexShrink:0,width:36,textAlign:'center'}}>{step.icon}</div>
          <div id="g-text" style={{flex:1,minWidth:0}}>
            <div id="g-step" style={{fontSize:10,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:'#cbf135',marginBottom:1}}>Paso {cur+1} de {STEPS.length}</div>
            <div id="g-title" style={{fontSize:14,fontWeight:600,color:'white',marginBottom:2,lineHeight:1.2}}>{step.title}</div>
            <div id="g-desc" style={{fontSize:12,color:'rgba(255,255,255,.72)',lineHeight:1.4}}>{step.desc}</div>
          </div>
          <div id="g-nav" style={{display:'flex',gap:8,flexShrink:0,alignItems:'center'}}>
            <button className="nbtn nbtn-prev" id="btn-prev" onClick={prevStep} disabled={cur===0}>← Anterior</button>
            {step.isEnd
              ? <button className="nbtn nbtn-next" onClick={()=>goToStep(0)}>↩ Repetir</button>
              : <button className="nbtn nbtn-next" id="btn-next" onClick={nextStep}>{cur===STEPS.length-2?'¡Finalizar! →':'Siguiente →'}</button>
            }
          </div>
        </div>
        <div id="g-hint" style={{fontSize:10,color:'rgba(255,255,255,.35)',textAlign:'center',padding:'4px 24px 8px',letterSpacing:'.03em',display:'flex',alignItems:'center',justifyContent:'center',gap:16}}>
          <span>usa ← → o Espacio para navegar</span>
          <a href="https://theprecisionselling.com/" target="_blank" rel="noopener" style={{opacity:1}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tps-logo.png" alt="The Precision Selling" style={{height:80,width:160,objectFit:'contain',display:'block'}}/>
          </a>
        </div>
      </div>

      <style>{`
        :root{--blue:#0b0a09;--blue-mid:#2a2926;--blue-lt:#f0eeeb;--blue-pale:#f7f6f3;--teal:#1a9e4a;--teal-lt:#e6f9ee;--lime:#cbf135;--lime-dk:#a8cc1a;--amber:#BA7517;--amber-lt:#FAEEDA;--red:#A32D2D;--red-lt:#FCEBEB;--g100:#F5F4F0;--g200:#E8E7E2;--g400:#9E9D97;--g700:#3C3B37;--g900:#1A1A18;--r:10px;--rl:16px;--guide-h:160px;}
        body{overflow:hidden;height:100vh}
        .scene{display:none;min-height:calc(100vh - var(--guide-h))}
        .scene.active{display:block}
        .scene.centered{display:none;align-items:center;justify-content:center;background:var(--blue)}
        .scene.centered.active{display:flex}
        #scene-end.centered.active{background:#f0eeeb;background-image:radial-gradient(circle,rgba(0,0,0,0.1) 1px,transparent 1px);background-size:24px 24px;}
        .sh{background:var(--blue);color:white;padding:10px 22px;display:flex;align-items:center;gap:12px;border-bottom:3px solid #0052b4}
        .sh-div{width:1.5px;height:32px;background:rgba(255,255,255,.22);flex-shrink:0}
        .sh-role{font-size:12px;opacity:.8}.sh-role strong{font-weight:600}
        .sh-ml{margin-left:auto}
        .sh-out{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:white;font-family:inherit;font-size:12px;padding:5px 12px;border-radius:20px;cursor:pointer}
        .mb{background:white;border-bottom:2px solid var(--g200);padding:0 22px;display:flex}
        .mb-btn{padding:13px 20px;font-size:13px;font-weight:600;color:var(--g400);border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap}
        .mb-btn.on{color:var(--blue);border-bottom-color:var(--blue)}
        .stabs{display:flex;border-bottom:1px solid var(--g200);background:var(--g100);padding:0 22px}
        .stab{padding:10px 16px;font-size:13px;font-weight:500;color:var(--g400);border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
        .stab.on{color:var(--blue);border-bottom-color:var(--blue)}
        .card{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:18px 20px;margin-bottom:14px}
        .ctitle{font-size:13px;font-weight:600;color:var(--g700);margin-bottom:14px;display:flex;align-items:center;gap:8px}
        .ctitle::before{content:'';display:block;width:4px;height:16px;background:var(--blue);border-radius:2px}
        .mc{border-radius:var(--r);padding:14px 16px;position:relative;border:1px solid transparent}
        .mc-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
        .mc-val{font-size:24px;font-weight:600;font-family:var(--font-mono),monospace;letter-spacing:-.5px;margin-bottom:3px}
        .mc-sub{font-size:11px;line-height:1.4;opacity:.85}
        .mc-xp{font-size:11px;line-height:1.4;margin-top:6px;font-style:italic;border-top:1px solid rgba(0,0,0,.06);padding-top:5px;opacity:.8}
        .mc-nt{background:#FFF9EC;border-color:#e8d98a;color:#7a4d0a}.mc-nt .mc-lbl{color:#BA7517}.mc-nt .mc-val{color:#BA7517}
        .mc-tl{background:var(--teal-lt);border-color:rgba(15,110,86,.2);color:var(--teal)}.mc-tl .mc-lbl{color:var(--teal)}.mc-tl .mc-val{color:var(--teal)}
        .mc-am{background:var(--amber-lt);border-color:rgba(186,117,23,.2);color:#7a4d0a}.mc-am .mc-lbl{color:var(--amber)}.mc-am .mc-val{color:var(--amber)}
        .mc-rd{background:var(--red-lt);border-color:rgba(163,45,45,.2);color:var(--red)}.mc-rd .mc-lbl{color:var(--red)}.mc-rd .mc-val{color:var(--red)}
        .sem{position:absolute;top:10px;right:10px;width:8px;height:8px;border-radius:50%}
        .sem-ok{background:#22c55e}.sem-am{background:#f59e0b}.sem-rd{background:#ef4444}
        .mcrow4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
        .mcrow4b{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
        .ftbl{width:100%;border-collapse:collapse}
        .ftbl th{text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);padding:6px 10px;border-bottom:1px solid var(--g200)}
        .ftbl td{padding:7px 8px;border-bottom:1px solid var(--g100);vertical-align:middle}
        .fi{width:100%;padding:7px 10px;border:1.5px solid var(--g200);border-radius:8px;font-family:inherit;font-size:13px;background:white;outline:none}
        .ni{width:62px;padding:6px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--font-mono),monospace;font-size:13px;text-align:center;background:white;outline:none}
        .chk{width:32px;height:32px;border-radius:8px;border:1.5px solid var(--g200);background:white;display:flex;align-items:center;justify-content:center;font-size:15px;margin:auto;cursor:default}
        .chk.on{background:var(--teal-lt);border-color:var(--teal);color:var(--teal)}
        .pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600}
        .pill-gn{background:var(--teal-lt);color:var(--teal)}
        .lbadge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:var(--teal-lt);color:var(--teal)}
        .btn{padding:10px 18px;border:none;border-radius:var(--r);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
        .btn-pri{background:var(--blue);color:white}
        .btn-suc{background:var(--teal-lt);color:var(--teal);border:1.5px solid var(--teal)}
        .btn-sec{background:var(--g100);border:1.5px solid var(--g200);color:var(--g700)}
        .btn-w{width:100%;justify-content:center}
        .btn-lg{padding:13px 22px;font-size:14px}
        .nodo-card{background:white;border:2px solid var(--teal);border-radius:var(--rl);padding:16px 18px;margin-bottom:12px}
        .nodo-hdr{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .nodo-av{width:38px;height:38px;border-radius:50%;background:var(--teal);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;flex-shrink:0}
        .nodo-nm{font-size:14px;font-weight:600;color:var(--g900)}
        .nodo-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:var(--teal-lt);color:var(--teal)}
        .nodo-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px}
        .ns-lbl{color:var(--g400);margin-bottom:2px}
        .ns-val{font-family:var(--font-mono),monospace;font-weight:600;color:var(--g900);font-size:15px}
        .ev-table{width:100%;border-collapse:collapse;font-size:12px}
        .ev-table th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);padding:6px 10px;border-bottom:1px solid var(--g200)}
        .ev-table td{padding:8px 10px;border-bottom:1px solid var(--g100);color:var(--g700)}
        .ev-table td:first-child{font-weight:500;color:var(--g900)}
        .ev-table .total-row td{font-weight:600;color:var(--g900);border-top:2px solid var(--g200);background:var(--g100)}
        .stat-rd{color:var(--red)!important;font-weight:600}
        .vinc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}
        .vinc-card{background:var(--g100);border-radius:var(--r);padding:14px;border:1px solid var(--g200)}
        .vinc-card.best{background:var(--teal-lt);border-color:rgba(15,110,86,.3)}
        .vinc-lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);margin-bottom:6px}
        .vinc-card.best .vinc-lbl{color:var(--teal)}
        .vinc-val{font-size:28px;font-weight:600;font-family:var(--font-mono),monospace;color:var(--g900)}
        .vinc-card.best .vinc-val{color:var(--teal)}
        .vinc-sub{font-size:11px;color:var(--g400);margin-top:2px}
        #nodo-modal{position:fixed;inset:0 0 var(--guide-h) 0;background:rgba(0,55,129,.88);display:none;align-items:center;justify-content:center;z-index:300;padding:24px}
        #nodo-modal.open{display:flex}
        .nm-box{background:white;border-radius:20px;padding:32px 36px;max-width:440px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.4);animation:nmIn .3s ease}
        @keyframes nmIn{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
        .lcard{background:white;border-radius:20px;padding:36px 32px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
        .lfld{margin-bottom:14px}
        .lfld label{display:block;font-size:12px;font-weight:500;color:var(--g700);margin-bottom:6px}
        .lfld select,.lfld input{width:100%;padding:11px 14px;border:1.5px solid var(--g200);border-radius:var(--r);font-family:inherit;font-size:14px;color:var(--g900);background:white;outline:none;appearance:none}
        .intro-card,.end-card{background:white;border-radius:20px;padding:44px 36px;max-width:500px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.32);margin:24px}
        .intro-badge{display:inline-block;background:var(--blue-lt);color:var(--blue);font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;margin-bottom:14px;letter-spacing:.05em}
        .intro-ttl{font-size:24px;font-weight:600;color:var(--blue);margin-bottom:10px;line-height:1.2}
        .intro-sub{font-size:13px;color:var(--g400);line-height:1.7;margin-bottom:22px}
        .checklist{background:var(--g100);border-radius:12px;padding:14px 16px;text-align:left;font-size:13px;color:var(--g700);display:flex;flex-direction:column;gap:9px;margin-bottom:22px}
        .sc{padding:22px}
        .nbtn{padding:8px 16px;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap}
        .nbtn-prev{background:rgba(255,255,255,.08);color:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.18)}
        .nbtn-prev:hover{background:rgba(255,255,255,.15)}
        .nbtn-prev:disabled{opacity:.3;cursor:not-allowed}
        .nbtn-next{background:#cbf135;color:#003781}
        .nbtn-next:hover{background:#a8cc1a}
        @keyframes spulse{0%,100%{outline-color:rgba(202,252,5,.5)}50%{outline-color:rgba(202,252,5,1)}}
      `}</style>
    </div>
  )
}
