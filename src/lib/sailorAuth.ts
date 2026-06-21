import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

// Verificación del JWT Sailor (mismo secreto que emite /api/auth/sailor y valida /api/privacy/consent).
// El asesor se deriva SIEMPRE del token, nunca de un parámetro libre del cliente.
const JWT_SECRET = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'

export type SailorClaims = { asesor: string; email?: string; rol?: string; id?: string }

// Devuelve el `asesor` del token (Bearer) o null si falta/!válido. Un asesor solo puede operar
// sobre sí mismo: las rutas deben usar este valor, no body/query.
export function authAsesor(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const claims = jwt.verify(auth.slice(7), JWT_SECRET) as SailorClaims
    return claims.asesor ?? null
  } catch {
    return null
  }
}
