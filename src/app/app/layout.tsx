import type { ReactNode } from 'react'
import { AuthProvider } from './AuthProvider'
import { SHELL_CSS } from './shellCss'
import { CuestionarioFAB } from './_components/CuestionarioFAB'

/*
 * Layout del /app (C2 — shell unificado, paso 1: ANDAMIAJE).
 * Monta el AuthProvider (sesión centralizada) e inyecta el CSS de shell compartido.
 *
 * En este paso NINGUNA página lo consume todavía: las 4 pantallas conservan su propio
 * <style> y su propia auth. El <style> de aquí es, de momento, idéntico a las 34 líneas
 * de shell que cada página ya incluye → reglas duplicadas pero byte-idénticas, sin cambio
 * de render. La deduplicación real ocurre al migrar cada pantalla (pasos siguientes).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <style>{SHELL_CSS}</style>
      {children}
      <CuestionarioFAB />
    </AuthProvider>
  )
}
