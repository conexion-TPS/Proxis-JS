# Ajustes de la Bitácora v2 — NODOS server-side (sub-lote v2a)

> **Divergencias intencionales del legacy, aprobadas por TPS.** El calco de la maquinaria de
> nodos/homónimos (`plataforma-core.js`, versión A) es **absoluto** salvo las 3 divergencias de
> abajo. El legacy `/plataforma` **NO se toca**: esto vive en proxis_dev (RPC `guardar_contactos_v2`)
> + el endpoint React `/api/app/bitacora`. Fuente: TPS. Fecha: 2026-06-12.
>
> Documentación del comportamiento legacy calcado: ver la **Especificación v2** (secciones §1-§4).
> SQL versionado: `db/migrations/2026-06-12_guardar_contactos_v2.sql`.

---

## Divergencias aprobadas

### B1 — `fecha_primer_contacto` = MIN(created_at) de las apariciones previas
**Legacy:** usaba `prevOtherWeek[0].created_at` (el primero que devolvía la BD, **sin orden** →
arbitrario; quirk §3b).
**v2:** se ordena por `created_at asc` y se toma la aparición **más antigua** → `fecha_primer_contacto`
refleja el verdadero primer contacto.
**Porqué:** el campo significa "primer contacto"; el `[0]` arbitrario podía fechar mal el nodo.
**Nota:** `total_prospectos` se sigue calculando con **una sola** aparición previa (quirk calcado,
ver abajo); v2 usa la prospectos de **esa misma** aparición más antigua (determinista), no de un `[0]` al azar.

### B2 — El reinsert conserva `created_at` de los contactos que ya existían
**Legacy:** `delete-all + reinsert` regeneraba `created_at` de **todos** los contactos en cada guardado
(quirk §5: hacía derivar `fecha_primer_contacto` entre re-guardados).
**v2:** antes de borrar, se toma un snapshot `norm(nombre) → MIN(created_at)` del reporte; al reinsertar,
un contacto cuyo nombre normalizado **ya existía** conserva su `created_at`; solo los **realmente nuevos**
llevan `now()`. Match por `app_norm_nombre` dentro del **mismo** reporte.
**Porqué:** estabilidad de `fecha_primer_contacto` y del historial ante re-guardados de la misma semana.

### B3 — (sub-lote v2b, cliente) El flujo "distinto" del modal aplicará el identificador a la fila
**Legacy:** la rama "distinto" del modal de homónimo hacía `prompt(...)` y escribía en `fn-${filaNum}`,
pero en el flujo de guardado `filaNum` se pasaba como **`null`** → `getElementById('fn-null')` no existe →
el identificador **no se aplicaba a nada** (quirk grave §2b: la rama "distinto" era un no-op).
**v2 (v2b):** el calco React aplicará el identificador a la **fila correspondiente** (el contacto se guarda
con el nombre distinguido, p.ej. `"Juan (amigo de Carlos)"`).
**Porqué:** la función de distinguir homónimos estaba rota en el legacy; es la intención real del diseño.
**Estado:** se implementa en v2b (UI). Aquí solo se registra.

### B4 — Lock por fecha (lote 13-jun)
Solo la semana **en curso** es editable; las semanas pasadas quedan **read-only ignorando `confirmado`**;
se elimina la acción/botón **Confirmar**. Divergencia deliberada del calco (el legacy A permite editar
semanas pasadas no confirmadas), aprobada por TPS el **13-jun**. La "semana en curso" la fija el
**servidor** (`lunesActualChile()`, expuesto en el DTO como `semana_actual`); el gate vive en la RPC
(`semana_inicio <> p_semana_actual → 409`) y en el endpoint (`eliminar_contacto`/`sin_actividad`).
La columna `confirmado` **se conserva** (la usa el legacy `/vina`), **inerte en `/app`**.
**Estado:** implementado (RPC `2026-06-13_lock_por_fecha.sql` + endpoint + UI).

---

## Nota de calco — `normNombre` en SQL (`app_norm_nombre`)

`normNombre` se replicó en SQL vía **`translate()`** sobre el set latino-español
(`á à â ä ã é è ê ë í ì î ï ó ò ô ö õ ú ù û ü ñ ç` + mayúsculas vía `lower()` previo), luego strip
`[^a-z0-9 espacio]`, collapse de espacios y trim. **Byte-idéntico al JS** (`lower → NFD → strip
combinantes → strip → trim → collapse`) para todo nombre español/latino — el universo real de los contactos.

