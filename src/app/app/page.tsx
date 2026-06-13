'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

/*
 * Índice de /app — PUERTA ÚNICA (PIEZA 1 del lote puerta única).
 *   • Sin sesión  → login (reutiliza AuthProvider.login + el mismo form de las pantallas).
 *   • Con sesión  → resuelve identidad (/api/app/me vía loadIdentity) y distribuye por rol:
 *                   tipo='asesor' → /app/informe ; tipo='mando' (supervisor) → /app/tracker.
 *   • Estado de carga mientras resuelve (sin parpadeo del login en usuarios ya logueados).
 * Reemplaza el 404 de entrar a /app a secas. Los gates por rol/tenant de cada pantalla siguen
 * vigentes como cinturón (esta página solo distribuye).
 */

const LOGIN_CSS = `
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--g100)}
.login-card{background:white;border:1px solid var(--g200);border-radius:var(--rx);padding:32px 30px;width:100%;max-width:400px;box-shadow:var(--shadow-1)}
.login-card input{width:100%;padding:11px 14px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:14px;color:var(--g900);outline:none;margin-bottom:12px}
.login-card input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(11,10,9,0.08)}
.login-btn{width:100%;padding:13px;border:none;border-radius:var(--r);background:#0b0a09;color:white;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer}
.login-btn:disabled{opacity:.5;cursor:not-allowed}
`

export default function AppIndex() {
  const router = useRouter()
  const { token, rol, login, loadIdentity } = useAuth()
  // ¿había sesión persistida al montar? (lectura síncrona → evita el parpadeo del login)
  const [hadSession] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('app_token'))
  const [resolved, setResolved] = useState(false) // terminó el intento de resolver identidad
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [cargando, setCargando] = useState(false)

  // Resolver identidad cuando hay token (calco de loadIdentity); maneja 401 (AuthProvider limpia token).
  useEffect(() => {
    let cancel = false
    if (token) {
      setResolved(false)
      loadIdentity(token).finally(() => { if (!cancel) setResolved(true) })
    } else {
      setResolved(true)
    }
    return () => { cancel = true }
  }, [token, loadIdentity])

  // Identidad resuelta → distribuir por rol.
  useEffect(() => {
    if (rol === 'asesor') router.replace('/app/informe')
    else if (rol === 'supervisor') router.replace('/app/tracker')
  }, [rol, router])

  async function onLogin() {
    setErr(''); setCargando(true)
    const res = await login(email, pass)
    setCargando(false)
    if (!res.ok) { setErr(res.error ?? 'Credenciales incorrectas'); return }
    // éxito → cambia token → los efectos resuelven identidad y redirigen
  }

  const redirigiendo = rol === 'asesor' || rol === 'supervisor'
  const mostrarCarga = redirigiendo || (!!token && !resolved) || (hadSession && !resolved)

  if (mostrarCarga) {
    return (
      <>
        <style>{LOGIN_CSS}</style>
        <div className="login-wrap"><div style={{ color: 'var(--g600)', fontSize: 14 }}>Cargando tu plataforma…</div></div>
      </>
    )
  }

  // Sin sesión → login (mismo form que las pantallas).
  return (
    <>
      <style>{LOGIN_CSS}</style>
      <div className="login-wrap">
        <div className="login-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontWeight: 800, fontSize: 18 }}>Pro<span style={{ color: '#a8cc1a' }}>xis</span></span>
            <span style={{ fontSize: 13, color: 'var(--g600)' }}>· Ingresar</span>
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onLogin()} placeholder="••••••••" />
          <button className="login-btn" onClick={onLogin} disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
          {err && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        </div>
      </div>
    </>
  )
}
