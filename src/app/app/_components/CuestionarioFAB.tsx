'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '../AuthProvider'
import { ASESORES_PILOTO_CUESTIONARIO } from '../piloto'

export function CuestionarioFAB() {
  const { ident }  = useAuth()
  const pathname   = usePathname()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null
  if (!ASESORES_PILOTO_CUESTIONARIO.includes(ident?.nombre ?? '')) return null
  if (pathname?.startsWith('/app/informe/cuestionario')) return null

  return (
    <>
      <style>{`
        @keyframes cFabRing { 0% { transform:scale(.95); opacity:.65 } 100% { transform:scale(1.6); opacity:0 } }
      `}</style>
      <button
        onClick={() => window.location.assign('/app/informe/cuestionario')}
        aria-label="Ir al cuestionario"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(80px + env(safe-area-inset-bottom))',
          width: 77, height: 77,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: '#fff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)',
          padding: 0,
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Pulse ring — verde #cbf135, calco del SailorFAB de sailor-front */}
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid #cbf135',
          animation: 'cFabRing 2.4s ease-out infinite',
          opacity: 0, pointerEvents: 'none',
        }} />
        {/* Contenedor con padding para que el img tenga dimensiones reales */}
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%',
          borderRadius: '50%', overflow: 'hidden',
          padding: 6, boxSizing: 'border-box', background: '#fff',
        }}>
          <div style={{
            width: 65, height: 65,
            backgroundImage: "url('/assets/sailor/robot-head-transparent.png')",
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }} />
        </span>
      </button>
    </>
  )
}
