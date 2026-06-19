'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [shake, setShake]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // R4: autenticación vía Supabase Auth (GoTrue). supabase-js persiste la sesión solo.
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err || !data?.session) {
      setError('Credenciales incorrectas.'); setShake(true); setTimeout(() => setShake(false), 400); return
    }
    if (data.user?.app_metadata?.cargo !== 'admin') {
      await supabase.auth.signOut()
      setError('Esta cuenta no tiene acceso de administrador.'); setShake(true); setTimeout(() => setShake(false), 400); return
    }
    router.push('/admin/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b0a09',
      backgroundImage: 'radial-gradient(circle, rgba(203,241,53,0.06) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '44px 48px',
        width: '100%', maxWidth: 400,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 9, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#a8cc1a',
          marginBottom: 20,
        }}>Proxis · Panel Admin</div>

        <h1 style={{
          fontSize: 22, fontWeight: 800, color: '#fff',
          letterSpacing: '-0.03em', marginBottom: 28,
        }}>Acceso restringido</h1>

        {error && (
          <div style={{
            background: 'rgba(232,99,10,0.12)', border: '1px solid rgba(232,99,10,0.3)',
            borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f09060',
            marginBottom: 16,
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ animation: shake ? 'shake 0.35s ease' : 'none' }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)', marginBottom: 6,
          }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@…"
            style={{
              width: '100%', padding: '13px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, fontSize: 14, color: '#fff',
              outline: 'none', fontFamily: 'inherit', marginBottom: 16,
            }}
          />
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)', marginBottom: 6,
          }}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••"
            style={{
              width: '100%', padding: '13px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${error ? 'rgba(232,99,10,0.5)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 10, fontSize: 14, color: '#fff',
              outline: 'none', fontFamily: 'inherit', marginBottom: 20,
            }}
          />
          <button type="submit" style={{
            width: '100%', padding: 14,
            background: '#cbf135', color: '#0b0a09',
            border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'background 0.15s',
          }}>
            Ingresar
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
      `}</style>
    </div>
  )
}
