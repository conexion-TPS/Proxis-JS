'use client'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { HostProvider } from '@conexion-tps/cuestionario-core'

function jwtPayload(token: string): Record<string, unknown> {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) }
  catch { return {} }
}

export function CuestionarioInformeProvider({ children }: { children: ReactNode }) {
  const [wizardToken, setWizardToken] = useState<string | null>(null)
  const [asesor,      setAsesor]      = useState<string | null>(null)
  const [rol,         setRol]         = useState<string>('asesor')
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const appToken = localStorage.getItem('app_token')
    if (!appToken) { window.location.replace('/app/informe'); return }

    const claims = jwtPayload(appToken)
    const asesorClaim = String(claims.asesor ?? '')
    const rolClaim    = String(claims.rol    ?? 'asesor')

    fetch('/api/auth/sailor-from-app', {
      method: 'POST',
      headers: { Authorization: `Bearer ${appToken}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d: { token: string }) => {
        setWizardToken(d.token)
        setAsesor(asesorClaim)
        setRol(rolClaim)
        setLoading(false)
      })
      .catch(() => window.location.replace('/app/informe'))
  }, [])

  const adapter = {
    apiGet: (path: string) =>
      fetch(path, { headers: { Authorization: `Bearer ${wizardToken}` } })
        .then((r) => r.json()).then((data) => ({ data })),
    apiPost: (path: string, body: unknown) =>
      fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${wizardToken}` },
        body: JSON.stringify(body),
      }).then((r) => r.json()).then((data) => ({ data })),
    getSession: () => (wizardToken && asesor)
      ? { asesor, rol, token: wizardToken }
      : null,
    loading,
    navigate:     (path: string) => window.location.assign(path.replace('/cuestionario', '/app/informe/cuestionario')),
    onDone:       () => window.location.assign('/app/informe'),
    onExit:       () => window.location.assign('/app/informe'),
    onAuthNeeded: () => window.location.replace('/app/informe'),
  }

  return <HostProvider adapter={adapter}>{children}</HostProvider>
}
