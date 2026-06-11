'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/*
 * AuthProvider del /app (C2.2) — centraliza sesión: token (localStorage 'app_token'),
 * login (/api/vina/login), logout y resolución de identidad (/api/app/me).
 * Calco byte-fiel de cargarIdent()/login()/salir() de las pantallas, extendido con
 * institucion_id/nombre (que /api/app/me ya devuelve hoy).
 *
 * 🔴 SEGURIDAD: institucion_id / institucion_nombre viven aquí SOLO como dato de
 * SESIÓN resuelto server-side por /api/app/me (vía resolveIdentity → token). Son para
 * header/routing. NUNCA se reenvían como parámetro a /api/app/equipo|individual: esos
 * endpoints derivan la institución del token, no del cliente. El context es de lectura.
 *
 * ANDAMIAJE (paso 1): este provider envuelve /app pero todavía NO lo consume ninguna
 * página. Es INERTE: solo lee el token persistido (sin red); loadIdentity() se invoca
 * recién cuando cada pantalla se migre. No hay auto-fetch de /api/app/me aquí.
 */

const TOKEN_KEY = 'app_token'

export type AppIdentity = {
  nombre: string
  tipo: string
  institucion_id: string
  institucion_nombre: string | null
} | null

type AuthValue = {
  token: string | null
  ident: AppIdentity
  rol: 'supervisor' | 'asesor' | null
  institucion_id: string | null
  institucion_nombre: string | null
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  loadIdentity: (tk?: string) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [ident, setIdent] = useState<AppIdentity>(null)

  // Lee el token persistido (mismo patrón que las pantallas actuales). Sin red.
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (t) setToken(t)
  }, [])

  // Resuelve la identidad de sesión. Calco de cargarIdent(), + institucion_id/nombre.
  const loadIdentity = useCallback(async (tk?: string) => {
    const t = tk ?? token
    if (!t) return
    try {
      const r = await fetch('/api/app/me', { headers: { Authorization: `Bearer ${t}` } })
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setToken(null); setIdent(null); return }
      const d = await r.json()
      if (r.ok) setIdent({ nombre: d.nombre, tipo: d.tipo, institucion_id: d.institucion_id, institucion_nombre: d.institucion_nombre })
    } catch { /* header sin identidad */ }
  }, [token])

  // Calco de login() de las pantallas (mismo POST a /api/vina/login).
  const login = useCallback(async (email: string, password: string) => {
    try {
      const r = await fetch('/api/vina/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const d = await r.json()
      if (!r.ok) return { ok: false, error: d.error ?? 'Credenciales incorrectas' }
      localStorage.setItem(TOKEN_KEY, d.token); setToken(d.token)
      return { ok: true }
    } catch { return { ok: false, error: 'No se pudo conectar' } }
  }, [])

  // Calco de salir().
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY); setToken(null); setIdent(null)
  }, [])

  // tipo: 'asesor' | 'mando' (calco del gate de los endpoints: asesor vs no-asesor).
  const rol: AuthValue['rol'] = ident ? (ident.tipo === 'asesor' ? 'asesor' : 'supervisor') : null

  return (
    <AuthContext.Provider
      value={{
        token, ident, rol,
        institucion_id: ident?.institucion_id ?? null,
        institucion_nombre: ident?.institucion_nombre ?? null,
        login, logout, loadIdentity,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
