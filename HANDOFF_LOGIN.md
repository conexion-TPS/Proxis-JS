# HANDOFF_LOGIN — Lote "Login negro + ojo" y pendientes abiertos

> Creado 2026-06-13. **NO commiteado aún** (se commitea junto con el lote tras validación en vivo de TPS).
> Dev server vivo en **:3000** (sirve el login nuevo verificado). `npm run build` → exit 0.

---

## (a) LOTE LOGIN NEGRO + OJO — estado: IMPLEMENTADO, sin commit (espera validación TPS)

**Objetivo:** re-tematizar los 5 logins de `/app` al diseño **NEGRO del legacy** (`#screen-login`: fondo `#0b0a09` + glow lime + textura de puntos, `.lcard` blanca, logo de nodos + "Proxis", título "Ingresa a tu cuenta", footer ©) + **2 divergencias deliberadas aprobadas**: campo **email** (no nombre+select) y **ojo** mostrar/ocultar contraseña (SVG inline, sin librería de íconos).

**Cómo quedó:**
- **NUEVO `src/app/app/LoginScreen.tsx`** (client): componente único con el tema negro + email/password + ojo (`showPass`, SVG eye/eye-off `currentColor`) + `useAuth().login` + estados locales + Enter envía + subtítulo fijo "Ingresa a tu cuenta".
- **`src/app/app/shellCss.ts`**: +2 tokens que faltaban para el tema negro (`--shadow-3`, `--ring`). `--blue`/`--red`/`--red-lt` ya existían (no duplicados).
- **Las 5 pantallas** (`page.tsx` puerta, `informe`, `simulador`, `simulador-consorcio`, `tracker`) ahora renderizan `<LoginScreen/>` cuando `!token`. Se eliminó el bloque `.login-*` (6 reglas) y el JSX de login inline de cada una. Estados solo-login (`email/pass/login()/signIn`, y `err/cargando` donde eran solo-login) removidos para no romper el build.
  - **informe (caso especial):** `cargando` lo usa el contenido (se mantuvo); `err` (que setea `cargar`) se **reubicó** al contenido como `{err && <div className="ib rd">…}` (antes solo se veía en el login, inalcanzable estando logueado). `cargar` intacto.
  - **Gates "Cargando…"** de simulador/simcon/tracker/puerta que usaban `.login-wrap`: se pasaron a **estilo inline** (mismo look claro) para poder eliminar el `.login-*` sin romperlos. Lógica post-login/gates de rol/tenant: **intactos**.

**Verificación hecha:**
- `npx tsc --noEmit` → exit 0.
- `npm run build` → **exit 0** (todas las rutas `/app` compilan, incl. redirect `/app/tracker-consorcio`).
- Sin clases `.login-*` huérfanas; `<LoginScreen/>` importado+usado en las 5.
- Dev :3000 sirve `/app` con el login negro: `#screen-login`, `#0b0a09`, "Ingresa a tu cuenta", `.leye` presentes; 0 `.login-card` viejo. `/app/informe` → 200.

**Falta:** validación visual en vivo de TPS (las 5 pantallas: login negro idéntico + ojo funciona) → luego commit.

**Archivos del lote (working tree, sin commitear):**
```
?? src/app/app/LoginScreen.tsx
 M src/app/app/shellCss.ts
 M src/app/app/page.tsx
 M src/app/app/informe/page.tsx
 M src/app/app/simulador/page.tsx
 M src/app/app/simulador-consorcio/page.tsx
 M src/app/app/tracker/page.tsx
```
EXCLUIR del commit: `?? MARCO_REFERENCIA_IA.md`, `?? VISION_CAPA_IA.md` (otro frente). `next-env.d.ts` (autogen) ya restaurado; si reaparece → `git restore`.

---

## (b) PENDIENTES ABIERTOS

1. **🔴 Diagnóstico de rama del commit `0268014` (Puerta Única):** está en **`main`** (ahead **1** de `origin/main`), **NO en `desarrollo`**. Toda la sesión de porting se commiteó en `main`. Existe además rama **`desarrollo`** (ahead **9** de `origin/desarrollo`), línea separada. Esto **choca con la regla "commits a desarrollo"** → hay que decidir (TPS/contralor) cómo reconciliar: ¿el porting debió ir a `desarrollo`? ¿se mueve `0268014` (+ el lote login) a `desarrollo` (cherry-pick/rebase)? ¿o `main` pasa a ser la línea válida? **No resuelto — decisión de rama pendiente.**
2. **Push pendiente del lote Puerta Única:** `0268014` **sin pushear** (main ahead 1 de origin/main). El push se hace **solo por orden de TPS**, y depende de resolver antes el punto 1 (a qué rama).
3. **Lock de semanas previas (divergencia deliberada, SIN implementar):** TPS quiere que en la Bitácora **solo la semana en curso sea editable** (las anteriores, solo lectura). Es una divergencia deliberada respecto al calco; **aún no diseñada ni implementada**. Pendiente de inventario→OK→implementación cuando se priorice. (Nota: la escritura de bitácora completa es Fase 3 — ver `MAPEO_BITACORA_FASE3.md`.)

---

## (c) REGLAS DEL PROYECTO (vigentes)

- **Calco fiel** del legacy, **salvo divergencias explícitamente aprobadas** por TPS (p.ej. en este lote: email + ojo). Ante ambigüedad → **DETENER y preguntar**, no inventar/decidir.
- **Flujo por lote:** inventario (solo lectura) → **OK de TPS** → implementar → verificar (`tsc`/`build`/byte-diff según aplique) → **validación en vivo de TPS** → recién ahí **commit** (local).
- **Commits a `desarrollo`** (línea de desarrollo). **Push solo por orden explícita de TPS; nunca por iniciativa.**
- **Roles:** el **contralor** redacta los prompts/instrucciones; **TPS decide**; **Claude Code ejecuta** (no decide alcance ni hace cosas fuera de lo aprobado).
- **No tocar:** `/plataforma` y `/vina` (legacy/prod), endpoints `/api/*` salvo orden, Zurich (login pendiente), cálculo de simuladores.

---

## (d) ESTADO GIT (`git branch -vv`)

```
  desarrollo  dd85aa3 [origin/desarrollo: ahead 9] fix(legacy): saludo onboarding supervisor despersonalizado
* main        0268014 [origin/main: ahead 1] feat(app): puerta única de entrada — índice /app + login + distribución por rol + CTAs a /app
```
- Rama actual: **`main`** (HEAD `0268014`).
- `origin/main..HEAD` = **1 commit** (solo `0268014`, Puerta Única, sin pushear).
- Working tree: el lote login (7 archivos arriba) + 2 `.md` de IA a excluir, **sin commitear**.
- ⚠️ El lote login está sobre `main`; si se decide que la línea es `desarrollo` (punto b.1), habrá que reubicar tanto `0268014` como este lote.