**Residual exótico (anotado, fuera del set):** para letras precompuestas de Latin-Extended **fuera** del
set (p.ej. `ā ł đ`, o letras como `ø` que el NFD del JS **no** descompone), puede haber una diferencia de
±1 carácter respecto del JS. **No aplica a los datos** (nombres chilenos en español). Se rechazaron
`unaccent` (diverge más: `ø→o` en vez de descartarse) y una columna `nombre_norm` (cambia el esquema).
`levenshtein` y `similitud` se replicaron en plpgsql **sin extensiones** (DP puro), idénticos al JS
salvo el tipo numérico (`numeric` vs `float64`), diferencia inocua salvo en bordes exactos del umbral 0.70.

---

## Quirks del legacy CALCADOS (no corregidos) — revisar en Fase 2

Se conservan idénticos al legacy; quedan anotados para que TPS decida en Fase 2 si corregir:

| # | Quirk | Dónde | Anotación Fase 2 |
|---|---|---|---|
| Q1 | Umbral de similitud `0.70` fijo | `app_es_similar` | ¿valor correcto? |
| Q2 | `similitud` con **boost de primer nombre** (`fnSim>0.8` → `max(full, full·0.7+fn·0.3)`) | `app_similitud` | favorece coincidencia de primer nombre; ¿deseado? |
| Q3 | `normNombre` borra puntuación **sin espacio** (`"Pérez-García"`→`"perezgarcia"`) | `app_norm_nombre` | calco exacto |
| Q4 | Condición de conversión = reaparición `esSimilar` en **≥1 semana previa** | RPC §3 | umbral de 2 apariciones |
| Q5 | `activaciones = 2` **fijo** al convertir | RPC §3 | asume exactamente 2 apariciones |
| Q6 | `total_prospectos` = prospectos de **UNA** aparición previa + actuales (no suma todas) | RPC §3 | subconteo si apareció en 3+ semanas |
| Q7 | Reactivación **idempotente por semana** (check `nodo_id+semana_inicio`, update por diff) | RPC §3 | calco exacto |
| Q8 | Limpieza solo de nodos con `fecha_conversion = semana actual` (activaciones primero por FK), **sin confirmación** | RPC §4 | nodos de semanas previas nunca se limpian aquí |
| Q9 | Celebración solo del **primer** nodo nuevo (`nodos_nuevos[0]`) | cliente (v2b) | si convierten varios, el resto no se festeja |

**Placement (no es divergencia):** el dedup **intra-form** (§2c) y el **modal de homónimo** (§2) son la
capa **interactiva** → van en **v2b (cliente)**, no en la RPC. La RPC recibe el `contactos[]` ya resuelto
por el cliente y **re-deriva la reactivación server-side** (el flag del cliente es intención; el server decide
comparando contra historial y nodos frescos).

---

## Sub-lote v2b — capa cliente (`BitacoraSemanal.tsx`)

Implementa §1-§2 + autocomplete + celebración. Helpers de similitud (`normNombre`/`levenshtein`/
`similitud`/`esSimilar`) **portados casi literal** del JS legacy → mismos resultados.

- **B3 aplicada:** la rama "distinto" del modal aplica el identificador a la **fila correspondiente**
  (el bug `filaNum=null` del legacy **no** se calca). Tipo queda `'nuevo'`.
- **Nota — autocomplete con datos frescos:** `getContactSuggestions` se calca, pero alimentado por
  los datos del **GET** (`/api/app/bitacora`, mes actual + previo) en vez del cache `_contactHistory`
  del legacy. El cache desactualizado del legacy es **quirk de implementación, no de comportamiento**
  → no es divergencia numerada. (Se dedup por nombre normalizado para no repetir el mismo contacto.)
- **Nota — ventana del modal:** la detección de homónimo del **cliente** usa el historial cargado por
  el GET (2 meses). Es solo UX: la **RPC re-deriva contra el historial completo** y es la fuente de
  verdad de la conversión, así que un match fuera de la ventana igual se resuelve server-side.
- **Sin cliente Supabase browser nuevo:** toda la data viene del `dto` del GET existente.
