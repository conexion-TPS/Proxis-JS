'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const NAV_CARDS = [
  { href: '/admin/prompts',       icon: '✍️', title: 'Prompts',              desc: 'Edita y versiona plantillas de mensajes por trigger. Previsualiza con asesores reales.',                   badge: 'Mensajes' },
  { href: '/admin/triggers',      icon: '⚡',  title: 'Triggers',             desc: 'Umbrales, cooldowns y estado activo/inactivo de cada trigger de automatización.',                          badge: 'Mensajes' },
  { href: '/admin/review',        icon: '🔍', title: 'Revisión',             desc: 'Audita mensajes enviados. Marca 👍/👎 y reescribe para mejorar el modelo.',                                 badge: 'Mensajes' },
  { href: '/admin/perfil',        icon: '🧩', title: 'Perfiles',             desc: 'Calibra el perfil ontológico-conductual de cada asesor con chat IA y resumen automático.',               badge: 'IA Coach' },
  { href: '/admin/hipotesis',     icon: '💡', title: 'Hipótesis IA',         desc: 'Valida hipótesis generadas por el motor. Aprueba propuestas de conocimiento y gestiona vacíos.',         badge: 'IA Coach' },
  { href: '/admin/senales',       icon: '📡', title: 'Señales',              desc: 'Timeline de señales comportamentales capturadas. Cobertura de dimensiones por asesor.',                  badge: 'IA Coach' },
  { href: '/admin/cuestionarios', icon: '📝', title: 'Cuestionarios',        desc: 'Diseña cuestionarios psicométricos y micro-capturas. Ve respuestas por asesor.',                         badge: 'IA Coach' },
  { href: '/admin/conocimiento',  icon: '🧬', title: 'Conocimiento conductual', desc: 'Base de conocimiento Merrill-Reid + TPS + ciclo de 7 pasos. Completitud por perfil.',                badge: 'IA Coach' },
  { href: '/admin/knowledge',     icon: '🧠', title: 'Base KB',              desc: 'Fichas de contexto libre para enriquecer prompts. Embeddings vectoriales opcionales.',                   badge: 'Contexto' },
  { href: '/admin/sailor',        icon: '⛵', title: 'Sailor App',           desc: 'Feed de mensajes en app móvil. Tokens push, conversaciones y estadísticas de apertura.',                 badge: 'Sailor' },
  { href: '/admin/analytics',     icon: '📊', title: 'Analytics',            desc: 'Mensajes por trigger, feedback por asesor, evolución temporal de métricas.',                            badge: 'Reportes' },
]

type Status = 'loading' | 'ok' | 'error'

export default function AdminDashboard() {
  const [status, setStatus] = useState<Status>('loading')
  const [statusMsg, setStatusMsg] = useState('Verificando conexión con Supabase…')
  const [sbUrl, setSbUrl] = useState('—')
  const isDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  useEffect(() => {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    setSbUrl(url)

    fetch(`${url}/rest/v1/trigger_config?limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then(r => {
        if (r.ok) {
          setStatus('ok')
          setStatusMsg(`Supabase conectado — ${isDev ? 'proxis-dev' : 'producción'} responde correctamente.`)
        } else throw new Error(`HTTP ${r.status}`)
      })
      .catch(e => {
        setStatus('error')
        setStatusMsg(`Error de conexión — ${e.message}. Verifica la URL y la key de Supabase.`)
      })
  }, [isDev])

  const dotColor = status === 'ok' ? '#1a9e4a' : status === 'error' ? '#b03a3a' : '#a8691a'
  const dotGlow  = status === 'ok'
    ? '0 0 0 3px rgba(26,158,74,0.15)'
    : status === 'error'
    ? '0 0 0 3px rgba(176,58,58,0.15)'
    : '0 0 0 3px rgba(168,105,26,0.15)'

  return (
    <div style={{ padding: '40px 36px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <h1 style={{
        fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em',
        color: '#0b0a09', marginBottom: 4,
      }}>Panel de administración</h1>
      <p style={{ fontSize: 13, color: '#4a4844', marginBottom: 32 }}>
        Gestiona prompts, triggers, mensajes y base de conocimiento del sistema IA.
      </p>

      {/* Status banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#fff', border: '1px solid #e8e6e3',
        borderRadius: 12, padding: '14px 18px', marginBottom: 32,
        fontSize: 13,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: dotColor, boxShadow: dotGlow,
          animation: status === 'loading' ? 'pulseDot 1.2s infinite' : 'none',
        }} />
        <span style={{ color: '#4a4844' }}>
          <strong style={{ color: '#0b0a09' }}>
            {status === 'ok' ? 'Supabase conectado' : status === 'error' ? 'Error de conexión' : 'Verificando…'}
          </strong>
          {' — '}{statusMsg.replace(/^[^—]+— /, '')}
        </span>
      </div>

      {/* Nav cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16, marginBottom: 40,
      }}>
        {NAV_CARDS.map(card => (
          <NavCard key={card.href} {...card} />
        ))}
      </div>

      {/* Info grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
      }}>
        <InfoCard label="Ambiente activo" value={isDev ? 'proxis-dev (pruebas)' : 'producción'} />
        <InfoCard label="Supabase URL"    value={sbUrl} mono />
        <InfoCard label="Gemini API"      value={process.env.GEMINI_KEY ? '✓ Configurada' : '⚠ Pendiente'} />
        <InfoCard label="Resend API"      value={process.env.RESEND_KEY ? '✓ Configurada' : '⚠ Pendiente'} />
      </div>

      <style>{`
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

function NavCard({ href, icon, title, desc, badge }: typeof NAV_CARDS[0]) {
  return (
    <Link href={href} style={{
      background: '#fff', border: '1px solid #e8e6e3',
      borderRadius: 14, padding: 24, textDecoration: 'none', color: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.18s',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement
      el.style.borderColor = '#0b0a09'
      el.style.boxShadow = '0 8px 24px rgba(11,10,9,0.08)'
      el.style.transform = 'translateY(-2px)'
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement
      el.style.borderColor = '#e8e6e3'
      el.style.boxShadow = 'none'
      el.style.transform = 'none'
    }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: '#f5f3ef',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#8a8885', lineHeight: 1.5 }}>{desc}</div>
      <div style={{
        marginTop: 'auto',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: '#8a8885', paddingTop: 12, borderTop: '1px solid #f0ede8',
      }}>
        <ClockIcon />
        {badge}
      </div>
    </Link>
  )
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8e6e3',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#8a8885', marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontSize: mono ? 11 : 13, color: '#0b0a09', fontWeight: 500,
        wordBreak: 'break-all',
        fontFamily: mono ? 'var(--font-mono), monospace' : 'inherit',
      }}>{value}</div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 3v2l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
