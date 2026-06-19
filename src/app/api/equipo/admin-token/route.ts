import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { isAdminGoTrueSession } from '@/lib/adminAuth'

// Mismo secreto que firma los tokens de supervisor, para que verifyEquipoToken los valide.
const SECRET = process.env.SAILOR_JWT_SECRET ?? 'proxis-equipo-secret'

// Canjea la sesión admin (GoTrue) por un JWT de equipo con alcance total (cargo=admin).
// Permite que el admin abra el "Portal equipo" sin un usuario en org_usuarios.
export async function POST(req: NextRequest) {
  // Solo sesión GoTrue admin (Bearer). x-admin-key eliminado tras R4.
  const viaGoTrue = await isAdminGoTrueSession(req.headers.get('authorization'))
  if (!viaGoTrue) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = jwt.sign(
    { usuario_id: 'admin', org_nodo_id: null, email: '', nombre: 'Coach (admin)', cargo: 'admin' },
    SECRET,
    { expiresIn: '7d' }
  )
  return NextResponse.json({ ok: true, token, nombre: 'Coach (admin)', usuario_id: 'admin', email: '', cargo: 'admin' })
}
