# PROXIS — Diseño de Consolidación
### Fuente de verdad del modelo de datos y plan de fases

> **Última actualización:** tras ejecutar Fase 0, paso 0.1 (origen Viña ordenado).
> Este documento reemplaza las partes desactualizadas del HANDOFF.

---

## ⏱️ ESTADO ACTUAL (leer primero)

| Hito | Estado |
|---|---|
| Migración Gemini → Groq/OpenRouter | ✅ **Completa** (6 edge functions + capa Next.js, verificada en producción) |
| **FASE 0 · Consolidación de datos** | ✅ **COMPLETA** (pasos 0.0–0.6) |
| ↳ datos reales migrados Viña → proxis_dev | **455 filas** + **18 personas reales** en `persona`, por `persona_id` / `institucion_id`, sin pérdida |
| ↳ Viña (producción) | **Intacta — nada conmutado** (la conmutación es Fase 3); reversible vía respaldo 0.0 |
| **Paso A · Jerarquía organizacional (equipos reales)** | ✅ **COMPLETA** (nodos + supervisoras + 16 asesores conectados; resolución asesor→supervisor verificada) |
| **Paso B · Piloto Mi Informe (capa de datos)** | ✅ **VALIDADO** (patrón de portado legacy→React probado con datos reales; commit `d497cb1`) |
| **Próximo paso** | **Diseño/UI de Mi Informe → portar demás pantallas** (nodos, tracker, simulador) |

**Migración a Groq (sesión previa):** todo el sistema corre sobre **Groq (primario) → OpenRouter (fallback)**. Las funciones `proxis-analyzer`, `proxis-monitor`, `proxis-observacion`, `proxis-researcher`, `proxis-accion` y `proxis-cerebro` (su monitoreo) usan `_shared/ai-client.ts`. La capa Next.js usa `src/lib/ai-client.ts` (con `gemini.ts` como puente de compatibilidad). Tabla de log: `gemini_usage` (nombre histórico; ahora registra `modelo='llama-3.3-70b-versatile'`). Secrets `GROQ_KEY`/`OPENROUTER_KEY` en Supabase (edge) y en Vercel `proxis-dev-admin`. **Pendiente:** las keys NO están en el deploy `proxis-js` (el del dominio real) → agregar antes de que la IA opere en producción.

---

## 1. Mapa real de la arquitectura

### Proyectos Supabase (solo 2)

| Proyecto | Ref | Contenido |
|---|---|---|
| **proxis_dev** | `mkqgbmwmvypcjzlxidsm` | Toda la IA, jerarquía `org_*`/`instituciones`, tenant demo `Imrbrasil`, ficticios. **Sin usuarios reales.** |
| **Viña** | `uolmsxoudvkopscxbvij` (`sgu-vina-prospección`) | **Datos reales** de ambos equipos. Bitácora en uso. **Sin IA.** |

### Proyectos Vercel (3)
- **proxis-js** → `proxis.theprecisionselling.com` (dominio real, rama `main`).
- **proxis-dev-admin** → `proxis-dev-admin.vercel.app` (tiene las keys de IA).
- **sailor-front** → app del asesor (consume APIs, no toca IA directo).

### El cruce que causa el desorden
- Datos reales en Viña; IA en proxis_dev → separados.
- `/plataforma` (legacy JS) lee de **Viña** con URL+anon key **hardcodeadas** en `public/plataforma-core.js`. Su módulo de cuestionarios, en cambio, lee de proxis_dev.
- Keys de IA en `proxis-dev-admin`, pero usuarios entran por `proxis-js`.

---

## 2. Modelo de tenant

| | Viña | proxis_dev |
|---|---|---|
| Discriminador | columna `empresa` (texto) | tabla `instituciones` (id) + `org_*` |
| Madurez | primitivo | **maduro → modelo destino** |

**Decisión: consolidar hacia `instituciones`.** El `empresa` de Viña se traducirá a `institucion_id`.

### Mapeo de tenants (validado 12/12, cero contaminación)
- `empresa='zurich'` → institución **Zurich** (equipo Alejandra Espinoza) — id `16726d00-78ef-4885-9218-02c649244084` (creada en 0.3.a)
- `empresa='vina'`/`consorcio` → institución **Consorcio** (equipo Valeska Comparini) — id `c05f3883-827d-4ab8-a0b8-4dba6424fcac` (creada en 0.3.a) → **ya reclasificado a `consorcio` en 0.1**
- `Imrbrasil` (proxis_dev) → tenant **Demo** (se conserva como entorno de pruebas)

---

