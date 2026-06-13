'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const SLIDES = [
  {
    headline: <>La profesión más<br/><span style={{color:'#a8cc1a'}}>noble</span> que existe<br/>en la Tierra.</>,
    body: `Nuestro trabajo no se trata de nosotros, sino de las personas a las que servimos. Proteger a una familia si alguien muere prematuramente, sostener un negocio en caso de enfermedad, generar ingresos de jubilación que duren toda la vida… <strong>¿Puede haber una profesión más noble que esta?</strong>`,
    duration: 13000,
  },
  {
    headline: <>El muro de<br/>la <span style={{color:'#8e35d4'}}>supervivencia.</span></>,
    body: `¿Por qué el <strong>91% de los asesores de seguros abandona su carrera en los primeros 4 años?</strong> Solo 9 de cada 100 logran continuar al cuarto año de actividad. Existe un muro invisible que muy pocos logran cruzar.`,
    duration: 12000,
  },
  {
    headline: <>Los asesores no fracasan<br/>porque no saben <span style={{color:'#8e35d4'}}>vender.</span></>,
    body: `Existe una <strong>desconexión crítica entre la actividad diaria y el resultado económico.</strong> La mayoría de las herramientas miden el pasado, pero no te dicen qué debes hacer hoy para asegurar tus ingresos de mañana.`,
    duration: 11000,
  },
  {
    headline: <>El gran vacío<br/>del sector.</>,
    body: `Existe una <strong>desconexión crítica entre la actividad diaria y el resultado económico.</strong> La mayoría de las herramientas miden el pasado, pero no te dicen qué debes hacer hoy para asegurar tus ingresos de mañana.`,
    duration: 11000,
  },
  {
    headline: <>La llegada de<br/>la <span style={{color:'#a8cc1a'}}>solución.</span></>,
    body: `<strong>Proxis: Prospección en práctica.</strong> Una plataforma integral diseñada bajo estándares internacionales de MDRT, GAMMA, LIMRA y COPAPROSE, basada en la praxis de expertos con más de 40 años de trayectoria en el desarrollo de ventas.`,
    duration: 13000,
  },
  {
    headline: <>El <span style={{color:'#a8cc1a'}}>Método.</span></>,
    body: `Toma el control con una <strong>bitácora semanal de prospección</strong> y el seguimiento de claves prácticas fundamentales. Proxis resuelve el problema del método: sabrás exactamente qué acciones realizar cada semana para construir una red inagotable de prospectos.`,
    duration: 12000,
  },
  {
    headline: <>El resultado<br/><span style={{color:'#a8cc1a'}}>diferencial.</span></>,
    body: `Transforma la prospección de una carga incierta en un <strong>hábito científico de alto rendimiento.</strong> No se trata solo de vender, sino de gestionar la actividad clave que garantiza tu permanencia y éxito en la industria de seguros y servicios financieros.`,
    duration: 12000,
  },
  {
    headline: <><span style={{color:'#a8cc1a'}}>Proxis.</span><p className="slide7-sub">Donde la actividad sistemática se convierte en <strong>libertad financiera.</strong></p></>,
    body: `Empieza hoy a construir la red que sostendrá tu carrera durante décadas.`,
    duration: 11000,
  },
]

