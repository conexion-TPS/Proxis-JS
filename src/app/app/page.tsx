'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import LoginScreen from './LoginScreen'

/*
 * Índice de /app — PUERTA ÚNICA (PIEZA 1 del lote puerta única).
 *   • Sin sesión  → login (reutiliza AuthProvider.login + el mismo form de las pantallas).
 *   • Con sesión  → resuelve identidad (/api/app/me vía loadIdentity) y distribuye por rol:
 *                   tipo='asesor' → /app/informe ; tipo='mando' (supervisor) → /app/tracker.
 *   • Estado de carga mientras resuelve (sin parpadeo del login en usuarios ya logueados).
 * Reemplaza el 404 de entrar a /app a secas. Los gates por rol/tenant de cada pantalla siguen
 * vigentes como cinturón (esta página solo distribuye).
 */

export default function AppIndex() {
  const router = useRouter()
  const { token, rol, loadIdentity } = useAuth()
  // ¿había sesión persistida al montar? (lectura síncrona → evita el parpadeo del login)
  const [hadSession] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('app_token'))
  const [resolved, setResolved] = useState(false) // terminó el intento de resolver identidad

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

  const redirigiendo = rol === 'asesor' || rol === 'supervisor'
  const mostrarCarga = redirigiendo || (!!token && !resolved) || (hadSession && !resolved)

  if (mostrarCarga) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g100)' }}><div style={{ color: 'var(--g600)', fontSize: 14 }}>Cargando tu plataforma…</div></div>
    )
  }

  // Sin sesión → login compartido (tema negro + ojo).
  return <LoginScreen />
}
