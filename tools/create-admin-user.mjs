// R2 — Alta (idempotente) del usuario admin en Supabase Auth (GoTrue).
// Se corre UNA vez, server-side, con SERVICE_ROLE. Crea el usuario que el panel usará
// vía signInWithPassword; su app_metadata.cargo='admin' viaja en el JWT (lo firma GoTrue
// con la signing key → la DB lo acepta). NO hardcodea nada; todo de env.
//
// Env requeridas:
//   SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY   (sensible — solo de env, nunca en texto)
//   ADMIN_PANEL_EMAIL
//   ADMIN_PASSWORD
//
// Uso (TPS, una vez):  node tools/create-admin-user.mjs

import { createClient } from '@supabase/supabase-js'

const URL   = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SRK   = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.ADMIN_PANEL_EMAIL
const PASS  = process.env.ADMIN_PASSWORD

// Fail-closed si falta cualquier env (no inventar valores).
const faltan = Object.entries({ SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: SRK, ADMIN_PANEL_EMAIL: EMAIL, ADMIN_PASSWORD: PASS })
  .filter(([, v]) => !v).map(([k]) => k)
if (faltan.length) {
  console.error('Faltan envs (no se hardcodean):', faltan.join(', '))
  process.exit(2)
}

const admin = createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } })

// Buscar usuario por email (listUsers paginado; no asumimos getUserByEmail disponible).
async function findByEmail(email) {
  const needle = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const u = data?.users?.find(x => x.email?.toLowerCase() === needle)
    if (u) return u
    if (!data || data.users.length < 1000) break // última página
  }
  return null
}

try {
  const existente = await findByEmail(EMAIL)

  if (existente) {
    const { data, error } = await admin.auth.admin.updateUserById(existente.id, {
      app_metadata: { ...(existente.app_metadata ?? {}), cargo: 'admin' }, // merge: no pisa otros campos
    })
    if (error) throw new Error(`updateUserById: ${error.message}`)
    const cargo = data?.user?.app_metadata?.cargo
    console.log(`Usuario admin YA EXISTÍA → actualizado.`)
    console.log(`  id: ${data?.user?.id}`)
    console.log(`  app_metadata.cargo = ${cargo}  ${cargo === 'admin' ? 'OK' : 'NO-OK ⚠️'}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASS,
      email_confirm: true,                 // sin flujo de email; login directo
      app_metadata: { cargo: 'admin' },    // claim que leerá la RLS (auth.jwt()->'app_metadata'->>'cargo')
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    const cargo = data?.user?.app_metadata?.cargo
    console.log(`Usuario admin CREADO.`)
    console.log(`  id: ${data?.user?.id}`)
    console.log(`  app_metadata.cargo = ${cargo}  ${cargo === 'admin' ? 'OK' : 'NO-OK ⚠️'}`)
  }
  // No se imprime el password en ningún caso.
  process.exit(0)
} catch (e) {
  console.error('Error en el alta:', e instanceof Error ? e.message : String(e))
  process.exit(1)
}