export default function HomePage() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [bodyHtml, setBodyHtml] = useState(SLIDES[0].body)
  const [bodyVisible, setBodyVisible] = useState(true)
  const [eyebrowVal, setEyebrowVal] = useState('9.0%')
  const [fillWidths, setFillWidths] = useState<string[]>(SLIDES.map(() => '0%'))
  const [fillTransitions, setFillTransitions] = useState<string[]>(SLIDES.map(() => 'none'))
  const [leaving, setLeaving] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausedRef = useRef(false)
  const elapsedRef = useRef(0)
  const startRef = useRef<number>(0)
  const currentRef = useRef(0)
  const durationsRef = useRef(SLIDES.map(s => s.duration))

  const startFill = useCallback((idx: number, remaining: number) => {
    setFillWidths(prev => { const n = [...prev]; n[idx] = '0%'; return n })
    setFillTransitions(prev => { const n = [...prev]; n[idx] = 'none'; return n })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFillWidths(prev => { const n = [...prev]; n[idx] = '100%'; return n })
        setFillTransitions(prev => { const n = [...prev]; n[idx] = `width ${remaining / 1000}s linear`; return n })
      })
    })
  }, [])

  const goSlide = useCallback((n: number) => {
    const prev = currentRef.current
    setLeaving(prev)
    setTimeout(() => setLeaving(null), 700)

    setFillWidths(fw => { const x = [...fw]; x[prev] = '0%'; return x })
    setFillTransitions(ft => { const x = [...ft]; x[prev] = 'none'; return x })

    currentRef.current = n
    elapsedRef.current = 0
    pausedRef.current = false
    setPaused(false)
    setCurrent(n)

    setBodyVisible(false)
    setTimeout(() => {
      setBodyHtml(SLIDES[n].body)
      setBodyVisible(true)
    }, 300)

    const dur = durationsRef.current[n]
    startRef.current = Date.now()
    startFill(n, dur)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => goSlide((n + 1) % SLIDES.length), dur)
  }, [startFill])

  // Init
  useEffect(() => {
    startFill(0, SLIDES[0].duration)
    startRef.current = Date.now()
    timerRef.current = setTimeout(() => goSlide(1), SLIDES[0].duration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [goSlide, startFill])

  // Eyebrow counter
  useEffect(() => {
    let val = 9.0
    const id = setInterval(() => {
      val += (Math.random() - 0.5) * 0.002
      val = Math.max(8.95, Math.min(9.05, val))
      setEyebrowVal(val.toFixed(4) + '%')
    }, 800)
    return () => clearInterval(id)
  }, [])

  // Canvas network fractal
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let animId: number

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COLORS = [
      'rgba(195,188,178,0.55)',
      'rgba(182,196,178,0.45)',
      'rgba(196,186,198,0.45)',
      'rgba(196,193,175,0.50)',
      'rgba(178,196,191,0.45)',
    ]

    interface NodeObj {
      x: number; y: number; tx: number; ty: number
      color: string; radius: number; alpha: number
      born: number; children: NodeObj[]; parent: NodeObj | null
      lineAlpha: number
    }

    let nodes: NodeObj[] = []

    function spawnCluster(cx: number, cy: number, color: string) {
      const hub: NodeObj = {
        x: cx + (Math.random() - 0.5) * 40, y: cy + (Math.random() - 0.5) * 40,
        tx: 0, ty: 0, color, radius: 5, alpha: 0,
        born: performance.now() + Math.random() * 4000,
        children: [], parent: null, lineAlpha: 0
      }
      hub.tx = hub.x; hub.ty = hub.y
      nodes.push(hub)
      const childCount = 4 + Math.floor(Math.random() * 5)
      for (let i = 0; i < childCount; i++) {
        const angle = (Math.PI * 2 * i / childCount) + (Math.random() - 0.5) * 0.6
        const dist = 55 + Math.random() * 55
        const child: NodeObj = {
          x: hub.x + Math.cos(angle) * dist, y: hub.y + Math.sin(angle) * dist,
          tx: 0, ty: 0, color, radius: 3, alpha: 0,
          born: hub.born + 600 + i * 220 + Math.random() * 300,
          children: [], parent: hub, lineAlpha: 0
        }
        child.tx = child.x; child.ty = child.y
        hub.children.push(child); nodes.push(child)
        if (Math.random() < 0.35) {
          const gAngle = angle + (Math.random() - 0.5) * 1.2
          const gDist = 35 + Math.random() * 35
          const grand: NodeObj = {
            x: child.x + Math.cos(gAngle) * gDist, y: child.y + Math.sin(gAngle) * gDist,
            tx: 0, ty: 0, color, radius: 2.5, alpha: 0,
            born: child.born + 500 + Math.random() * 400,
            children: [], parent: child, lineAlpha: 0
          }
          grand.tx = grand.x; grand.ty = grand.y
          child.children.push(grand); nodes.push(grand)
        }
      }
    }

    function initClusters() {
      nodes = []
      const w = canvas!.width, h = canvas!.height
      const positions: [number, number][] = [[w * 0.18, h * 0.35], [w * 0.50, h * 0.55], [w * 0.78, h * 0.30]]
      positions.forEach(([x, y], i) => spawnCluster(x, y, COLORS[i % COLORS.length]))
    }
    initClusters()

    const driftId = setInterval(() => {
      nodes.forEach(n => {
        n.tx += (Math.random() - 0.5) * 14
        n.ty += (Math.random() - 0.5) * 8
        const w = canvas!.width, h = canvas!.height
        n.tx = Math.max(8, Math.min(w - 8, n.tx))
        n.ty = Math.max(8, Math.min(h - 8, n.ty))
      })
    }, 3000)

    const respawnId = setInterval(() => initClusters(), 28000)
    const ctx = canvas.getContext('2d')!

    function draw(ts: number) {
      animId = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      nodes.forEach(n => {
        n.x += (n.tx - n.x) * 0.008
        n.y += (n.ty - n.y) * 0.008
        if (ts >= n.born) { n.alpha = Math.min(1, n.alpha + 0.012); n.lineAlpha = Math.min(1, n.lineAlpha + 0.008) }
        if (n.alpha <= 0) return
        if (n.parent && n.parent.alpha > 0) {
          ctx.beginPath(); ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y)
          ctx.strokeStyle = n.color.replace(/[\d.]+\)$/, String(Math.min(n.alpha, n.parent.alpha) * 0.5) + ')')
          ctx.lineWidth = 0.8; ctx.stroke()
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = n.color.replace(/[\d.]+\)$/, n.alpha + ')'); ctx.fill()
      })
    }
    animId = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      clearInterval(driftId); clearInterval(respawnId)
      cancelAnimationFrame(animId)
    }
  }, [])

  function handlePause() {
    if (!pausedRef.current) {
      pausedRef.current = true
      setPaused(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      elapsedRef.current += Date.now() - startRef.current
    } else {
      pausedRef.current = false
      setPaused(false)
      const remaining = Math.max(500, durationsRef.current[currentRef.current] - elapsedRef.current)
      startRef.current = Date.now()
      startFill(currentRef.current, remaining)
      timerRef.current = setTimeout(() => goSlide((currentRef.current + 1) % SLIDES.length), remaining)
    }
  }

  return (
    <main>
      <div className="dot-bg" />

      <div className="hero">
        <div className="eyebrow-bar">
          <span className="eyebrow-label">Tasa de retención a 4 años · industria de seguros de vida:</span>
          <span className="eyebrow-value">{eyebrowVal}</span>
        </div>

        <div className="headline-area" onMouseEnter={() => !pausedRef.current && handlePause()} onMouseLeave={() => pausedRef.current && handlePause()}>
          {SLIDES.map((s, i) => (
            <div
              key={i}
              className={`headline-slide${i === current ? ' active' : ''}${i === leaving ? ' leaving' : ''}`}
            >
              <h1>{s.headline}</h1>
            </div>
          ))}
        </div>

        <p
          className="body-text"
          style={{ opacity: bodyVisible ? 1 : 0, transition: 'opacity 0.5s' }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        <div className="progress-bars">
          {SLIDES.map((_, i) => (
            <button key={i} className={`prog-bar${i === current ? ' active' : ''}`} onClick={() => goSlide(i)}>
              <div
                className="fill"
                style={{ width: fillWidths[i], transition: fillTransitions[i] }}
              />
            </button>
          ))}
          <button className="pause-btn" onClick={handlePause} title={paused ? 'Reanudar' : 'Pausar'}>
            {paused ? (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                <polygon points="0,0 10,6 0,12"/>
              </svg>
            ) : (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                <rect x="0" y="0" width="3" height="12" rx="1"/>
                <rect x="7" y="0" width="3" height="12" rx="1"/>
              </svg>
            )}
          </button>
        </div>

        <div className="cta-row">
          <Link href="/login" className="cta-primary">Ver tutorial →</Link>
          <Link href="/app" className="cta-secondary">Abrir Proxis</Link>
        </div>

        <div className="animation-wrap">
          <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }} />
          <div className="animation-inner" style={{ position:'relative', zIndex:1 }}>
            <div className="float-card card-1">
              <div className="float-status"><div className="status-dot dot-purple"/>Prospecto nuevo</div>
              <div className="float-detail">Ana González</div>
              <div className="float-sub">Ref. → María Rojas · Semana 3</div>
            </div>
            <div className="float-card card-2">
              <div className="float-status"><div className="status-dot dot-green"/>Prospectos entregados</div>
              <div className="float-detail">Carlos Mendoza</div>
              <div className="float-amount" style={{fontSize:15,marginTop:2}}>4 nombres</div>
              <div className="float-sub">familiares y amigos</div>
            </div>
            <div className="dashboard-card">
              <div className="dash-header">
                <span className="dash-title" style={{display:'flex',alignItems:'center',gap:7}}>
                  <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="4.5" fill="#cbf135"/>
                    <circle cx="6" cy="9" r="3" fill="#cbf135" opacity="0.85"/>
                    <circle cx="26" cy="9" r="3" fill="#cbf135" opacity="0.85"/>
                    <circle cx="6" cy="23" r="3" fill="#cbf135" opacity="0.6"/>
                    <circle cx="26" cy="23" r="3" fill="#cbf135" opacity="0.6"/>
                    <line x1="8.6" y1="10.6" x2="13.2" y2="14.0" stroke="#cbf135" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
                    <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke="#cbf135" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
                    <line x1="8.6" y1="21.4" x2="13.2" y2="18.0" stroke="#cbf135" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                    <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke="#cbf135" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                  <span style={{fontWeight:800,letterSpacing:'-0.02em'}}>Pro<span style={{color:'#cbf135'}}>xis</span></span>
                  <span style={{fontWeight:400,opacity:0.5,fontSize:11}}>· Agencia Viña del Mar</span>
                </span>
                <span className="dash-week">Semana 3 / Dic 2025</span>
              </div>
              <div className="dash-body">
                {[
                  {name:'Ana González',via:'vía María Rojas',badge:'badge-prospect',label:'Prospecto'},
                  {name:'Carlos Mendoza',via:'contacto directo',badge:'badge-prospect',label:'Prospecto'},
                  {name:'Roberto Fuentes',via:'vía Carlos Mendoza',badge:'badge-contact',label:'Contacto'},
                  {name:'Valentina Rivas',via:'vía Ana González',badge:'badge-prospect',label:'Prospecto'},
                ].map(r => (
                  <div key={r.name} className="dash-row">
                    <div><div className="dash-name">{r.name}</div><div className="dash-via">{r.via}</div></div>
                    <span className={`badge ${r.badge}`}>{r.label}</span>
                  </div>
                ))}
              </div>
              <div className="dash-meta">
                <span className="meta-label">Meta mensual</span>
                <div className="meta-bar-wrap"><div className="meta-bar-fill"/></div>
                <span className="meta-pct">68%</span>
              </div>
            </div>
            <div className="float-card card-3">
              <div className="float-status"><div className="status-dot dot-lime"/>Entrega de póliza</div>
              <div className="float-detail">Roberto Fuentes</div>
              <div className="float-sub">vía Carlos Mendoza</div>
            </div>
            <div className="float-card card-4">
              <div className="float-status"><div className="status-dot dot-orange"/>Meta semanal</div>
              <div className="float-detail">Contactos: 14 / 20</div>
              <div className="float-sub">Cierres proyectados: 2.8</div>
            </div>
          </div>
        </div>
      </div>

      <section className="science-section">
        <div className="science-inner">
          <div className="section-eyebrow"/>
          <h2 className="section-title">Avalado por la Ciencia de la Praxis</h2>
          <table className="science-table">
            <thead>
              <tr>
                <th>Fuente / Método</th>
                <th>Aplicación en Proxis</th>
                <th>Impacto en el asesor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="source-col">LIMRA / GAMA</td>
                <td>Indicadores de efectividad estandarizados.</td>
                <td>Elimina la incertidumbre del <em>&quot;no sé cuánto hacer&quot;</em>.</td>
              </tr>
              <tr>
                <td className="source-col">MDRT / GRANUM</td>
                <td>Gestión de actividad de élite.</td>
                <td>Eleva el estándar de profesionalismo.</td>
              </tr>
              <tr>
                <td className="source-col">40 Años de Praxis</td>
                <td>Experiencia real de campo.</td>
                <td>Evita errores comunes de novatos y veteranos.</td>
              </tr>
            </tbody>
          </table>
          <div className="science-seal-row">
            <p className="science-seal-text">Metodología construida con expertos internacionales para el desarrollo de ventas de alto nivel.</p>
          </div>
        </div>
      </section>

      <section className="habit-section">
        <div className="habit-inner">
          <div className="section-eyebrow"/>
          <h2 className="section-title">De la Ansiedad al Hábito</h2>
          <div className="habit-cards">
            {[
              { img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80&fit=crop', alt: 'Asesor latino hablando con cliente', tag: 'Foco en actividad', text: 'Elimina el estrés de los resultados enfocándote en las acciones clave que sí controlas.' },
              { img: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80&fit=crop', alt: 'Ejecutivos de venta diversos en reunión', tag: 'Red recurrente', text: 'Construye una infraestructura de contactos que se alimenta de forma automática.' },
              { img: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&q=80&fit=crop', alt: 'Mujer ejecutiva sonriendo en presentación', tag: 'Control de carrera', text: 'Transforma tu negocio de una apuesta incierta a un sistema de ingresos predecible.' },
            ].map(card => (
              <div key={card.tag} className="habit-card">
                <div className="habit-img-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.img} alt={card.alt} loading="lazy"/>
                </div>
                <div className="habit-card-body">
                  <div className="habit-tag">{card.tag}</div>
                  <p>{card.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .hero { position:relative; z-index:1; padding-top:120px; padding-bottom:0; max-width:1240px; margin:0 auto; padding-left:48px; padding-right:48px; }
        .eyebrow-bar { display:flex; align-items:center; gap:12px; margin-bottom:24px; opacity:0; animation:fadeIn 0.5s ease 0.1s forwards; }
        .eyebrow-label { font-family:var(--font-mono),monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--gray-3); }
        .eyebrow-value { font-family:var(--font-mono),monospace; font-size:11px; letter-spacing:0.05em; color:var(--gray-1); font-weight:500; background:var(--gray-5); padding:3px 8px; border-radius:4px; border:1px solid var(--gray-4); }
        .headline-area { max-width:820px; min-height:180px; margin-bottom:32px; position:relative; opacity:0; animation:fadeIn 0.5s ease 0.2s forwards; }
        .headline-slide { position:absolute; top:0; left:0; width:100%; opacity:0; transform:translateY(8px); transition:opacity 0.9s ease, transform 0.9s cubic-bezier(0.16,1,0.3,1); pointer-events:none; }
        .headline-slide.active { opacity:1; transform:translateY(0); pointer-events:auto; position:relative; }
        .headline-slide.leaving { opacity:0; transform:translateY(-6px); position:absolute; transition:opacity 0.6s ease, transform 0.6s ease; }
        h1 { font-weight:800; font-size:clamp(48px,5.8vw,76px); line-height:1.06; letter-spacing:-0.04em; color:var(--black); }
        .slide7-sub { font-size:28px; font-weight:500; line-height:1.4; color:var(--gray-2); max-width:640px; margin-top:24px; }
        .slide7-sub strong { color:var(--gray-1); font-weight:700; }
        .body-text { font-size:18px; line-height:1.65; color:var(--gray-2); max-width:560px; margin-bottom:36px; opacity:0; animation:fadeIn 0.5s ease 0.4s forwards; }
        .body-text strong { color:var(--gray-1); font-weight:600; }
        .progress-bars { display:flex; align-items:center; gap:6px; margin-bottom:32px; opacity:0; animation:fadeIn 0.5s ease 0.5s forwards; }
        .prog-bar { height:3px; width:40px; background:var(--gray-5); border-radius:2px; cursor:pointer; border:none; padding:0; position:relative; overflow:hidden; transition:width 0.3s; }
        .prog-bar.active { width:80px; }
        .prog-bar .fill { position:absolute; top:0; left:0; bottom:0; background:var(--black); border-radius:2px; width:0%; }
        .pause-btn { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border:1.5px solid var(--gray-4); border-radius:50%; background:transparent; cursor:pointer; padding:0; margin-left:4px; color:var(--gray-3); transition:border-color 0.15s,color 0.15s; flex-shrink:0; }
        .pause-btn:hover { border-color:var(--gray-2); color:var(--gray-1); }
        .cta-row { display:flex; align-items:center; gap:12px; opacity:0; animation:fadeIn 0.5s ease 0.6s forwards; flex-wrap:wrap; margin-bottom:64px; }
        .cta-primary { display:inline-flex; align-items:center; gap:8px; padding:14px 28px; background:var(--lime); color:var(--black); border-radius:10px; font-weight:700; font-size:15px; cursor:pointer; text-decoration:none; border:none; transition:all 0.15s ease; letter-spacing:-0.01em; }
        .cta-primary:hover { background:var(--lime-dk); transform:translateY(-2px); box-shadow:0 8px 28px rgba(168,204,26,0.35); }
        .cta-secondary { display:inline-flex; align-items:center; gap:8px; padding:14px 24px; background:transparent; color:var(--gray-1); border-radius:10px; font-weight:600; font-size:15px; cursor:pointer; text-decoration:none; border:1.5px solid var(--gray-4); transition:all 0.15s ease; letter-spacing:-0.01em; }
        .cta-secondary:hover { border-color:var(--gray-3); background:var(--gray-5); }
        .animation-wrap { position:relative; background:var(--gray-bg); border-radius:20px 20px 0 0; border:1px solid var(--gray-5); border-bottom:none; min-height:420px; overflow:hidden; margin-left:-48px; margin-right:-48px; opacity:0; animation:fadeIn 0.8s ease 0.9s forwards; }
        .animation-inner { position:relative; max-width:960px; margin:0 auto; padding:60px 48px 0; min-height:420px; }
        .dashboard-card { background:var(--white); border:1px solid var(--gray-4); border-radius:12px; box-shadow:var(--shadow-lg); width:460px; margin:0 auto; overflow:hidden; }
        .dash-header { background:var(--black); padding:12px 20px; display:flex; align-items:center; justify-content:space-between; }
        .dash-title { font-size:12px; font-weight:600; color:rgba(255,255,255,0.9); letter-spacing:0.02em; }
        .dash-week { font-family:var(--font-mono),monospace; font-size:10px; color:var(--lime); letter-spacing:0.08em; }
        .dash-body { padding:20px; }
        .dash-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--gray-5); }
        .dash-row:last-child { border-bottom:none; }
        .dash-name { font-size:13px; font-weight:600; color:var(--gray-1); }
        .dash-via { font-size:11px; color:var(--gray-3); margin-top:2px; font-family:var(--font-mono),monospace; }
        .badge { font-size:10px; font-weight:700; padding:4px 10px; border-radius:20px; letter-spacing:0.03em; text-transform:uppercase; white-space:nowrap; }
        .badge-contact { background:#f0eeeb; color:var(--gray-2); }
        .badge-prospect { background:#f0e4ff; color:var(--purple); }
        .dash-meta { padding:14px 20px; background:var(--gray-bg); border-top:1px solid var(--gray-5); display:flex; align-items:center; justify-content:space-between; }
        .meta-label { font-family:var(--font-mono),monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:var(--gray-3); }
        .meta-bar-wrap { flex:1; margin:0 16px; height:4px; background:var(--gray-5); border-radius:2px; overflow:hidden; }
        .meta-bar-fill { height:100%; background:var(--lime-dk); border-radius:2px; width:0%; animation:growBar 1.5s ease 2s forwards; }
        @keyframes growBar { to { width:68% } }
        .meta-pct { font-family:var(--font-mono),monospace; font-size:12px; font-weight:500; color:var(--gray-1); }
        .float-card { position:absolute; background:var(--white); border:1px solid var(--gray-4); border-radius:10px; box-shadow:var(--shadow-lg); padding:12px 16px; min-width:180px; opacity:0; transform:translateY(8px); }
        .float-card.card-1 { top:40px; left:20px; animation:cardIn 0.5s cubic-bezier(0.16,1,0.3,1) 1.6s forwards; }
        .float-card.card-2 { top:40px; right:20px; animation:cardIn 0.5s cubic-bezier(0.16,1,0.3,1) 2.4s forwards; }
        .float-card.card-3 { bottom:60px; left:30px; animation:cardIn 0.5s cubic-bezier(0.16,1,0.3,1) 3.0s forwards; }
        .float-card.card-4 { bottom:60px; right:30px; animation:cardIn 0.5s cubic-bezier(0.16,1,0.3,1) 3.6s forwards; }
        @keyframes cardIn { to { opacity:1; transform:translateY(0); } }
        .float-status { display:flex; align-items:center; gap:6px; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--gray-2); margin-bottom:8px; }
        .status-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .dot-green { background:var(--green); box-shadow:0 0 6px rgba(26,158,74,0.5); }
        .dot-lime { background:var(--lime-dk); box-shadow:0 0 6px rgba(168,204,26,0.5); }
        .dot-purple { background:var(--purple); box-shadow:0 0 6px rgba(142,53,212,0.4); }
        .dot-orange { background:var(--orange); }
        .float-detail { font-size:13px; font-weight:600; color:var(--gray-1); line-height:1.3; }
        .float-sub { font-family:var(--font-mono),monospace; font-size:10px; color:var(--gray-3); margin-top:3px; }
        .float-amount { font-size:18px; font-weight:800; color:var(--gray-1); letter-spacing:-0.03em; margin-top:4px; }
        .science-section { position:relative; z-index:1; background:var(--black); padding:80px 48px; }
        .science-inner,.habit-inner { max-width:1140px; margin:0 auto; }
        .section-eyebrow { width:4px; height:36px; background:var(--lime); border-radius:2px; margin-bottom:24px; }
        .section-title { font-weight:800; font-size:clamp(28px,3vw,42px); letter-spacing:-0.03em; color:var(--white); margin-bottom:48px; line-height:1.1; }
        .habit-section .section-title { color:var(--black); }
        .science-table { width:100%; border-collapse:collapse; margin-bottom:48px; }
        .science-table thead th { font-family:var(--font-mono),monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--lime-dk); padding:0 0 16px 0; text-align:left; border-bottom:1px solid rgba(255,255,255,0.1); }
        .science-table tbody tr { border-bottom:1px solid rgba(255,255,255,0.06); }
        .science-table tbody tr:last-child { border-bottom:none; }
        .science-table tbody td { padding:20px 0; font-size:15px; line-height:1.5; color:rgba(255,255,255,0.75); vertical-align:top; }
        .science-table tbody td:not(:last-child) { padding-right:40px; }
        .source-col { font-weight:700; color:var(--white) !important; white-space:nowrap; min-width:160px; }
        .science-seal-row { display:flex; align-items:center; gap:24px; padding-top:32px; border-top:1px solid rgba(255,255,255,0.08); }
        .science-seal-text { font-size:15px; line-height:1.6; color:rgba(255,255,255,0.6); max-width:560px; }
        .habit-section { position:relative; z-index:1; background:var(--gray-bg); padding:80px 48px; }
        .habit-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
        .habit-card { background:var(--white); border:1px solid var(--gray-5); border-radius:14px; overflow:hidden; box-shadow:var(--shadow); transition:transform 0.2s,box-shadow 0.2s; }
        .habit-card:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); }
        .habit-img-wrap { width:100%; aspect-ratio:16/9; overflow:hidden; background:var(--gray-5); }
        .habit-img-wrap img { width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.4s ease; }
        .habit-card:hover .habit-img-wrap img { transform:scale(1.04); }
        .habit-card-body { padding:24px; }
        .habit-tag { font-family:var(--font-mono),monospace; font-size:11px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:var(--lime-dk); margin-bottom:10px; }
        .habit-card-body p { font-size:15px; line-height:1.65; color:var(--gray-2); }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width:768px) {
          .hero { padding-left:20px; padding-right:20px; padding-top:90px; }
          h1 { font-size:40px; }
          .animation-wrap { margin-left:-20px; margin-right:-20px; }
          .animation-inner { padding:40px 20px 0; }
          .dashboard-card { width:100%; }
          .float-card.card-1,.float-card.card-3 { left:4px; }
          .float-card.card-2,.float-card.card-4 { right:4px; }
          .science-section,.habit-section { padding:56px 20px; }
          .habit-cards { grid-template-columns:1fr; }
          .science-table thead { display:none; }
          .science-table tbody td { display:block; padding:6px 0; }
          .source-col { padding-top:20px !important; }
        }
      `}</style>
    </main>
  )
}
