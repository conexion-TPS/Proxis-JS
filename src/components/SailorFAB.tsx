'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const HIDDEN_ROUTES = ['/admin/login']

interface AdminUser { name: string; role: string }

export function SailorFAB() {
  const pathname = usePathname()
  const router   = useRouter()
  const fabRef   = useRef<HTMLButtonElement>(null)

  const [user,         setUser]         = useState<AdminUser | null>(null)
  const [open,         setOpen]         = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [mounted,      setMounted]      = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    // R4: presencia de admin vía sesión GoTrue (app_metadata.cargo==='admin').
    supabaseBrowser.auth.getSession().then(({ data }) => {
      const s = data.session
      if (s && s.user?.app_metadata?.cargo === 'admin') {
        setUser({ name: (s.user.user_metadata?.name as string) || s.user.email || 'Admin', role: 'admin' })
      } else {
        setUser(null)
      }
    })
  }, [])

  const hidden = !user || HIDDEN_ROUTES.some(r => pathname.startsWith(r))

  const fetchCount = useCallback(async () => {
    const desde7d = new Date(Date.now() - 7 * 86400_000).toISOString()
    const { count } = await supabaseBrowser
      .from('sailor_messages')
      .select('asesor', { count: 'exact', head: true })
      .eq('origen', 'coach_ia')
      .eq('tipo', 'pregunta')
      .gte('created_at', desde7d)
    setPendingCount(count ?? 0)
  }, [])

  useEffect(() => {
    if (hidden) return
    fetchCount()
  }, [hidden, fetchCount])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCard() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function closeCard() {
    setOpen(false)
    setTimeout(() => fabRef.current?.focus(), 50)
  }

  function navigate(path: string) {
    closeCard()
    router.push(path)
  }

  if (hidden || !mounted) return null

  const badge = pendingCount > 9 ? '9+' : pendingCount

  return (
    <>
      <style>{`
        @keyframes fabOverlay { from { opacity:0 } to { opacity:1 } }
        @keyframes fabCard    { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fabRing    { 0% { transform:scale(.95); opacity:.65 } 100% { transform:scale(1.6); opacity:0 } }
        .sailor-fab:hover .sailor-tooltip { opacity:1; pointer-events:auto; transform:translateY(-50%) translateX(0) }
        @media (prefers-reduced-motion: reduce) { .fab-pulse, .sailor-fab { animation:none !important; transition:none !important } }
      `}</style>

      {open && createPortal(
        <>
          <div
            onClick={closeCard}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(11,10,9,0.45)',
              backdropFilter: 'blur(2px)', zIndex: 1100,
              animation: 'fabOverlay 150ms ease forwards',
            }}
          />
          <SailorCardDesktop
            user={user!}
            pendingCount={pendingCount}
            onClose={closeCard}
            onNavigate={navigate}
          />
        </>,
        document.body
      )}

      {/* FAB */}
      <button
        ref={fabRef}
        className="sailor-fab"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Cerrar Sailor' : 'Abrir Sailor'}
        aria-expanded={open}
        aria-controls="sailor-card-desktop"
        style={{
          position: 'fixed',
          left: 24, bottom: 24,
          width: 64, height: 64,
          borderRadius: '50%',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)',
          zIndex: open ? 1300 : 1000,
          padding: 0, background: '#fff',
          transition: 'transform 180ms ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        onMouseDown={e =>  { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)' }}
        onMouseUp={e =>    { (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)' }}
      >
        {/* Pulse ring */}
        {!open && (
          <span className="fab-pulse" style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid #cbf135',
            animation: 'fabRing 2.4s ease-out infinite',
            opacity: 0, pointerEvents: 'none',
          }} />
        )}

        {/* Robot head */}
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%',
          borderRadius: '50%', overflow: 'hidden',
          padding: 5, background: '#fff', boxSizing: 'border-box',
        }}>
          <img
            src="/assets/sailor/robot-head-transparent.png"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </span>

        {/* Badge */}
        {pendingCount > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            minWidth: 22, height: 22, padding: '0 6px',
            background: '#ff3b3b', border: '2.5px solid #fff', borderRadius: 99,
            fontSize: 11, fontWeight: 800, color: '#fff', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 8px rgba(255,59,59,0.4)',
            boxSizing: 'border-box',
          }}>
            {badge}
          </span>
        )}

        {/* Desktop tooltip */}
        <span className="sailor-tooltip" style={{
          position: 'absolute',
          left: 'calc(100% + 12px)', top: '50%',
          transform: 'translateY(-50%) translateX(-4px)',
          background: '#0b0a09', color: '#fff',
          padding: '6px 10px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: 0, transition: 'opacity 0.18s ease 0.5s, transform 0.18s ease 0.5s',
        }}>
          Hablar con Sailor
        </span>
      </button>
    </>
  )
}

