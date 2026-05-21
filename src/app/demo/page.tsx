'use client'
import { useState, useEffect, useRef } from 'react'

const T = {
  s1: 3.9, s2: 14, s3: 28, s4: 35, s4_end: 44, s5: 46, s5_end: 57,
  s6: 60, s6_end: 68, s7_veil: 64, s7_text: 70, s7_end: 80, cta: 82,
}

const ALIVE_DOTS = new Set([5,16,23,34,48,57,69,75,86])

export default function Demo() {
  const [startGone, setStartGone] = useState(false)
  const [ctaState, setCtaState] = useState<'idle'|'sending'|'sent'>('idle')
  const vidRef = useRef<HTMLVideoElement>(null)
  const tickerRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const startRef = useRef<() => void>(() => {})
  const jumpToRef = useRef<(n: number) => void>(() => {})

  useEffect(() => {
    const PANELS = ['p1','p2','p3','p4','p5','p6']
    let cur = 0
    let s7Timers: ReturnType<typeof setTimeout>[] = []

    function vis(id: string, show: boolean) {
      const el = document.getElementById(id)
      if (el) el.classList.toggle('vis', show)
    }

    function setPip(n: number) {
      document.querySelectorAll('.pp').forEach((p, i) => p.classList.toggle('cur', i === n))
    }

    function clearS7Timers() {
      s7Timers.forEach(clearTimeout)
      s7Timers = []
    }

    function countUp(id: string, from: number, to: number, dur: number, fmt: (v: number) => string) {
      const el = document.getElementById(id)
      if (!el) return
      const s = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - s) / dur, 1)
        const e = 1 - Math.pow(1 - p, 3)
        el.textContent = fmt(Math.round(from + e * (to - from)))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    function triggerDots() {
      for (let i = 0; i < 100; i++) {
        const d = document.getElementById('dp' + i)
        if (d) d.className = 'dp ' + (ALIVE_DOTS.has(i) ? 'alive' : 'dead')
      }
    }

    function triggerDash() {
      const bars: [string, string, number, number, number][] = [
        ['b1','n1',14,20,1200],['b2','n2',32,45,1900],['b3','n3',29,40,2600],['b4','n4',25,35,3300]
      ]
      bars.forEach(([b, n]) => {
        const bel = document.getElementById(b)
        const nel = document.getElementById(n)
        if (bel) bel.style.width = '0'
        if (nel) nel.textContent = '—'
      })
      const gpct = document.getElementById('gpct')
      if (gpct) gpct.textContent = '—'
      bars.forEach(([b, n, pct, val, d]) => {
        setTimeout(() => {
          const bel = document.getElementById(b)
          if (bel) bel.style.width = pct + '%'
          countUp(n, 0, val, 900, v => String(v))
        }, d)
      })
      setTimeout(() => countUp('gpct', 0, 100, 1400, v => v + '%'), 4400)
    }

    function triggerStats() {
      setTimeout(() => countUp('c1', 0, 30, 1600, v => '+' + v + '%'), 800)
      setTimeout(() => countUp('c2', 0, 60, 1600, v => '+' + v + '%'), 1100)
      setTimeout(() => countUp('c3', 0, 15, 1600, v => '+' + v + '%'), 1400)
    }

    function showOnly(id: string | null, pip: number) {
      clearS7Timers()
      PANELS.forEach(p => vis(p, false))
      vis('p0', false)
      vis('s7panel', false)
      vis('s7logo', false)
      vis('distVeil', false)
      vis('ctaScreen', false)
      setTimeout(() => {
        if (id) vis(id, true)
        setPip(pip)
      }, 600)
    }

    function jumpTo(n: number) {
      if      (n === 0)  { showOnly(null, 0); vis('p0', true) }
      else if (n === 1)  { showOnly('p1', 1); setTimeout(triggerDots, 100) }
      else if (n === 2)  { showOnly('p2', 2) }
      else if (n === 3)  { showOnly('p3', 3); setTimeout(() => {
        const cw = document.getElementById('crossWord')
        if (cw) cw.classList.add('struck')
      }, 800) }
      else if (n === 4)  { showOnly('p4', 4); setTimeout(triggerDash, 650) }
      else if (n === 5)  { showOnly(null, 5) }
      else if (n === 6)  { showOnly('p5', 6); setTimeout(triggerStats, 650) }
      else if (n === 7)  { showOnly(null, 7) }
      else if (n === 8)  { showOnly('p6', 8) }
      else if (n === 9)  { showOnly(null, 9) }
      else if (n === 10) {
        clearS7Timers()
        setPip(10)
        vis('distVeil', true)
        s7Timers.push(setTimeout(() => vis('s7logo', true), 800))
      }
      else if (n === 11) {
        vis('p6', false)
        vis('s7panel', true)
        setPip(11)
        cur = n; return
      }
      else if (n === 12) { showOnly(null, 12); vis('ctaScreen', true) }
      cur = n
    }

    jumpToRef.current = jumpTo

    function startTicker() {
      const t0 = performance.now()
      tickerRef.current = setInterval(() => {
        const e = (performance.now() - t0) / 1000
        if      (e >= T.cta     && cur < 12) jumpTo(12)
        else if (e >= T.s7_end  && cur < 12 && cur >= 10) {
          vis('s7panel', false)
          vis('distVeil', false)
          vis('s7logo', false)
        }
        else if (e >= T.s7_text && cur < 11) jumpTo(11)
        else if (e >= T.s7_veil && cur < 10) jumpTo(10)
        else if (e >= T.s6      && cur < 8)  jumpTo(8)
        else if (e >= T.s5_end  && cur < 7)  jumpTo(7)
        else if (e >= T.s5      && cur < 6)  jumpTo(6)
        else if (e >= T.s4_end  && cur < 5)  jumpTo(5)
        else if (e >= T.s4      && cur < 4)  jumpTo(4)
        else if (e >= T.s3      && cur < 3)  jumpTo(3)
        else if (e >= T.s2      && cur < 2)  jumpTo(2)
        else if (e >= T.s1      && cur < 1)  jumpTo(1)
      }, 250)
    }

    function start() {
      setStartGone(true)
      if (vidRef.current) {
        vidRef.current.currentTime = 0
        vidRef.current.play().catch(() => {})
      }
      startTicker()
    }

    startRef.current = start

    // Keyboard handler
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (cur < 8) jumpTo(cur + 1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (cur > 0) jumpTo(cur - 1) }
    }
    document.addEventListener('keydown', keyHandler)

    // Initial: show p0
    vis('p0', true)
    setPip(0)

    return () => {
      document.removeEventListener('keydown', keyHandler)
      if (tickerRef.current) clearInterval(tickerRef.current)
      clearS7Timers()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    setCtaState('sending')
    try {
      const res = await fetch('https://formspree.io/f/meedepzg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      })
      if (res.ok) { setCtaState('sent'); form.reset() }
      else throw new Error('Error')
    } catch {
      form.submit()
    }
  }

  // SVG network logo (reused multiple times)
  const NetworkSvg = ({ cls = '', size = 200 }: { cls?: string, size?: number }) => (
    <svg className={cls} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      <line x1="100" y1="100" x2="40"  y2="56"  stroke="#a8cc1a" strokeWidth="8" strokeLinecap="round"/>
      <line x1="100" y1="100" x2="160" y2="56"  stroke="#a8cc1a" strokeWidth="8" strokeLinecap="round"/>
      <line x1="100" y1="100" x2="40"  y2="144" stroke="#a8cc1a" strokeWidth="8" strokeLinecap="round" opacity="0.7"/>
      <line x1="100" y1="100" x2="160" y2="144" stroke="#a8cc1a" strokeWidth="8" strokeLinecap="round" opacity="0.7"/>
      <circle cx="40"  cy="56"  r="18" fill="#a8cc1a" opacity="0.85"/>
      <circle cx="160" cy="56"  r="18" fill="#a8cc1a" opacity="0.85"/>
      <circle cx="40"  cy="144" r="18" fill="#a8cc1a" opacity="0.6"/>
      <circle cx="160" cy="144" r="18" fill="#a8cc1a" opacity="0.6"/>
      <circle cx="100" cy="100" r="28" fill="#cbf135"/>
    </svg>
  )

  return (
    <>
      <style>{`
:root{--lime:#cbf135;--purple:#8e35d4;--black:#0b0a09;--panel:rgba(10,9,8,0.63)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:var(--font-jakarta,'Plus Jakarta Sans',sans-serif);-webkit-font-smoothing:antialiased}
#videoWrap{position:fixed;inset:0;z-index:0}
#videoWrap video{width:100%;height:100%;object-fit:cover;pointer-events:none}
#panels{position:fixed;inset:0;z-index:20;pointer-events:none}
.panel{position:absolute;background:var(--panel);border-radius:10px;padding:22px 26px;opacity:0;transition:opacity 0.65s ease;pointer-events:none}
.panel.exit{opacity:0;transition:opacity 0.5s ease}
.panel.vis{opacity:1;pointer-events:all}
.eyebrow{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(8px,0.85vw,10px);letter-spacing:.15em;text-transform:uppercase;color:rgba(203,241,53,0.75);margin-bottom:10px}
.h1{font-size:clamp(20px,3.2vw,38px);font-weight:800;letter-spacing:-0.03em;line-height:1.1;color:#fff;margin-bottom:14px}
.h1 .lime{color:var(--lime)}
.h1 .red{color:#e05050}
.sub{font-size:clamp(10px,1.1vw,13px);color:rgba(255,255,255,0.48);line-height:1.65}
#dotGrid{display:grid;grid-template-columns:repeat(10,1fr);gap:7px;margin-bottom:14px}
.dp{width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,0.08);transition:background 0.5s ease,box-shadow 0.5s ease}
.dp.alive{background:var(--lime);box-shadow:0 0 9px rgba(203,241,53,.75);animation:pulse 2.2s ease-in-out infinite}
.dp.dead{background:rgba(255,255,255,0.03)}
.s1-big{font-size:clamp(52px,8.5vw,96px);font-weight:800;letter-spacing:-0.05em;line-height:1;color:#fff;margin-bottom:6px}
.s1-big .lime{color:var(--lime)}
.s1-sm{font-size:clamp(11px,1.3vw,14px);color:rgba(255,255,255,0.52)}
#p1 .eyebrow{font-size:clamp(24px,3vw,36px);text-align:justify}
#p1 .s1-sm{font-size:clamp(24px,3vw,36px);text-align:justify}
.names{display:flex;flex-direction:column;gap:5px;margin-top:12px}
.nr{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;border-radius:5px;font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(12px,1.2vw,14px)}
.nr.ex{background:rgba(224,48,48,0.06);border:0.5px solid rgba(224,48,48,0.14)}
.nr.ok{background:rgba(26,158,74,0.07);border:0.5px solid rgba(26,158,74,0.14)}
.nr.ex .nn{text-decoration:line-through;color:rgba(255,255,255,0.2)}
.nr.ok .nn{color:rgba(255,255,255,0.6)}
.nb{font-size:clamp(11px,1vw,13px);padding:2px 6px;border-radius:3px}
.nr.ex .nb{background:rgba(224,48,48,0.14);color:#e07070}
.nr.ok .nb{background:rgba(26,158,74,0.14);color:#60d890}
.s2-foot{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(11px,1vw,13px);color:rgba(255,255,255,0.2);margin-top:10px}
.s3-l1{font-size:clamp(18px,2.8vw,34px);font-weight:800;letter-spacing:-0.03em;color:rgba(255,255,255,0.4);line-height:1.1;margin-bottom:8px}
.s3-cross{position:relative;display:inline-block}
.s3-cross::after{content:'';position:absolute;left:-2px;top:52%;height:4px;background:#e03030;border-radius:2px;width:0;transform:translateY(-50%);transition:width 0.4s ease}
.s3-cross.struck::after{width:108%}
.s3-l2{font-size:clamp(20px,3.2vw,38px);font-weight:800;letter-spacing:-0.03em;color:#fff;line-height:1.1;margin-bottom:14px}
.s3-l2 .lime{color:var(--lime)}
.dash{background:rgba(16,15,13,0.9);border:0.5px solid rgba(255,255,255,0.1);border-radius:10px;overflow:hidden;margin-top:14px}
.dash-hdr{background:rgba(255,255,255,0.04);padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:0.5px solid rgba(255,255,255,0.06)}
.dash-t{font-size:clamp(8px,0.8vw,10px);font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:.02em}
.dash-badge{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(7px,0.7vw,9px);color:var(--lime);letter-spacing:.06em}
.dash-body{padding:8px 14px}
.dash-row{display:flex;align-items:center;gap:9px;padding:5px 0;border-bottom:0.5px solid rgba(255,255,255,0.04)}
.dash-row:last-child{border-bottom:none}
.dash-wk{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(8px,0.75vw,9px);color:rgba(255,255,255,0.3);min-width:55px}
.dash-bg{flex:1;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden}
.dash-bar{height:100%;border-radius:2px;background:var(--lime);width:0;transition:width 1s cubic-bezier(0.4,0,0.2,1)}
.dash-n{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(9px,0.85vw,11px);color:var(--lime);min-width:28px;text-align:right}
.dash-foot{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;background:rgba(203,241,53,0.05);border-top:0.5px solid rgba(203,241,53,0.12)}
.dash-fl{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(7px,0.7vw,9px);color:rgba(203,241,53,0.55);letter-spacing:.06em}
.dash-pct{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(16px,2vw,22px);font-weight:800;color:var(--lime)}
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
.sc{background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 10px;text-align:center}
.sc-n{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(24px,3.2vw,38px);font-weight:800;color:var(--lime);letter-spacing:-0.04em;line-height:1}
.sc-l{font-size:clamp(8px,0.8vw,10px);color:rgba(255,255,255,0.35);margin-top:5px;line-height:1.4}
.testi{background:rgba(142,53,212,0.08);border-left:3px solid var(--purple);border-radius:0 8px 8px 0;padding:12px 16px;margin-top:10px}
.tq{font-size:clamp(9px,1vw,12px);color:rgba(255,255,255,0.62);line-height:1.65;font-style:italic;margin-bottom:8px}
.ta{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(7px,0.7vw,9px);color:rgba(142,53,212,0.75);letter-spacing:.05em}
.bens{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}
.ben{display:flex;align-items:center;gap:9px;padding:8px 12px;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.06);border-radius:8px}
.bd{width:6px;height:6px;border-radius:50%;background:var(--lime);flex-shrink:0}
.bt{font-size:clamp(9px,0.95vw,11px);color:rgba(255,255,255,0.58);font-weight:500}
.s6-fn{font-family:var(--font-mono,'DM Mono',monospace);font-size:clamp(7px,0.65vw,8px);color:rgba(255,255,255,0.18);margin-top:10px;line-height:1.55}
#p6 .h1{white-space:nowrap}
#p6 .bens,#p6 .s6-fn{width:100%}
#s7panel{position:absolute;left:5%;top:50%;transform:translateY(-50%);max-width:56%;background:rgba(10,9,8,0.35);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:22px 26px;opacity:0;transition:opacity 1.2s ease}
#s7panel.vis{opacity:1}
.s7-l1{font-size:clamp(16px,2.8vw,34px);font-weight:700;color:rgba(255,255,255,0.78);line-height:1.25;margin-bottom:10px}
.s7-l1 .lime{color:var(--lime)}
.s7-l2{font-size:clamp(20px,3.5vw,44px);font-weight:800;letter-spacing:-0.03em;line-height:1.15;color:#fff}
.s7-l2 .lime{color:var(--lime)}
#s7logo{position:fixed;right:9.5%;top:50%;transform:translate(-50%,-50%);width:16.6vw;height:auto;z-index:21;display:flex;flex-direction:column;align-items:center;gap:1.4vw;pointer-events:none;opacity:0;transition:opacity 1s ease}
#s7logo.vis{opacity:1}
#s7logo .s7l-halo{position:absolute;left:50%;top:50%;width:140%;aspect-ratio:1;transform:translate(-50%,-50%) scale(0.4);border-radius:50%;background:radial-gradient(circle,rgba(203,241,53,0.18) 0%,rgba(168,204,26,0.06) 35%,transparent 70%);filter:blur(20px);opacity:0;pointer-events:none}
#s7logo.vis .s7l-halo{animation:s7lHalo 1.8s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes s7lHalo{0%{opacity:0;transform:translate(-50%,-50%) scale(0.4)}60%{opacity:0.9;transform:translate(-50%,-50%) scale(1.05)}100%{opacity:0.85;transform:translate(-50%,-50%) scale(1.02)}}
#s7logo .s7l-network{width:11vw;height:11vw;z-index:1;filter:drop-shadow(0 0 1.5vw rgba(203,241,53,0.25))}
#s7logo .s7l-node{transform-origin:center;transform-box:fill-box;opacity:0;transform:scale(0)}
#s7logo .s7l-link{stroke-dasharray:60;stroke-dashoffset:60;opacity:0}
#s7logo.vis .s7l-node-center{animation:p0PopIn 0.6s cubic-bezier(.34,1.56,.64,1) 0.10s forwards,p0Pulse 1.6s ease-in-out 2.8s infinite}
#s7logo.vis .s7l-node-tl{animation:p0PopIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.32s forwards}
#s7logo.vis .s7l-node-tr{animation:p0PopIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.42s forwards}
#s7logo.vis .s7l-node-bl{animation:p0PopIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.52s forwards}
#s7logo.vis .s7l-node-br{animation:p0PopIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.62s forwards}
#s7logo.vis .s7l-link-tl{animation:p0Draw 0.55s ease-out 0.85s forwards}
#s7logo.vis .s7l-link-tr{animation:p0Draw 0.55s ease-out 0.95s forwards}
#s7logo.vis .s7l-link-bl{animation:p0Draw 0.55s ease-out 1.05s forwards}
#s7logo.vis .s7l-link-br{animation:p0Draw 0.55s ease-out 1.15s forwards}
#s7logo .s7l-wordmark{font-family:var(--font-jakarta,'Plus Jakarta Sans',sans-serif);font-weight:800;font-size:4.4vw;letter-spacing:-0.04em;line-height:1;display:flex;color:#fff;overflow:hidden;height:1em;align-items:flex-end;z-index:1}
#s7logo .s7l-wordmark .pro,#s7logo .s7l-wordmark .xis{display:inline-block;transform:translateY(110%);opacity:0}
#s7logo .s7l-wordmark .xis{color:var(--lime)}
#s7logo.vis .s7l-wordmark .pro{animation:p0Rise 0.7s cubic-bezier(.2,.7,.2,1) 1.7s forwards}
#s7logo.vis .s7l-wordmark .xis{animation:p0Rise 0.7s cubic-bezier(.2,.7,.2,1) 1.95s forwards}
#s7logo .s7l-xis-wrap{position:relative;display:inline-block}
#s7logo .s7l-swipe{position:absolute;bottom:-0.3vw;right:0;height:0.3vw;width:0;background:var(--lime);border-radius:2px}
#s7logo.vis .s7l-swipe{animation:p0Swipe 0.6s cubic-bezier(.6,0,.4,1) 2.45s forwards}
#s7logo .s7l-tagline{font-family:var(--font-mono,'DM Mono',monospace);font-weight:400;font-size:0.7vw;letter-spacing:.32em;text-transform:uppercase;color:#aeb0a6;opacity:0;transform:translateY(8px);display:flex;align-items:center;gap:0.7vw;z-index:1;white-space:nowrap}
#s7logo .s7l-tagline::before,#s7logo .s7l-tagline::after{content:'';display:block;width:1.8vw;height:1px;background:linear-gradient(90deg,transparent,rgba(174,176,166,.6),transparent)}
#s7logo.vis .s7l-tagline{animation:p0TagIn 0.9s ease-out 2.7s forwards}
#distVeil{position:fixed;top:0;right:0;width:45%;height:100%;z-index:19;opacity:0;pointer-events:none;background:linear-gradient(to right,transparent 0%,rgba(11,10,9,0.85) 30%,rgba(11,10,9,0.97) 70%);transition:opacity 1.8s ease}
#distVeil.vis{opacity:1}
#ctaScreen{position:fixed;inset:0;z-index:80;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;opacity:0;pointer-events:none;transition:opacity 0.9s ease}
#ctaScreen.vis{opacity:1;pointer-events:all}
.proxis-logo-light{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.proxis-logo-light .pl-network{width:36px;height:36px;flex-shrink:0}
.proxis-logo-light .ptext{font-family:var(--font-jakarta,'Plus Jakarta Sans',sans-serif);font-size:32px;font-weight:800;letter-spacing:-0.03em;line-height:1;display:inline-flex;align-items:baseline}
.proxis-logo-light .ptext .pro{color:#0b0a09}
.proxis-logo-light .ptext .xis{color:#a8cc1a}
.cta-tagline{font-family:var(--font-mono,'DM Mono',monospace);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8885;margin-bottom:32px}
.cta-box{background:#111;border-radius:14px;padding:28px 32px;width:100%;max-width:480px;margin-bottom:24px}
.cta-box-sub{font-size:13px;color:rgba(255,255,255,0.42);text-align:center;line-height:1.6;margin-bottom:20px}
.cta-form{display:flex;flex-direction:column;gap:9px}
.cta-form input,.cta-form select{background:rgba(255,255,255,0.07);border:0.5px solid rgba(255,255,255,0.14);border-radius:9px;padding:12px 16px;font-family:var(--font-jakarta,'Plus Jakarta Sans',sans-serif);font-size:13px;color:rgba(255,255,255,0.82);width:100%}
.cta-form input::placeholder{color:rgba(255,255,255,0.28)}
.cta-form select option{background:#1a1916;color:#fff}
.cta-form input:focus,.cta-form select:focus{outline:none;border-color:rgba(203,241,53,0.45)}
.cta-row2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.cta-btn{width:100%;padding:15px;background:var(--lime);color:#0b0a09;border:none;border-radius:10px;font-family:var(--font-jakarta,'Plus Jakarta Sans',sans-serif);font-size:16px;font-weight:800;cursor:pointer;margin-top:4px;transition:all 0.2s ease;letter-spacing:-0.01em}
.cta-btn:hover{background:#b8dc1a;transform:translateY(-2px)}
.cta-btn.sent{background:#1a9e4a;color:#fff;transform:none}
.cta-tps-logo{max-height:52px;object-fit:contain;margin-bottom:8px}
.cta-copy{font-family:var(--font-mono,'DM Mono',monospace);font-size:9px;color:#c8c6c3;letter-spacing:.07em;text-align:center}
#startOv{position:fixed;inset:0;z-index:100;background:rgba(11,10,9,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:opacity 1s ease}
#startOv.gone{opacity:0;pointer-events:none}
.so-btn{display:inline-flex;align-items:center;gap:12px;padding:16px 40px;background:var(--lime);color:#0b0a09;border:none;border-radius:12px;font-family:var(--font-jakarta,'Plus Jakarta Sans',sans-serif);font-size:17px;font-weight:800;cursor:pointer;margin-top:32px;transition:all 0.2s ease}
.so-btn:hover{background:#b8dc1a}
.so-hint{font-family:var(--font-mono,'DM Mono',monospace);font-size:9px;color:#fff;margin-top:14px;letter-spacing:.08em}
.prog{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:50}
.pp{width:5px;height:5px;border-radius:3px;background:rgba(255,255,255,0.15);border:none;cursor:pointer;transition:all 0.3s}
.pp.cur{width:22px;background:var(--lime)}
#p0{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:28px;opacity:0;pointer-events:none;transition:opacity 0.6s ease;z-index:30}
#p0.vis{opacity:1;pointer-events:all}
#p0 .p0-halo{position:absolute;width:480px;height:480px;border-radius:50%;background:radial-gradient(circle,rgba(203,241,53,0.18) 0%,rgba(168,204,26,0.06) 35%,transparent 70%);filter:blur(20px)}
#p0 .p0-network{width:110px;height:110px;filter:drop-shadow(0 0 32px rgba(203,241,53,0.25));z-index:1}
#p0 .p0-node{transform-origin:center;transform-box:fill-box;opacity:0;transform:scale(0)}
#p0.vis .p0-node-center{animation:p0PopIn 0.6s cubic-bezier(.34,1.56,.64,1) 0.10s forwards,p0Pulse 1.6s ease-in-out 3.0s infinite}
#p0.vis .p0-node-tl{animation:p0PopIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.32s forwards}
#p0.vis .p0-node-tr{animation:p0PopIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.42s forwards}
#p0.vis .p0-node-bl{animation:p0PopIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.52s forwards}
#p0.vis .p0-node-br{animation:p0PopIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.62s forwards}
#p0 .p0-link{stroke-dasharray:60;stroke-dashoffset:60;opacity:0}
#p0.vis .p0-link-tl{animation:p0Draw 0.55s ease-out 0.85s forwards}
#p0.vis .p0-link-tr{animation:p0Draw 0.55s ease-out 0.95s forwards}
#p0.vis .p0-link-bl{animation:p0Draw 0.55s ease-out 1.05s forwards}
#p0.vis .p0-link-br{animation:p0Draw 0.55s ease-out 1.15s forwards}
@keyframes p0PopIn{0%{opacity:0;transform:scale(0)}60%{opacity:1;transform:scale(1.18)}100%{opacity:1;transform:scale(1)}}
@keyframes p0Pulse{0%,100%{filter:drop-shadow(0 0 0 rgba(203,241,53,0))}50%{filter:drop-shadow(0 0 14px rgba(203,241,53,0.85))}}
@keyframes p0Draw{0%{stroke-dashoffset:60;opacity:0}20%{opacity:.85}100%{stroke-dashoffset:0;opacity:.7}}
@keyframes p0Rise{0%{opacity:0;transform:translateY(110%)}100%{opacity:1;transform:translateY(0)}}
@keyframes p0Swipe{0%{width:0;opacity:0}40%{opacity:1}100%{width:100%;opacity:1}}
@keyframes p0TagIn{0%{opacity:0;transform:translateY(8px);letter-spacing:.5em}100%{opacity:1;transform:translateY(0);letter-spacing:.32em}}
#p0 .p0-wordmark{font-family:var(--font-jakarta,'Plus Jakarta Sans',sans-serif);font-weight:800;font-size:88px;letter-spacing:-0.04em;line-height:1;display:flex;color:#fff;overflow:hidden;height:1em;align-items:flex-end;z-index:1}
#p0 .p0-wordmark .pro{display:inline-block;transform:translateY(110%);opacity:0}
#p0 .p0-wordmark .xis{display:inline-block;transform:translateY(110%);opacity:0;color:var(--lime)}
#p0.vis .p0-wordmark .pro{animation:p0Rise 0.7s cubic-bezier(.2,.7,.2,1) 1.7s forwards;color:#0b0a09}
#p0.vis .p0-wordmark .xis{animation:p0Rise 0.7s cubic-bezier(.2,.7,.2,1) 1.95s forwards;color:var(--lime)}
#p0 .p0-xis-wrap{position:relative;display:inline-block}
#p0 .p0-swipe{position:absolute;bottom:-6px;right:0;height:6px;width:0;background:var(--lime);border-radius:2px}
#p0.vis .p0-swipe{animation:p0Swipe 0.6s cubic-bezier(.6,0,.4,1) 2.45s forwards}
#p0 .p0-tagline{font-family:var(--font-mono,'DM Mono',monospace);font-weight:400;font-size:14px;letter-spacing:.32em;text-transform:uppercase;color:#aeb0a6;opacity:0;transform:translateY(8px);display:flex;align-items:center;gap:14px;z-index:1}
#p0 .p0-tagline::before,#p0 .p0-tagline::after{content:'';display:block;width:36px;height:1px;background:linear-gradient(90deg,transparent,rgba(174,176,166,.6),transparent)}
#p0.vis .p0-tagline{animation:p0TagIn 0.9s ease-out 2.7s forwards}
@keyframes pulse{0%,100%{box-shadow:0 0 7px rgba(203,241,53,.6)}50%{box-shadow:0 0 18px rgba(203,241,53,.95)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
`}</style>

      {/* VIDEO */}
      <div id="videoWrap">
        <video id="vid" ref={vidRef} src="/Video Marketing Proxis.mp4" playsInline preload="auto" />
      </div>

      {/* PANELS */}
      <div id="panels">

        {/* P0: Logo intro */}
        <div id="p0">
          <div className="p0-halo"></div>
          <svg className="p0-network" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <line className="p0-link p0-link-tl" x1="100" y1="100" x2="40"  y2="56"  stroke="#a8cc1a" strokeWidth="3" strokeLinecap="round"/>
            <line className="p0-link p0-link-tr" x1="100" y1="100" x2="160" y2="56"  stroke="#a8cc1a" strokeWidth="3" strokeLinecap="round"/>
            <line className="p0-link p0-link-bl" x1="100" y1="100" x2="40"  y2="144" stroke="#a8cc1a" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
            <line className="p0-link p0-link-br" x1="100" y1="100" x2="160" y2="144" stroke="#a8cc1a" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
            <circle className="p0-node p0-node-tl" cx="40"  cy="56"  r="18" fill="#a8cc1a" opacity="0.85"/>
            <circle className="p0-node p0-node-tr" cx="160" cy="56"  r="18" fill="#a8cc1a" opacity="0.85"/>
            <circle className="p0-node p0-node-bl" cx="40"  cy="144" r="18" fill="#a8cc1a" opacity="0.6"/>
            <circle className="p0-node p0-node-br" cx="160" cy="144" r="18" fill="#a8cc1a" opacity="0.6"/>
            <circle className="p0-node p0-node-center" cx="100" cy="100" r="28" fill="#cbf135"/>
          </svg>
          <div className="p0-wordmark" aria-label="Proxis">
            <span className="pro">Pro</span>
            <span className="p0-xis-wrap"><span className="xis">xis</span><span className="p0-swipe"></span></span>
          </div>
          <div className="p0-tagline">Prospección en práctica</div>
        </div>

        {/* P1: La Herida */}
        <div className="panel" id="p1" style={{right:'3%',top:'50%',transform:'translateY(-50%)',width:'568px',padding:'45px 46px 24px 58px',fontSize:'19px',borderRadius:'10px',fontWeight:400}}>
          <div className="eyebrow" style={{fontSize:'14px',textAlign:'left'}}>INDUSTRIA · SEGUROS DE VIDA Y SERVICIOS FINANCIEROS</div>
          <div id="dotGrid" style={{margin:'0px 0px 5px'}}>
            {Array.from({length:100},(_,i)=><div key={i} id={'dp'+i} className="dp"></div>)}
          </div>
          <div className="s1-big" style={{fontSize:'88px'}}><span className="lime" style={{fontSize:'89px',fontWeight:600}}>9</span>%</div>
          <div className="s1-sm" style={{fontSize:'28px'}}>de asesores sigue activo a los 4 años</div>
        </div>

        {/* P2: El Villano */}
        <div className="panel" id="p2" style={{right:'3%',top:'50%',transform:'translateY(-50%)',width:'44%',padding:'22px 26px'}}>
          <div className="eyebrow"></div>
          <div className="h1">Cada asesor <span style={{color:'#e03030'}}>agota su red</span> porque no aprende a crear una fuente recurrente de Prospectos</div>
          <div className="names">
            <div className="nr ex"><span className="nn">Rodrigo Fuentes</span><span className="nb">Salió · mes 3</span></div>
            <div className="nr ex"><span className="nn">Camila Vargas</span><span className="nb">Salió · mes 5</span></div>
            <div className="nr ex"><span className="nn">Andrés Contreras</span><span className="nb">Salió · mes 4</span></div>
            <div className="nr ex"><span className="nn">Valentina Torres</span><span className="nb">Salió · mes 7</span></div>
            <div className="nr ex"><span className="nn">Matías Herrera</span><span className="nb">Salió · mes 6</span></div>
            <div className="nr ok"><span className="nn">Paula Espinoza</span><span className="nb">Activa · año 4</span></div>
          </div>
          <div className="s2-foot">La diferencia: una fuente recurrente de prospectos.</div>
        </div>

        {/* P3: El Reencuadre */}
        <div className="panel" id="p3" style={{left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:'42%',height:'auto'}}>
          <div className="s3-l1">No fallan en <span className="s3-cross" id="crossWord">ventas</span>.</div>
          <div className="s3-l2">Fallan en <span className="lime">lo que la precede.</span></div>
          <div className="sub" style={{fontSize:'14px'}}>El problema no es sólo de habilidad comercial.<br/>Mucho antes, está la ausencia de un sistema recurrente de prospección.</div>
        </div>

        {/* P4: La Solución */}
        <div className="panel" id="p4" style={{left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:'46%',height:'auto'}}>
          <div className="eyebrow">Proxis · The Precision Selling</div>
          <div className="h1"><span className="lime">Proxis</span> convierte cada nombre en una acción concreta.</div>
          <div className="dash">
            <div className="dash-hdr">
              <span className="dash-t" style={{fontSize:'12px'}}>Agencia Viña del Mar · 2026</span>
              <span className="dash-badge" style={{fontSize:'14px'}}>META: 140 PROSPECTOS</span>
            </div>
            <div className="dash-body">
              <div className="dash-row"><span className="dash-wk" style={{fontSize:'10px'}}>Semana 1</span><div className="dash-bg"><div className="dash-bar" id="b1"></div></div><span className="dash-n" id="n1">—</span></div>
              <div className="dash-row"><span className="dash-wk" style={{fontSize:'10px'}}>Semana 2</span><div className="dash-bg"><div className="dash-bar" id="b2"></div></div><span className="dash-n" id="n2">—</span></div>
              <div className="dash-row"><span className="dash-wk" style={{fontSize:'10px'}}>Semana 3</span><div className="dash-bg"><div className="dash-bar" id="b3"></div></div><span className="dash-n" id="n3">—</span></div>
              <div className="dash-row"><span className="dash-wk" style={{fontSize:'10px'}}>Semana 4</span><div className="dash-bg"><div className="dash-bar" id="b4"></div></div><span className="dash-n" id="n4">—</span></div>
            </div>
            <div className="dash-foot"><span className="dash-fl" style={{fontSize:'12px'}}>META COMPLETADA</span><span className="dash-pct" id="gpct">—</span></div>
          </div>
        </div>

        {/* P5: La Prueba */}
        <div className="panel" id="p5" style={{left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:'52%',height:'auto'}}>
          <div className="eyebrow">Supervisores Reales · Resultados Documentados</div>
          <div className="h1">Indicadores de calidad.</div>
          <div className="stats-row">
            <div className="sc"><div className="sc-n" id="c1">+0%</div><div className="sc-l">Aumento en ventas mensuales</div></div>
            <div className="sc"><div className="sc-n" id="c2">+0%</div><div className="sc-l">Más prospectos por mes</div></div>
            <div className="sc"><div className="sc-n" id="c3">+0%</div><div className="sc-l">Mejora en persistencia</div></div>
          </div>
          <div className="testi" style={{padding:'3px 16px 12px',margin:'10px 0px'}}>
            <div className="tq" style={{fontSize:'16px'}}>"Antes mis asesores llegaban al lunes sin prospectos. Hoy llegan con una meta clara y dirección concreta de actividad. Proxis cambió la conversación de mi equipo por completo."</div>
            <div className="ta" style={{fontSize:'13px',color:'rgba(245,242,248,0.973)'}}>— Supervisor · Santiago de Chile · 2026</div>
          </div>
        </div>

        {/* P6: El Futuro */}
        <div className="panel" id="p6" style={{left:'3%',top:'50%',transform:'translateY(-50%)',width:'fit-content',height:'auto'}}>
          <div className="h1"><span className="lime">El mercado</span> nunca fue el problema...</div>
          <div className="bens">
            <div className="ben"><div className="bd"></div><div className="bt">+20–30% ventas promedio</div></div>
            <div className="ben"><div className="bd"></div><div className="bt">+30–60% prospectos / mes</div></div>
            <div className="ben"><div className="bd"></div><div className="bt">Mayor retención de asesores</div></div>
            <div className="ben"><div className="bd"></div><div className="bt">Equipos más cohesionados</div></div>
            <div className="ben"><div className="bd"></div><div className="bt">Reclutamiento más efectivo</div></div>
            <div className="ben"><div className="bd"></div><div className="bt">+15% persistencia de pólizas</div></div>
          </div>
          <div className="s6-fn"><br/>* Indicadores dependen también de factores organizacionales, antigüedad del equipo y efectividad del liderazgo.</div>
        </div>

        {/* S7: Crowd text */}
        <div id="s7panel">
          <div className="s7-l1">Proxis, tu método para triunfar</div>
          <div className="s7-l2">en la profesión más <span className="lime">noble del mundo.</span></div>
        </div>

        {/* S7: Logo */}
        <div id="s7logo">
          <div className="s7l-halo"></div>
          <svg className="s7l-network" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <line className="s7l-link s7l-link-tl" x1="100" y1="100" x2="40"  y2="56"  stroke="#a8cc1a" strokeWidth="3" strokeLinecap="round"/>
            <line className="s7l-link s7l-link-tr" x1="100" y1="100" x2="160" y2="56"  stroke="#a8cc1a" strokeWidth="3" strokeLinecap="round"/>
            <line className="s7l-link s7l-link-bl" x1="100" y1="100" x2="40"  y2="144" stroke="#a8cc1a" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
            <line className="s7l-link s7l-link-br" x1="100" y1="100" x2="160" y2="144" stroke="#a8cc1a" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
            <circle className="s7l-node s7l-node-tl" cx="40"  cy="56"  r="18" fill="#a8cc1a" opacity="0.85"/>
            <circle className="s7l-node s7l-node-tr" cx="160" cy="56"  r="18" fill="#a8cc1a" opacity="0.85"/>
            <circle className="s7l-node s7l-node-bl" cx="40"  cy="144" r="18" fill="#a8cc1a" opacity="0.6"/>
            <circle className="s7l-node s7l-node-br" cx="160" cy="144" r="18" fill="#a8cc1a" opacity="0.6"/>
            <circle className="s7l-node s7l-node-center" cx="100" cy="100" r="28" fill="#cbf135"/>
          </svg>
          <div className="s7l-wordmark" aria-label="Proxis">
            <span className="pro">Pro</span>
            <span className="s7l-xis-wrap"><span className="xis">xis</span><span className="s7l-swipe"></span></span>
          </div>
          <div className="s7l-tagline">Prospección en práctica</div>
        </div>

      </div>{/* /panels */}

      {/* DIST VEIL */}
      <div id="distVeil"></div>

      {/* CTA SCREEN */}
      <div id="ctaScreen">
        <div className="proxis-logo-light">
          <svg className="pl-network" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <line x1="100" y1="100" x2="40"  y2="56"  stroke="#a8cc1a" strokeWidth="8" strokeLinecap="round"/>
            <line x1="100" y1="100" x2="160" y2="56"  stroke="#a8cc1a" strokeWidth="8" strokeLinecap="round"/>
            <line x1="100" y1="100" x2="40"  y2="144" stroke="#a8cc1a" strokeWidth="8" strokeLinecap="round" opacity="0.7"/>
            <line x1="100" y1="100" x2="160" y2="144" stroke="#a8cc1a" strokeWidth="8" strokeLinecap="round" opacity="0.7"/>
            <circle cx="40"  cy="56"  r="18" fill="#a8cc1a" opacity="0.85"/>
            <circle cx="160" cy="56"  r="18" fill="#a8cc1a" opacity="0.85"/>
            <circle cx="40"  cy="144" r="18" fill="#a8cc1a" opacity="0.6"/>
            <circle cx="160" cy="144" r="18" fill="#a8cc1a" opacity="0.6"/>
            <circle cx="100" cy="100" r="28" fill="#cbf135"/>
          </svg>
          <div className="ptext"><span className="pro">Pro</span><span className="xis">xis</span></div>
        </div>
        <div className="cta-tagline">Prospección en Práctica</div>
        <div className="cta-box">
          <div className="cta-box-sub">Proxis conecta cada contacto con tu meta de ingresos — semana a semana, asesor por asesor.</div>
          <form className="cta-form" onSubmit={handleSubmit}>
            <input type="hidden" name="_subject" value="Nueva solicitud de Demo — Proxis" />
            <div className="cta-row2">
              <input type="text" name="nombre" placeholder="Nombre completo" required />
              <select name="cargo" required defaultValue="">
                <option value="" disabled>Cargo</option>
                <option>Director</option><option>Supervisor</option><option>Promotor</option><option>Otro</option>
              </select>
            </div>
            <input type="text" name="empresa" placeholder="Empresa / Agencia" required />
            <div className="cta-row2">
              <input type="email" name="email" placeholder="Correo electrónico" required />
              <input type="tel" name="telefono" placeholder="Teléfono / WhatsApp" required />
            </div>
            <button type="submit" className={`cta-btn${ctaState === 'sent' ? ' sent' : ''}`} disabled={ctaState !== 'idle'}>
              {ctaState === 'idle' ? 'Solicita un Demo →' : ctaState === 'sending' ? 'Enviando...' : '✓ Solicitud enviada — te contactamos pronto'}
            </button>
          </form>
        </div>
        <img className="cta-tps-logo" src="/tps-logo.png" alt="The Precision Selling" />
        <div className="cta-copy">2026 · Derechos Reservados por Futura Soluciones Digitales Ltda.</div>
      </div>


      {/* START OVERLAY */}
      <div id="startOv" className={startGone ? 'gone' : ''} style={{color:'rgb(244,241,241)'}}>
        <NetworkSvg size={80} />
        <div style={{fontFamily:'var(--font-jakarta,"Plus Jakarta Sans",sans-serif)',fontWeight:800,fontSize:'40px',letterSpacing:'-0.04em',marginTop:'20px',color:'#fff'}}>
          Pro<span style={{color:'#cbf135'}}>xis</span>
        </div>
        <div style={{fontFamily:'var(--font-mono,"DM Mono",monospace)',fontSize:'10px',letterSpacing:'.22em',textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginTop:'6px'}}>
          Prospección en práctica
        </div>
        <button className="so-btn" onClick={() => startRef.current()}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
            <path d="M8 6.5l6 3.5-6 3.5V6.5z" fill="#0b0a09"/>
          </svg>
          Ver presentación
        </button>
        <div className="so-hint">Con audio · ~1 min 22 seg</div>
      </div>

      {/* Saltar presentación — fixed bottom-left, always mounted to avoid hydration issues */}
      <div style={{position:'fixed',bottom:'24px',left:'28px',zIndex:101,transition:'opacity 0.5s',opacity:startGone?0:1,pointerEvents:startGone?'none':'all'}}>
        <span style={{fontFamily:'var(--font-mono,"DM Mono",monospace)',fontSize:'10px',letterSpacing:'.08em',color:'rgba(255,255,255,0.45)',cursor:'pointer',textDecoration:'underline',textUnderlineOffset:'3px'}}
              onClick={() => jumpToRef.current(12)}>
          Saltar presentación · Ir a solicitar Demo
        </span>
      </div>
    </>
  )
}
