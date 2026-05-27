'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EquipoLogin() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [shake,    setShake]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/equipo/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Credenciales incorrectas')
        setShake(true); setTimeout(() => setShake(false), 400)
      } else {
        localStorage.setItem('equipo_session', JSON.stringify({ token: json.token, nombre: json.nombre, org_nodo_id: json.org_nodo_id }))
        router.push('/equipo')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
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
          textTransform: 'uppercase', color: '#a8cc1a', marginBottom: 20,
        }}>Proxis · Portal de Equipo</div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginBottom: 8 }}>
          Acceso supervisores
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
          Tu dashboard de equipo, personalizado.
        </p>

        {error && (
          <div style={{
            background: 'rgba(232,99,10,0.12)', border: '1px solid rgba(232,99,10,0.3)',
            borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f09060', marginBottom: 16,
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ animation: shake ? 'shake 0.35s ease' : 'none' }}>
          <label style={labelStyle}>Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="tu@correo.com" required style={{ ...inputStyle, marginBottom: 14 }} />

          <label style={labelStyle}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••" required style={{ ...inputStyle, marginBottom: 24 }} />

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 14,
            background: loading ? 'rgba(203,241,53,0.5)' : '#cbf135',
            color: '#0b0a09', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)}
        }
      `}</style>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, fontSize: 14, color: '#fff',
  outline: 'none', fontFamily: 'inherit',
}