// ── Desktop Card ──────────────────────────────────────────────────────────────

function SailorCardDesktop({ user, pendingCount, onClose, onNavigate }: {
  user: AdminUser
  pendingCount: number
  onClose: () => void
  onNavigate: (path: string) => void
}) {
  const closeRef  = useRef<HTMLButtonElement>(null)
  const firstName = user.name.split(' ')[0]
  const iniciales = user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => { closeRef.current?.focus() }, [])

  return (
    <div
      id="sailor-card-desktop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-greeting-desktop"
      style={{
        position: 'fixed',
        left: 24,
        bottom: 104, // 24 (fab bottom) + 64 (fab height) + 16 (gap)
        width: 360,
        background: '#fff', borderRadius: 18,
        padding: '16px 16px 14px',
        boxShadow: '0 24px 50px rgba(0,0,0,0.35)',
        zIndex: 1200,
        display: 'flex', flexDirection: 'column', gap: 12,
        animation: 'fabCard 180ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards',
        fontFamily: 'var(--font-jakarta, system-ui, sans-serif)',
      }}
    >
      {/* Tail pointing down-left to the FAB */}
      <div style={{
        position: 'absolute', left: 32, bottom: -8,
        width: 16, height: 16,
        background: '#fff', transform: 'rotate(45deg)', borderRadius: 3, zIndex: -1,
      }} />

      {/* Close */}
      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="Cerrar"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 30, height: 30, borderRadius: '50%',
          background: '#f5f3ef', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#8a8885',
        }}
      >
        <XIcon />
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 32 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', background: '#0b0a09',
          color: '#cbf135', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, flexShrink: 0,
        }}>
          {iniciales}
        </div>
        <div>
          <div id="card-greeting-desktop" style={{ fontSize: 13, fontWeight: 700, color: '#0b0a09' }}>
            Hola, {firstName}
          </div>
          <div style={{ fontSize: 11, color: '#8a8885', marginTop: 1 }}>
            Supervisor · Proxis
          </div>
        </div>
      </div>

      {/* Section label */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#8a8885',
      }}>
        Asesoras con preguntas activas (7 días)
      </div>

      {/* Count card */}
      <div style={{
        background: pendingCount > 0
          ? 'linear-gradient(180deg, #fff 0%, #fdfbe6 100%)'
          : '#f5f3ef',
        border: `1.5px solid ${pendingCount > 0 ? '#cbf135' : '#e8e6e3'}`,
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: pendingCount > 0 ? '#cbf135' : '#e8e6e3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PuzzleIcon color={pendingCount > 0 ? '#0b0a09' : '#8a8885'} />
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0b0a09' }}>
            {pendingCount > 0
              ? `${pendingCount} pregunta${pendingCount !== 1 ? 's' : ''} enviada${pendingCount !== 1 ? 's' : ''}`
              : 'Todo al día'}
          </div>
          <div style={{ fontSize: 10.5, color: '#8a8885', marginTop: 2 }}>
            {pendingCount > 0 ? 'del coach a asesoras esta semana' : 'No hay preguntas activas esta semana'}
          </div>
        </div>
      </div>

      {/* CTA primaria */}
      <button onClick={() => onNavigate('/admin/sailor')} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: '#0b0a09', color: '#cbf135', borderRadius: 10,
        padding: '11px', fontSize: 13, fontWeight: 700,
        border: 'none', width: '100%', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        Ver Sailor <ArrowRightIcon />
      </button>

      {/* Acción secundaria */}
      <button onClick={() => onNavigate('/admin/dashboard')} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', color: '#2b2926',
        border: '1px solid #e8e6e3', borderRadius: 10,
        padding: '10px', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', width: '100%',
      }}>
        Resumen de la semana
      </button>
    </div>
  )
}

// ── inline SVG icons ─────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

function PuzzleIcon({ color = '#0b0a09' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.4 7.85a2.4 2.4 0 0 0-.6-2.7l-2-2a2.4 2.4 0 0 0-3.4 0L4 12.5V20h7.5l9.4-9.4a2.4 2.4 0 0 0-1.5-2.75z"/>
    </svg>
  )
}
