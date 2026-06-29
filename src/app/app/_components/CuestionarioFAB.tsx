'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../AuthProvider'
import { ASESORES_PILOTO_CUESTIONARIO } from '../piloto'

export function CuestionarioFAB() {
  const { ident } = useAuth()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null
  if (!ASESORES_PILOTO_CUESTIONARIO.includes(ident?.nombre ?? '')) return null

  return (
    <button
      onClick={() => window.location.assign('/app/informe/cuestionario')}
      aria-label="Ir al cuestionario"
      style={{
        position: 'fixed',
        left: 16,
        bottom: 'calc(80px + env(safe-area-inset-bottom))',
        width: 70, height: 70,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: '#fff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)',
        padding: 5,
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <img
        src="/assets/sailor/robot-head-transparent.png"
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </button>
  )
}