## 3. Jerarquía organizacional (proxis_dev — ya existe, es buena)

```
instituciones (id)              tenant, tabla con id propio
   ├─ org_capas                 nombre de cargo POR institución y nivel (configurable)
   └─ org_nodos (parent_id)     árbol N niveles
        └─ org_usuarios         cadena de mando (supervisores/gerentes/admin)
```
- Rol estructural: `org_usuarios.cargo` enum fijo (`asesor, supervisor, gerente_zonal, gerente_regional, admin`).
- Nombre visible: `org_capas.nombre_cargo` por institución + `org_nodos.titulo_propio` override.
- **Resolución de tenant por DOS caminos:** asesores vía `asesor_credentials.org_nodo_id`; mando vía `org_usuarios.org_nodo_id`. Un resolvedor unificado debe consultar ambas.

---

## 4. EL hallazgo crítico: el nombre no es llave

`asesor` es texto libre (nombre). Los nombres NO son únicos — ni entre empresas ni dentro de una (una empresa con 500k asesores tendrá homónimos). ~21 tablas derivan tenant desde el nombre → riesgo de confundir personas.

**Solución (decidida — Opción A, implementada en 0.3.b):** tabla maestra **`persona`** con id propio (**uuid**) inmutable, que apunta a su fila de origen (`origen_tabla`+`origen_id`); el nombre pasa a ser atributo. Cubre a TODOS (asesores + mando, por el caso Roberto Matta/Valeska) consultando los dos caminos, sin alterar `asesor_credentials`/`org_usuarios`. Hacerlo en Fase 0 mientras los datos son pocos y sin colisiones. Las ~21 tablas del grupo B referenciarán `persona_id` (paso 0.3.c).

---

## 5. Inventario de tablas (proxis_dev) por tratamiento

- **A. Ya tenant-aware (directo):** org_nodos, org_capas, org_invitaciones, grupos, knowledge_base_conductual, legal_aceptaciones, asesor_credentials, org_usuarios.
- **B. Requieren `institucion_id`+`persona_id` (~21):** behavioral_signals, deductions_log, asesor_perfil, asesor_perfil_historial, message_log, sailor_messages, tps_perfiles, ingresos, reportes, contactos, nodos, activaciones_nodo, metas, respuestas_cuestionario, knowledge_gaps, knowledge_proposals, derechos_solicitudes, consentimiento_historial, device_tokens, push_tokens, asesor_emails.
- **C. Globales/sistema (sin tenant):** config, cuestionarios, preguntas, prompts, trigger_config, trigger_efectividad, email_templates, knowledge_base, legal_documentos, legal_event_log, error_log, gemini_usage, canary_log, repair_log, system_health_log, deployment_log, feriados_chile, seguridad_brechas, subencargados, anonymization_audit_log, anonymized_profiles, supervisores, feedback, instituciones. *(Verificar si `feedback` debe ser tenant-aware.)*

---

## 6. Estado real de las tablas de Viña (7 tablas — corrige el plano original que decía 6)

| Tabla | `empresa` original? | Notas |
|---|---|---|
| reportes | ✅ sí | — |
| contactos | ✅ sí | — |
| metas | ✅ sí | — |
| nodos | ❌ no → **agregada en 0.1** | backfill por asesor |
| activaciones_nodo | ❌ no → **agregada en 0.1** | backfill por asesor |
| **ingresos** | ❌ no → **agregada en 0.1** | (faltaba en el plano original; es la 7ª tabla) |
| vina_credentials | ❌ no → **agregada en 0.1** | contiene `password_hash` (sensible) |

---

## 7. FASE 0 — Bitácora de ejecución

### 0.0 Respaldo de Viña — ✅ EJECUTADO
- Carpeta: `C:\Projects\_proxis_backups\vina_0.0_2026-06-05\` (fuera del repo, por `password_hash`).
- 7 tablas, **479 filas** totales, un JSON por tabla + `_manifest.json` con 7 SHA-256.
- Conteos respaldados: activaciones_nodo 38, contactos 289, ingresos 23, metas 12, nodos 30, reportes 80, vina_credentials 7.
- Es el **punto de retorno absoluto**.

### 0.1 Ordenar origen (Viña) — ✅ EJECUTADO Y VERIFICADO

**SQL ejecutado (en SQL Editor de Viña, ref uolmsxou):**

**0.1.0 — Verificación mapa asesor→empresa (solo lectura):** todos los asesores con `n=1` (una sola empresa). Cero contaminación confirmada sobre datos actuales.

**0.1.a — Reclasificar `vina`→`consorcio`:**
```sql
update reportes  set empresa = 'consorcio' where empresa = 'vina';
update contactos set empresa = 'consorcio' where empresa = 'vina';
update metas     set empresa = 'consorcio' where empresa = 'vina';
```
Resultado: ya no existe ningún `empresa='vina'`. Tenants en Viña ahora: `zurich` y `consorcio`.

**0.1.b — Agregar `empresa` a las 4 tablas + backfill:**
```sql
alter table nodos             add column if not exists empresa text;
alter table activaciones_nodo add column if not exists empresa text;
alter table ingresos          add column if not exists empresa text;
alter table vina_credentials  add column if not exists empresa text;

