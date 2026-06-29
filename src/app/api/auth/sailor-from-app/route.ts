import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// Canje: valida un app_token (firmado con VINA_JWT_SECRET) y emite un JWT del wizard
// (firmado con SAILOR_JWT_SECRET). El adapter de Bitácora lo llama una vez al montar.
const VINA_SECRET   = process.env.VINA_JWT_SECRET   ?? process.env.SAILOR_JWT_SECRET ?? 'proxis-vina-secret'
const SAILOR_SECRET = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD    ?? 'proxis-sailor-secret'
const JWT_EXPIRES   = '30d'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer '))
    return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

  let claims: { asesor?: string; email?: string; rol?: string }
  try {
    claims = jwt.verify(auth.slice(7), VINA_SECRET) as typeof claims
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { asesor, email, rol } = claims
  if (!asesor)
    return NextResponse.json({ error: 'Token sin asesor' }, { status: 401 })

  const token = jwt.sign({ asesor, email, rol }, SAILOR_SECRET, { expiresIn: JWT_EXPIRES })
  return NextResponse.json({ token })
}
