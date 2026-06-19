'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS: { href: string; icon: string; label: string; group: string | null; external?: boolean }[] = [
  { href: '/admin/dashboard',    icon: '⊞',  label: 'Dashboard',   group: null },
  { href: '/admin/prompts',         icon: '✍️', label: 'Prompts',          group: 'Mensajes' },
  { href: '/admin/email-templates', icon: '✉️', label: 'Email templates', group: 'Mensajes' },
  { href: '/admin/triggers',     icon: '⚡',  label: 'Triggers',    group: 'Mensajes' },
  { href: '/admin/review',       icon: '🔍', label: 'Revisión',    group: 'Mensajes' },
  { href: '/admin/perfil',       icon: '🧩', label: 'Perfiles',    group: 'IA' },
  { href: '/admin/hipotesis',    icon: '💡', label: 'Hipótesis',   group: 'IA' },
  { href: '/admin/senales',      icon: '📡', label: 'Señales',     group: 'IA' },
  { href: '/admin/cuestionarios',icon: '📝', label: 'Cuestionarios',group: 'IA' },
  { href: '/admin/conocimiento', icon: '🧬', label: 'Conocimiento', group: 'IA' },
  { href: '/admin/knowledge',    icon: '🧠', label: 'Base KB',     group: 'IA' },
  { href: '/admin/sailor',       icon: '⛵', label: 'Sailor',      group: 'IA' },
  { href: '/admin/jerarquia',    icon: '🌲', label: 'Jerarquía',   group: 'Organización' },
  { href: '/admin/legal',        icon: '📄', label: 'Legal',        group: 'Organización' },
  { href: '/admin/usuarios',     icon: '👥', label: 'Usuarios',     group: 'Organización' },
  { href: '/equipo',             icon: '🪟', label: 'Portal equipo ↗', group: 'Organización', external: true },
  { href: '/admin/analytics',    icon: '📊', label: 'Analytics',    group: null },
]

const IS_DEV = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.includes('proxis-dev'))

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<string>('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (pathname === '/admin/login') { setReady(true); return }
    let active = true
    // R4: sesión vía Supabase Auth (GoTrue); exige app_metadata.cargo==='admin'.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const session = data.session
      const esAdmin = !!session && session.user?.app_metadata?.cargo === 'admin'
      if (!esAdmin) { router.replace('/admin/login'); return }
      setUser((session!.user.user_metadata?.name as string) || session!.user.email || 'Admin')
      setReady(true)
    })
    return () => { active = false }
  }, [router, pathname])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (!ready) return null
  if (pathname === '/admin/login') return <>{children}</>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f3ef' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: '#0b0a09',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Logo */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <ProxisLogo />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
              Pro<span style={{ color: '#cbf135' }}>xis</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 9, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#a8cc1a', marginTop: 2,
            }}>Admin</div>
          </div>
        </div>

        {/* Env badge */}
        <div style={{ padding: '10px 20px 6px' }}>
          <span style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 9, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 20,
            background: IS_DEV ? 'rgba(168,204,26,0.15)' : 'rgba(176,58,58,0.15)',
            color:      IS_DEV ? '#a8cc1a'                : '#e07070',
            border: `1px solid ${IS_DEV ? 'rgba(168,204,26,0.3)' : 'rgba(176,58,58,0.3)'}`,
          }}>
            {IS_DEV ? 'DEV' : 'PROD'}
          </span>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {(() => {
            const seen = new Set<string>()
            return NAV_ITEMS.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              const showGroup = item.group && !seen.has(item.group)
              if (item.group) seen.add(item.group)
              return (
                <div key={item.href}>
                  {showGroup && (
                    <div style={{
                      padding: '10px 20px 4px',
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)',
                    }}>{item.group}</div>
                  )}
                  <Link href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 20px',
                    color: item.external ? 'rgba(255,255,255,0.35)' : active ? '#cbf135' : 'rgba(255,255,255,0.55)',
                    background: active && !item.external ? 'rgba(203,241,53,0.08)' : 'transparent',
                    borderLeft: `2px solid ${active && !item.external ? '#cbf135' : 'transparent'}`,
                    fontWeight: active && !item.external ? 600 : 400,
                    fontSize: 13, textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                </div>
              )
            })
          })()}
        </nav>

        {/* User + logout */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            Sesión: <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{user}</strong>
          </div>
          <button onClick={logout} style={{
            width: '100%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-jakarta), sans-serif',
            fontSize: 12, fontWeight: 500,
            padding: '6px 0', borderRadius: 8,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}

function ProxisLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="4.5" fill="#a8cc1a"/>
      <circle cx="6"  cy="9"  r="3"   fill="#a8cc1a" opacity="0.85"/>
      <circle cx="26" cy="9"  r="3"   fill="#a8cc1a" opacity="0.85"/>
      <circle cx="6"  cy="23" r="3"   fill="#a8cc1a" opacity="0.6"/>
      <circle cx="26" cy="23" r="3"   fill="#a8cc1a" opacity="0.6"/>
      <line x1="8.6"  y1="10.6" x2="13.2" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="8.6"  y1="21.4" x2="13.2" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}
