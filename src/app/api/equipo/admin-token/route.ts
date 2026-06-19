import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { isAdminGoTrueSession } from '@/lib/adminAuth'

// Mismo secreto que firma los tokens de supervisor, para que verifyEquipoToken los valide.
const SECRET    = process.env.SAILOR_JWT_SECRET ?? 'proxis-equipo-secret'
const ADMIN_KEY = process.env.ADMIN_PASSWORD   // sin literal: si falta, fail-closed (abajo)

// Canjea la clave del panel admin por un JWT de equipo con alcance total (cargo=admin).
// Permite que el admin abra el "Portal equipo" sin un usuario en org_usuarios.
export async function POST(req: NextRequest) {
  const { key } = await req.json().catch(() => ({}))
  // R3: aceptar sesión GoTrue admin (Bearer) O la x-admin-key vieja (DEPRECADA — quitar tras R4).
  const viaGoTrue = await isAdminGoTrueSession(req.headers.get('authorization'))
  const viaKey    = !!(ADMIN_KEY && key === ADMIN_KEY)   // DEPRECADO (x-admin-key / clave): quitar tras R4
  // Fail-closed: sin sesión GoTrue válida y sin clave correcta → no autoriza.
  if (!viaGoTrue && !viaKey) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = jwt.sign(
    { usuario_id: 'admin', org_nodo_id: null, email: '', nombre: 'Coach (admin)', cargo: 'admin' },
    SECRET,
    { expiresIn: '7d' }
  )
  return NextResponse.json({ ok: true, token, nombre: 'Coach (admin)', usuario_id: 'admin', email: '', cargo: 'admin' })
}
