import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/app/me — resuelve la sesión actual → identidad consolidada en proxis_dev.
// Input:  Authorization: Bearer <jwt de /api/vina/login>
// Output: { persona_id, institucion_id, institucion_nombre, nombre, tipo, via }
export async function GET(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })
  return NextResponse.json(id)
}
