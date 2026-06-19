import { createClient } from '@supabase/supabase-js'

// R3 — Valida una sesión admin de Supabase Auth (GoTrue) desde el header Authorization.
// Verifica el access_token CONTRA Supabase (auth.getUser hace request al Auth server; no
// se confía en el token sin verificar) y exige app_metadata.cargo === 'admin'.
// Devuelve true solo si el token es válido Y el claim admin está presente.

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function isAdminGoTrueSession(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const token = authHeader.slice(7).trim()
  if (!token) return false
  try {
    const sb = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await sb.auth.getUser(token)   // valida el JWT contra GoTrue
    if (error || !data?.user) return false
    return data.user.app_metadata?.cargo === 'admin'
  } catch {
    return false
  }
}