update nodos n             set empresa = m.empresa from (select distinct asesor, empresa from reportes) m where n.asesor = m.asesor and n.empresa is null;
update activaciones_nodo a set empresa = m.empresa from (select distinct asesor, empresa from reportes) m where a.asesor = m.asesor and a.empresa is null;
update ingresos i          set empresa = m.empresa from (select distinct asesor, empresa from reportes) m where i.asesor = m.asesor and i.empresa is null;
update vina_credentials c   set empresa = m.empresa from (select distinct asesor, empresa from reportes) m where c.asesor = m.asesor and c.empresa is null;
```

**0.1.c — Verificación de huérfanos:** nodos 0, activaciones_nodo 0, ingresos 0, vina_credentials **1**.
- La fila huérfana era **Valeska Comparini Cruells** (supervisora de Consorcio). Causa: los supervisores no aparecen en `reportes`, así que el backfill no la encontró. **Patrón a recordar.**
- Resuelta manualmente:
```sql
update vina_credentials set empresa = 'consorcio' where asesor = 'Valeska Comparini Cruells' and empresa is null;
```
- Re-verificación: `vina_credentials sin empresa = 0`. ✅

**0.1.d — Depuración de registros basura (anteriores al contrato de anonimización, no aplica política):**
- **Marcela Almonacid** (asesora despedida) eliminada de Viña → borrado en orden hijos→padres:
```sql
delete from contactos where asesor = 'Marcela Almonacid';  -- 10
delete from reportes  where asesor = 'Marcela Almonacid';  -- 4
delete from ingresos  where asesor = 'Marcela Almonacid';  -- 1
delete from metas     where asesor = 'Marcela Almonacid';  -- 1
```
Verificado: 0 filas restantes. (⚠️ NO confundir con **Marcela Jara**, asesora vigente de Zurich → NO se tocó.)
- **"Asesor"** (placeholder de prueba inicial) eliminado: solo tenía 1 fila en `metas`.
```sql
delete from metas where asesor = 'Asesor';  -- 1
```
Verificado: 0.

**Estado final del origen tras 0.1:** Viña ordenado → `empresa` poblada en las 7 tablas, valores `zurich`/`consorcio` únicamente, cero huérfanos, basura eliminada. `proxis_dev` NO fue tocado. Todo reversible vía respaldo 0.0.

> **Nota de conteos:** tras borrar a Marcela Almonacid, restar de los conteos del respaldo: reportes −4, contactos −10, ingresos −1, metas −1 (+ "Asesor" metas −1). Verificar números finales en la próxima sesión si se necesitan exactos.

### 0.2 Limpiar `proxis_dev` — ✅ EJECUTADO
- Borrada la institución duplicada muerta **IMR Brasil** (`67a7287b…`, 0 nodos/capas/usuarios = basura). Conservada **Imrbrasil** (`c28fe5f9…`, activa) = tenant **Demo**.
- Borrados los 3 huérfanos seed **Asesor Test Uno/Dos/Tres**.
- Resultado: `proxis_dev` queda con una sola institución (`Imrbrasil`), listo para sumar Zurich y Consorcio.

### 0.3.a Crear instituciones + capas (proxis_dev) — ✅ EJECUTADO
- Creada institución **Zurich** — id `16726d00-78ef-4885-9218-02c649244084`.
- Creada institución **Consorcio** — id `c05f3883-827d-4ab8-a0b8-4dba6424fcac`.
- Cada una con **4 capas** (`org_capas`): nivel 1 *Gerente de ventas*, nivel 2 *Gerente Regional*, nivel 3 *Gerente Zonal*. **Nivel 4 = nombre configurable por institución** (ilustra el `nombre_cargo` por tenant de §3): en **Zurich** = *Sub Gerente de Unidad*; en **Consorcio** = *Jefe de Ventas*. (El rol estructural `org_usuarios.cargo` sigue siendo el enum global `supervisor`; cambia solo el nombre visible.)
- Tenants ahora en `proxis_dev`: **Demo** (`Imrbrasil`), **Zurich**, **Consorcio**.

### 0.3.b Crear y poblar tabla `persona` — ✅ EJECUTADO (modelo Opción A)

**Decisión de modelo (CERRADA): Opción A — `persona` como tabla maestra que apunta a su fila de origen.**
Cada persona es una fila en `persona` con un puntero de regreso a la tabla de origen (`origen_tabla` + `origen_id`), en vez de meter un `persona_id` dentro de `asesor_credentials`/`org_usuarios`. Así un único id cubre **ambos caminos** de resolución de tenant (asesores vía `asesor_credentials`, mando vía `org_usuarios`; §3/§4) sin tocar la estructura de esas dos tablas.

**Tabla `persona` creada (con RLS):** columnas
`id` (uuid, PK) · `nombre` · `email` (único secundario) · `institucion_id` · `tipo` (asesor | mando) · `origen_tabla` · `origen_id` · `activo` · `created_at`.
- **`origen_tabla`/`origen_id` son NULLABLE** (ajuste hecho al crear las personas reales): los asesores **Zurich no tienen fila de origen** en ninguna tabla de credenciales — viven **hardcodeados en `public/plataforma-core.js`** (ver 0.4.a) → su puntero al origen queda en `null`.

**Poblada inicialmente con 5 personas de `Imrbrasil`:** 3 `tipo=asesor` (vía `asesor_credentials`) + 2 `tipo=mando` (vía `org_usuarios`). (Ampliada a 23 en 0.4.a.)
- **`admin` excluido** a propósito: no tiene `org_nodo_id` → no cuelga de la jerarquía, no es una persona-en-un-nodo. **Patrón a recordar** (junto con el de Valeska en 0.1.c: los caminos de resolución no cubren a todos los registros por igual).

### 0.3.c Agregar `persona_id`+`institucion_id` a las 21 tablas — ✅ EJECUTADO
- Las **21 tablas del grupo B** ahora llevan `persona_id` + `institucion_id` explícitos, backfilleados. **0 huérfanos** tras el backfill.
- Con esto el grupo B deja de depender del `asesor` texto como llave de tenant (§4).

---

## 7-bis. FASE 0.4 — Traer los datos reales (Viña → proxis_dev)

### 0.4.a Crear las 18 personas reales — ✅ EJECUTADO
- **`persona` ahora tiene 23 filas:** 5 demo (`Imrbrasil`, de 0.3.b) + **11 Zurich** + **7 Consorcio**.
- **Zurich (11 = 10 asesor + 1 mando):** mando = *Alejandra Espinoza Morral*; asesores = Diego Pérez, Fernanda Grothusen, Francis Arancibia, Marcela Jara, María Francisca Lorenz, Mauricio Gana, Nazaret Johannesen, Oriana Jorquera, Sindy Martínez, Verónica Castillo. → `email = null` y `origen_* = null`: **no existen en ninguna tabla de credenciales**, viven hardcodeados en `public/plataforma-core.js` (objeto `USUARIOS`). Por eso `origen_*` se hizo nullable en 0.3.b.
- **Consorcio (7 = 6 asesor + 1 mando):** mando = *Valeska Comparini Cruells*; asesores = Angela Castillo Guzmán, Carla Ortiz Concha, Ignacio Hidalgo Lazcano, Jaime Caro Navarro, Paula Domínguez, Rocío Concha Silva. → `email` poblado (origen real `vina_credentials`, login por BD/bcrypt).

> 🔴 **RIESGO DE SEGURIDAD anotado (no resuelto en Fase 0):** `public/plataforma-core.js` expone en **texto plano** en el bundle público las **10 claves de los asesores Zurich** (objeto `USUARIOS`) **y la anon key del proyecto Viña** (`SB_KEY`, líneas ~9-10). Cualquiera con "ver código fuente" en `/plataforma` las obtiene. Login Zurich = validación client-side contra ese objeto (no hay BD para Zurich). **A resolver al portar Zurich a credenciales reales (Fase 1/3), junto con RLS de Viña.**

### 0.4.b Copiar datos de bitácora Viña → proxis_dev — ✅ EJECUTADO

**Método (decisión cerrada): vía staging temporal.** Copia cruda a tablas `stg_*` en proxis_dev → transformar + resolver `persona_id` por **nombre + institución** → insert en la tabla real → drop staging. **El join del backfill SIEMPRE es por nombre + `institucion_id`** (red anti-homónimos), nunca solo por nombre.

**Decisiones que estaban abiertas, ahora cerradas:**
1. **`sin_actividad` → CONSERVADO** (se agregó la columna en destino).
2. **Método → staging temporal** (descrito arriba).

**455 filas migradas:**

| Tabla | Filas | Notas de esquema (transformación aplicada) |
|---|---|---|
| reportes | 76 | `semana_inicio` date→text; `created_at` +zona; `sin_actividad` conservado (columna agregada) |
| contactos | 279 | `created_at` +zona; integridad `reporte_id` verificada (0 huérfanos) |
| metas | 10 | proxis_dev **SIN columna `id`**; PK = `asesor`; solo Zurich |
| nodos | 30 | 3 fechas date→text; solo Zurich |
| activaciones_nodo | 38 | `semana_inicio` date→text; integridad `nodo_id` verificada; solo Zurich |
| ingresos | 22 | proxis_dev **SIN `id`**; PK = (`asesor`,`mes`); Viña sin `created_at`→null; `ingreso_real` int→numeric; solo Zurich |

- **Consorcio aún no tiene `metas`/`nodos`/`activaciones`/`ingresos`** (equipo reciente) → sembrar en Fase 2.

### 0.5 Verificación de consistencia — ✅ EJECUTADO
- Conteos en proxis_dev == lo migrado: **76 / 279 / 10 / 30 / 38 / 22**.
- Integridad por persona verificada: 18 personas; supervisores en 0/0/0 (correcto — no reportan); asesores con datos coherentes. **Cero pérdida.**

### 0.6 Punto de control — ✅ (estado al cierre de Fase 0)
- Datos reales consolidados en proxis_dev, conectados por `persona_id`, segmentados por `institucion_id`.
- **Viña intacta como producción. Nada conmutado.** Reversible (respaldo 0.0 vigente). La conmutación es **Fase 3**.

---

### Pasos pendientes de Fase 0

| Paso | Proyecto | Acción | Estado |
|---|---|---|---|
| 0.2 | **proxis_dev** | Borrar institución duplicada muerta "IMR Brasil" (`67a7287b…`) + 3 "Asesor Test Uno/Dos/Tres" (huérfanos seed) | ✅ hecho |
| 0.3.a | proxis_dev | Crear instituciones Zurich y Consorcio + 4 capas c/u | ✅ hecho |
| 0.3.b | proxis_dev | Crear y poblar tabla `persona` (uuid, modelo Opción A) | ✅ hecho |
| 0.3.c | proxis_dev | Agregar `institucion_id`+`persona_id` a las 21 tablas (grupo B) | ✅ hecho (0 huérfanos) |
| 0.4.a | proxis_dev | Crear las 18 personas reales (Zurich + Consorcio) en `persona` | ✅ hecho (23 en total) |
| 0.4.b | lee Viña → escribe proxis_dev | Copiar datos de bitácora (6 tablas, 455 filas) con transformación de esquema + `empresa`→`institucion_id`/`persona_id`, vía staging | ✅ hecho |
| 0.5 | (comparación) | Verificación de consistencia (conteos + integridad por persona) | ✅ hecho (cero pérdida) |
| 0.6 | — | Punto de control: datos consolidados y verificados, conviviendo con Viña. **Nada conmutado.** | ✅ **Fase 0 COMPLETA** |

> ⚠️ **A partir del 0.2 se trabaja en `proxis_dev` (mkqgbmwm), NO en Viña.** Verificar SIEMPRE el nombre del proyecto arriba en Supabase antes de ejecutar.

---

## 7-ter. PASO A — Jerarquía organizacional de equipos reales — ✅ COMPLETA

**Motivo:** la Fase 0 creó instituciones, capas y personas, pero faltaban los `org_nodos` (el árbol) y conectar las personas reales a él. Sin esto, la resolución asesor→supervisor y los informes por nivel **no funcionaban para los equipos reales** (solo para el demo `Imrbrasil`).

**Cómo resuelve el sistema la jerarquía (verificado en código):**
- El sistema **NO lee `persona`/`persona_id` todavía** (está "dormida"). Toda la resolución corre por `asesor_credentials.org_nodo_id` (asesores) + `org_usuarios.org_nodo_id` (mando), y el árbol por `org_nodos.parent_id` (RPC `org_subtree`).
- **Edge functions** (`proxis-monitor`, `proxis-accion`): buscan al supervisor en el **nodo exacto** del asesor (no suben por el árbol).
- **Dashboard Next.js** (`/api/equipo/dashboard`): recorre el **subárbol completo** (RPC `org_subtree`).
- **Implicación de diseño:** asesores y su supervisora deben estar en el **MISMO nodo** (como `Imrbrasil`), o las edge functions no encontrarían al supervisor.

**Decisión:** construir la jerarquía sobre el modelo existente (`org_usuarios`/`asesor_credentials` + `org_nodo_id`), **NO sobre `persona`**, porque es el único que el código actual sabe leer. Migrar la jerarquía a `persona_id` es trabajo futuro deliberado.

### A.1 — Nodos creados (proxis_dev)
Estructura mínima real: hoy la supervisora es la cabeza de cada equipo (sin mando intermedio). Un nodo de nivel supervisor por institución, `parent_id=null` (cuando entre un gerente, su nodo cuelga encima sin rehacer nada).

| Nodo | id | Institución | capa (nivel 4) |
|---|---|---|---|
| **Unidad Zurich** | `d73eccd4-f18a-4e74-a3b4-8c1a7fc58abc` | Zurich | Sub Gerente de Unidad (`0f5814aa-aac6-4434-9c2e-ccf9ebb53949`) |
| **Equipo Consorcio** | `ae1d879e-36b5-4fa7-8086-1552a6e03d8b` | Consorcio | Jefe de Ventas (`c824d871-9920-42fc-9fbe-b4098f41603f`) |

### A.2 — Supervisoras conectadas (`org_usuarios`)
| Persona | nodo | cargo | login |
|---|---|---|---|
| **Valeska Comparini Cruells** | Equipo Consorcio | supervisor | hash real de `vina_credentials`, `acceso_bloqueado=false` (login activo) |
| **Alejandra Espinoza Morral** | Unidad Zurich | supervisor | `password_hash='LOGIN_PENDIENTE_MIGRACION'`, email placeholder, `acceso_bloqueado=true` (sigue entrando por JS hardcodeado) |

### A.3 — Asesores conectados (`asesor_credentials.org_nodo_id`)
- **Consorcio (6):** Angela Castillo Guzmán, Carla Ortiz Concha, Ignacio Hidalgo Lazcano, Jaime Caro Navarro, Paula Domínguez, Rocío Concha Silva → nodo Equipo Consorcio, con **hash real de `vina_credentials`** (login intacto).
- **Zurich (10):** Diego Pérez, Fernanda Grothusen, Francis Arancibia, Marcela Jara, María Francisca Lorenz, Mauricio Gana, Nazaret Johannesen, Oriana Jorquera, Sindy Martínez, Verónica Castillo → nodo Unidad Zurich, con `password_hash='LOGIN_PENDIENTE_MIGRACION'` y email placeholder (`<nombre>@zurich.placeholder`). Siguen entrando por JS hardcodeado.

### A — Verificación final ✅
- Árbol: Unidad Zurich → 10 asesores + 1 mando; Equipo Consorcio → 6 asesores + 1 mando.
- Resolución asesor→supervisor probada: Diego Pérez → Alejandra Espinoza Morral; Carla Ortiz Concha → Valeska Comparini Cruells. **La IA ya puede resolver la jerarquía de los equipos reales.**

---

## 7-quater. PASO B — Piloto Mi Informe (capa de datos) — ✅ VALIDADO

**Objetivo cumplido:** probar que una pantalla React puede leer del modelo consolidado (proxis_dev por `persona_id`/`institucion_id`) en vez del legacy (Viña por nombre). Riesgo mínimo: vista **read-only**. Commit `d497cb1`.

### El cimiento reutilizable: resolución de identidad
- **`src/lib/identity.ts`** → `resolveIdentity(req)` — la pieza que **TODA la Fase B reutiliza**.
- **`src/app/api/app/me/route.ts`** → expone la resolución.
- Verifica el JWT existente (emitido por `/api/vina/login`, firmado con **`SAILOR_JWT_SECRET`** — ojo: ese es el nombre real de la env var en local, no `VINA_JWT_SECRET`).
- Resolución en proxis_dev (`supabaseAdmin()`, service-role; **cero lecturas a Viña**):
  - **Primario (Consorcio):** por email → `persona WHERE email` (índice único). `via='email'`.
  - **Fallback (Zurich):** por nombre + institución → `persona WHERE nombre AND institucion_id`. `via='nombre+institucion'`.
  - **Match exacto en JS** (NFC + trim + lowercase) tras `ilike`; si quedan ≥2 → **409 anti-homónimos** (falla en vez de adivinar).
- Output: `{ persona_id, institucion_id, institucion_nombre, nombre, tipo, via }`.

### El endpoint de datos
- **`src/app/api/app/informe/route.ts`** → resuelve identidad + corre 4 queries por `persona_id` + calcula KPIs **server-side** (portado fiel de `calcIndicadores`, incluye "semanas fantasma"). Devuelve DTO ya calculado → componente React "tonto".
- Reemplazo exacto del filtrado legacy `asesor=eq.<nombre>&empresa=eq.vina` → `persona_id=eq.<uuid>`.
- `semana_inicio` es TEXT ISO → comparación por rango como string (válida lexicográficamente).

### El componente
- **`src/app/app/informe/page.tsx`** → ruta nueva `/app` (destino del diseño, **NO** montado sobre `/vina`). Tarjetas KPI (resumen del mes + correlación ingresos). Reusa el login de `/vina` (token).

### Validación en vivo (ambos caminos de identidad probados)
- **Test A — Consorcio end-to-end (login real):** *Carla Ortiz* entra con email+clave → resuelve `persona_id` por email → muestra sus KPIs reales (reportes/contactos). `metas`/`ingresos` caen a defaults (Consorcio no tiene esos datos aún). ✅
- **Test B — capa de datos vía Zurich (token de prueba):** *Diego Pérez* resuelto por fallback nombre+institución → lee `metas` REALES (`meta_ingresos=1647703`) + KPIs calculados. Valida las queries de `metas`/`ingresos`. ✅
- **Conclusión:** los dos caminos de resolución funcionan; las 4 queries (reportes, contactos, metas, ingresos) leen por `persona_id` desde proxis_dev. **El patrón de toda la Fase B queda probado.**

### Prerrequisito de config detectado y resuelto
- El login de Consorcio (`/api/vina/login`) requiere `VINA_SUPABASE_URL` + `VINA_SUPABASE_SERVICE_KEY` en `.env.local` (faltaban en local; agregadas). `NEXT_PUBLIC_SUPABASE_URL` apunta a proxis_dev.
- El servidor local corrió en **puerto 3001** (3000 ocupado).

### Pendientes del piloto (trabajo posterior, NO ahora)
1. **Diseño/UI de Mi Informe:** la distribución visual difiere del legacy. Diferido a propósito — el piloto validó la capa de datos (lo difícil); el pulido visual es segunda capa. Decidir luego: replicar el look legacy o mejorarlo.
2. **Chart de nodos en Mi Informe:** diferido del piloto (solo se portaron las tarjetas KPI).
3. **Tooltips:** el piloto usa `title` nativo en vez del sistema `showTooltip` del legacy.

### Pantallas pendientes de portar (con el patrón ya probado)
- **Nodos** (chart + conversión) — escribe datos, acoplada (chart vive en Mi Informe, conversión en Tracker).
- **Tracker / Bitácora** — escritura pesada, mayor blast radius.
- **Simulador de metas** — cálculo puro (no toca BD), 9 archivos `compensacion/`, tenant-split.

---

## 8. Fases siguientes (resumen)
- **Fase 1** → Portar al React (`/vina`→`/app`) lo que solo existe en legacy: Mi Informe, nodos, simulador de metas, tracker. → paridad funcional.
- **Fase 2** → Conectar IA a la plataforma React: Sailor FAB en bitácora, cuestionarios dosificados (5 por tanda, cadencia 360° intercalada), captura de señales, informes por nivel de jerarquía.
- **Fase 3** → Unificar Vercel: un proyecto, dominio real → React, keys de IA correctas. Apagar `/plataforma` legacy. Conmutar fuente de datos.
- **Fase 4** → Alta de tenant automática (1 min, sin tocar interfaz). Resuelve el riesgo del error de compensación.

---

## 9. Decisiones cerradas (cimientos)

| Decisión | Valor |
|---|---|
| Proyecto único destino | `proxis_dev` |
| Plataforma del futuro | React (`/vina` → `/app`) |
| Modelo de tenant | tabla `instituciones` (id) |
| Tenants reales | Zurich, Consorcio (+ Demo = imrbrasil) |
| Identificador de persona | `uuid` propio; nombre = atributo |
| Modelo de `persona` | **Opción A**: tabla maestra con puntero al origen (`origen_tabla`+`origen_id`); no se modifica `asesor_credentials`/`org_usuarios` |
| Dirección de migración | Viña → proxis_dev (la IA no se mueve) |
| Método | espejo verificado, reversible, sin downtime |
| Ritmo | bien hecho, sin atajos; una sub-acción → verificar → siguiente |

---

## 10. Cadencia de captura 360° (diseño para Fase 2 — anotado)
- Premisa: *"me conoce tan bien que me ayuda exactamente donde lo necesito"*. Antipatrón a evitar: cuestionarios de 40+ preguntas.
- **5 preguntas por tanda** máx. Intenso al inicio, luego espaciado. Frecuencia **intercalada** (semana cuestionario asesor / semana validación supervisor / …).
- Esfera 3D de señales: lo que el asesor **hace** (bitácora) + **dice** (cuestionarios, chat Sailor) + lo que el supervisor **observa** (feedback, confirmación de hipótesis, datos no capturables: ventas reales, persistencia de cartera, intención de desvinculación).
- Conversión clave: **contacto → prospecto → nodo**. El nodo = contacto que da prospectos 2ª vez = centro de influencia = activo más valioso. El coaching debe cultivar nodos.

---

## 11. Frentes futuros anotados (NO ahora)

### Deudas técnicas concretas (actualizado tras paso A — abordar en fases siguientes)
- **🔴 Login de Zurich (11 filas):** los 10 asesores + Alejandra tienen `password_hash='LOGIN_PENDIENTE_MIGRACION'` y emails placeholder en proxis_dev; **siguen entrando por el JS hardcodeado** (`public/plataforma-core.js`, donde sus claves están en **texto plano** junto con la **anon key de Viña** → riesgo de seguridad vigente). **Frente de autenticación:** definir/hashear contraseñas reales, quitar `acceso_bloqueado`, reemplazar emails placeholder. **No es deuda estructural** — las filas están bien puestas (nodos/cargo correctos), solo falta activar el login.
- **`persona` ya NO está del todo dormida:** el endpoint de identidad (`identity.ts`, paso B) la lee. Pero la jerarquía/resolución de las **edge functions** aún corre por `asesor_credentials`/`org_usuarios` (no por `persona_id`) — cablear ahí es trabajo de fase posterior.
- **Refinamientos anotados de `identity.ts`** (no urgentes): mover el mapa `empresa→institución` a config; endurecer el match de email con RPC `lower(btrim())`.
- **PK por nombre:** `metas` (PK = `asesor`) e `ingresos` (PK = `asesor`,`mes`) en proxis_dev **no tienen `id`** y aún usan el nombre como clave. Migrar a `persona_id` en su momento.
- **RPC `org_subtree`** desplegada en BD pero **NO versionada en el repo** (mismo patrón de divergencia que `proxis-accion`/`proxis-cerebro`). Extraer su definición y versionarla.
- **Niveles superiores vacíos:** las capas Gerente Zonal/Regional/de Ventas existen pero **sin nodos/personas** (se llenan cuando existan esos cargos). El nodo supervisor tiene `parent_id=null`; un gerente futuro cuelga encima sin rehacer nada.
- **Consorcio sin `metas`/`nodos`/`ingresos`:** equipo reciente; sembrar/esperar actividad en Fase 2.

> ✅ **Resuelto en paso A** (ya no es deuda): los `org_nodos` de Zurich/Consorcio y la conexión del mando (Alejandra/Valeska) a sus nodos — la resolución asesor→supervisor de los equipos reales ya funciona.

### Frentes mayores
- **Anonimización:** los T&C (módulo legal) comprometen anonimizar usuarios al darse de baja. **Aún no en vigor → entra cuando se incorpore la IA a producción.** Existe maquinaria: `anonymized_profiles`, `anonymization_audit_log`. Revisar el flujo antes de que aplique.
- **Autenticación:** login no uniformes, sin recuperar/ver contraseña. Auditar si es Supabase Auth, custom (`asesor_credentials`/`vina_credentials` sugieren custom), o mixto. Proyecto propio.
- **Visión de largo plazo (no diseñar aún, solo dejar puerta abierta vía `instituciones`):** módulo de marketing (generación + publicación automática en redes), contabilidad/facturación/cobros, todo en un dashboard único.
- **RLS:** tablas de Viña con anon key pública hardcodeada en `plataforma-core.js`. No urgente (datos no sensibles, 2 semanas). Se define correctamente sobre el modelo final.
- **`feedback`** sin tenant → verificar si debe ser tenant-aware.

---

*Fin. **Fase 0 + Paso A + Paso B (piloto Mi Informe, capa de datos) VALIDADOS.** El patrón de portado legacy→React (leer de **proxis_dev** por `persona_id`/`institucion_id`, NO de Viña ni por nombre) está probado con datos reales. Próximo paso de ejecución (a decidir al retomar): terminar el **diseño/UI de Mi Informe**, o portar la siguiente pantalla (nodos / tracker / simulador) con el patrón ya validado. Meta: paridad funcional antes de conectar IA (Fase 2) y conmutar la fuente de datos (Fase 3).*
