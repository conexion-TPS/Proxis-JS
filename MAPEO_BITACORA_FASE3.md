# MAPEO_BITACORA_FASE3 — Bitácora Semanal del asesor (legacy → calco)

> **Documento de mapeo exhaustivo en SOLO LECTURA.** Inventario completo de la lógica de la
> Bitácora para clonar en **Fase 3**. No es código portado: es la fuente de verdad del calco.
> Cada pieza se clasifica en 🟢 **visualización** (lectura → portable ahora, inerte) y
> 🔴 **escritura** (Fase 3 → documentar, NO portar todavía). Citas en `archivo:línea`.

---

## ⚠️ 0. REALIDAD: cuál bitácora se usa (no negociable)

**La bitácora en uso real por los asesores de Consorcio es la A (`/plataforma`, `plataforma-core.js`)** — la
versión RICA con reconocedor de nombres, conversión a nodos, ciclo de semanas por fecha y tarjeta de nodos.

**La B (`/vina`, `src/app/vina/page.tsx` + `/api/vina/bitacora`) es una reimplementación SIMPLIFICADA
que NO se usa y NO debe tomarse como fuente del calco.** B carece por completo de nodos, homónimos y
sugerencias; además define "semana activa" con un criterio distinto. Documentarla aquí solo sirve para
contraste; **el calco se hace contra A.**

| | **A — `/plataforma` (FUENTE DEL CALCO)** | **B — `/vina` (NO usar)** |
|---|---|---|
| Front-end | [src/app/plataforma/page.tsx:24](src/app/plataforma/page.tsx#L24) carga `plataforma-core.js` | [src/app/vina/page.tsx](src/app/vina/page.tsx) |
| Lógica | `public/plataforma-core.js` | [src/app/api/vina/bitacora/route.ts](src/app/api/vina/bitacora/route.ts) |
| BD destino | **Viña prod**, hardcoded `uolmsxou…`+anon ([plataforma-core.js:9-10](public/plataforma-core.js#L9); cliente `SB` [:53-90](public/plataforma-core.js#L53)), filtro `empresa` | Viña prod vía `supabaseVina` (service key), `EMPRESA_VINA='consorcio'` |
| Nodos / homónimos / sugerencias | **SÍ** | **NO** |
| `semana_num` | calendario corrido desde `2026-03-30` ([:893-895](public/plataforma-core.js#L893)) | conteo `count+1` ([route.ts:85-94](src/app/api/vina/bitacora/route.ts#L85)) |
| "Editable" | solo si `semana_inicio === getLunes()` (lunes de HOY) ([:817](public/plataforma-core.js#L817)) | la más reciente con `confirmado=false` ([page.tsx:75](src/app/vina/page.tsx#L75)) |
| "Confirmar"/"sin_actividad" | **no existen** (bloqueo temporal + semanas fantasma) | existen como acciones POST |

🔴 **Gap arquitectónico central (Fase 3):** A escribe en **Viña prod** (`uolmsxou…`), pero `/app` lee
**proxis_dev** (`mkqgbmw…`, vía `supabaseAdmin`). Hoy NO hay sincronización viva: los datos de Consorcio
en proxis_dev parecen un **volcado puntual del 2026-06-05** (ver §7). "Conectar el cable" = decidir si la
bitácora del `/app` escribe directo en proxis_dev (por `persona_id`) o si hay sync. Esto es lo que define Fase 3.

> **[Corregido 2026-06-15, verificado contra BD/código]** Confirmado: **NO hay sync automático** Viña→proxis_dev; las copias son **manuales (Management API)**. El `/app` **lee y escribe proxis_dev** por `persona_id` — la bitácora v1/v2 del `/app` ya escribe proxis_dev (`/api/app/bitacora` POST). Viña quedó **read-only** (RLS cerrado + escritura revocada el 06-15). El delta de Zurich de la semana 08-06 está presente en proxis_dev (verificado 06-15, 10 reportes con ids regenerados). La reconciliación del conteo exacto Viña↔proxis_dev (9 vs 12 según criterio de corte) queda pendiente.

---

## 1. Reconocedor de nombres similares (algoritmo exacto) — A

**Primitivas puras** (`plataforma-core.js`):
- **`normNombre(s)`** [:1186-1192](public/plataforma-core.js#L1186): `toLowerCase` → `NFD` + quita diacríticos `[̀-ͯ]` → quita todo lo no `[a-z0-9\s]` → `trim` → colapsa espacios.
- **`levenshtein(a,b)`** [:1195-1201](public/plataforma-core.js#L1195): distancia de edición DP O(m·n).
- **`similitud(a,b)`** [:1204-1217](public/plataforma-core.js#L1204): normaliza; `===`→1; `fullSim=(maxLen−lev)/maxLen`; compara **primer nombre** (`split(' ')[0]`)→`fnSim`; **si `fnSim>0.8`** devuelve `max(fullSim, fullSim*0.7+fnSim*0.3)`, si no `fullSim`.
- **`SIMILITUD_THRESHOLD = 0.70`** [:1219](public/plataforma-core.js#L1219); **`esSimilar`**=`≥0.70` [:1221](public/plataforma-core.js#L1221); **`esMismoExacto`**=`normNombre` iguales [:1222](public/plataforma-core.js#L1222).

**Dónde corre / qué dispara:**
1. 🟡 **Aviso en formulario** `checkDuplicadoEnForm(num)` [:1016-1045](public/plataforma-core.js#L1016): al `blur`, compara contra otras filas con `esSimilar` **o** substring (`startsWith`/`includes`) → "⚠ Posible duplicado". Solo UI, sin BD.
2. 🟢 **Sugerencias/autocompletar** `loadContactHistory` [:1482-1494](public/plataforma-core.js#L1482) (dedup `levenshtein/maxLen<0.15`), `getContactSuggestions` [:1496-1504](public/plataforma-core.js#L1496) (top-6 por `similitud`), `showSug/selSug` [:979-999](public/plataforma-core.js#L979) (al elegir marca `tipo_contacto='reactivacion'`).
3. 🔴 **Detección de homónimos al guardar** (modal) — §4.
4. 🔴 **Conversión a nodo** — §2.

**Clasificación:** primitivas = puras/portables como `lib`, pero su *propósito* es 🔴. Aviso de duplicado y sugerencias (display) = 🟢; solo tienen sentido dentro del formulario editable (que es 🔴).

---

## 2. Conversión contacto→nodo — A 🔴

**`checkYConvertirNodo(asesor,nombre,vinculo,prospectos,semanaInicio)`** [:1105-1183](public/plataforma-core.js#L1105):
1. Si el nombre coincide (`esMismoExacto || esSimilar`) con un **nodo existente** [:1110-1111](public/plataforma-core.js#L1110):
   - sin activación esa semana → `PATCH nodos` (`activaciones+1`, `total_prospectos+=`, `ultima_activacion`) + `POST activaciones_nodo` [:1116-1125](public/plataforma-core.js#L1116);
   - con activación → ajusta por **diferencia** de prospectos (`PATCH activaciones_nodo` + `PATCH nodos`) [:1126-1141](public/plataforma-core.js#L1126). ⇒ `{esNodo:true,esNuevo:false}`.
2. Si aún no es nodo: trae **todos** los `contactos` del asesor [:1146-1147](public/plataforma-core.js#L1146) y busca `esSimilar` en **otra semana** (`!currentRepIds.has(reporte_id)`) [:1152-1155](public/plataforma-core.js#L1152). **Si hay ≥1 ⇒ crea nodo:** `POST nodos` (`activaciones:2`, `total_prospectos=prev+actual`, `fecha_primer_contacto`, `fecha_conversion=semanaInicio`) + `POST activaciones_nodo` [:1157-1176](public/plataforma-core.js#L1157). ⇒ `{esNodo:true,esNuevo:true,numNodo,nombre}`.

⇒ **Regla de negocio:** un contacto se vuelve **nodo** cuando un nombre **similar (≥70%)** aparece en **≥2 semanas distintas**. `activaciones` arranca en **2**.

**Disparo** desde `guardarBorrador` [:1305-1312](public/plataforma-core.js#L1305) solo para `tipo_contacto==='reactivacion'`; si `esNuevo` → `abrirModalNodo` (celebración) [:1069-1073](public/plataforma-core.js#L1069), [:1317](public/plataforma-core.js#L1317).
**Marcado:** ✦ en historial si `tipo_contacto∈{reactivacion,activacion_nodo}` [:845](public/plataforma-core.js#L845); la tarjeta de nodos lee `nodos`/`activaciones_nodo` (§5).
**Limpieza de huérfanos** en `guardarBorrador` [:1292-1303](public/plataforma-core.js#L1292): si un nodo `fecha_conversion=semanaInicio` ya no está en el form → `DELETE activaciones_nodo` + `DELETE nodos`.

Todo §2 es 🔴.

---

## 3. Ciclo de vida de la semana — A (modelo por FECHA)

- Helpers temporales: `getLunes()` [:122-129](public/plataforma-core.js#L122); `getProximoLunesISO()` [:130-137](public/plataforma-core.js#L130); `getProximoLunes()` display es-CL [:1528-1534](public/plataforma-core.js#L1528); `semanaYaExiste()` [:138-140](public/plataforma-core.js#L138); `calcSemanaNum(fecha,'2026-03-30')` [:143-147](public/plataforma-core.js#L143).
- 🔴 **Abrir** `abrirNuevaSemana` [:855-915](public/plataforma-core.js#L855): trae todos los reportes; si `semanaYaExiste(lunesActual)` bloquea ("el próximo el {próximo lunes}"); valida también el próximo lunes; `semanaNum` por calendario desde **`2026-03-30`** [:893-895](public/plataforma-core.js#L893); `POST reportes {confirmado:false}` [:907](public/plataforma-core.js#L907); abre formulario. Hay `MODO_TEST=false` [:861](public/plataforma-core.js#L861).
- 🟢/🔴 **Editable solo HOY:** `renderReporteLista` [:817](public/plataforma-core.js#L817) `esEditable=(fecha===getLunes() && !esFantasma)`; pasadas → "🔒 Semana cerrada" [:834](public/plataforma-core.js#L834). **No hay "confirmar"**: el cierre es **temporal**.
- 🟢 **Semanas fantasma:** lunes pasados sin reporte → "⚠ Sin reporte" [:786-830](public/plataforma-core.js#L786) (mismo concepto que [informe.ts:26](src/lib/informe.ts#L26)).
- 🔴 `editarReporte` [:917-923](public/plataforma-core.js#L917) recalcula `semana_num` con `calcSemanaNum`.

El **display** (historial, totales, badges, fantasmas) = 🟢. Apertura/bloqueo/escritura = 🔴. Los gates temporales son helpers puros pero su efecto es 🔴.

---

## 4. Acciones de escritura — A

- 🔴 **Guardar** `guardarBorrador(rid)` [:1223-1327](public/plataforma-core.js#L1223): `leerForm` [:1047-1064](public/plataforma-core.js#L1047) → detección de homónimos por historial en **otra** semana → **modal** `abrirModalHomonimo` [:1079-1087](public/plataforma-core.js#L1079) (mismo⇒nombre canónico + `tipo_contacto='reactivacion'`; distinto⇒`prompt` identificador [:1092-1102](public/plataforma-core.js#L1092)) → **dedup intra-semana** (`esSimilar`/substring) [:1269-1284](public/plataforma-core.js#L1269) → `DELETE contactos` + `INSERT` uno por uno con `empresa` [:1287-1290](public/plataforma-core.js#L1287) → limpieza huérfanos (§2) → `checkYConvertirNodo` por reactivación (§2) → `abrirModalNodo` + refresh + `showProximoLunesBanner` [:1535-1547](public/plataforma-core.js#L1535).
- 🔴 **Abrir semana** = `abrirNuevaSemana` (§3).
- 🔴 **Eliminar contacto** `eliminarContacto` [:1746-1755](public/plataforma-core.js#L1746) (`DELETE contactos`).
- 🔴 **Activar nodo** `registrarActivacion` [:1667-1703](public/plataforma-core.js#L1667): `PATCH nodos` + `POST activaciones_nodo` + **además** `POST contactos {tipo_contacto:'activacion_nodo'}` en la semana actual.
- 🔴 **Eliminar nodo** `eliminarNodo` [:1706-1744](public/plataforma-core.js#L1706): borra activaciones+nodo, resetea `tipo_contacto` de contactos similares, borra del reporte actual.
- **NO existen en A:** `confirmar` ni `sin_actividad` (sí en B, que no se usa).

Formulario (UI de edición): `mostrarFormulario` [:925-951](public/plataforma-core.js#L925), `filaHtml` [:953-978](public/plataforma-core.js#L953), `agregarFila`/`eliminarFila`/`toggleChk` [:1006-1014](public/plataforma-core.js#L1006). Son la cara de escritura ⇒ 🔴.

---

## 5. Tarjeta superior de Nodos (`renderNodosPanel`) — A

🟢 **Render (lectura):** [:1550-1631](public/plataforma-core.js#L1550). Sin nodos → "🌱 aún no tienes nodos" [:1562-1574](public/plataforma-core.js#L1562). Con nodos → "✦ Mis Nodos Activos — N" + grid (`nombre`, `activaciones`, `total_prospectos`, `fecha_conversion`, `vinculo`, estado 🌳/🌿) + gráfico tendencia (acumulado/mes desde `activaciones_nodo` [:1634-1664](public/plataforma-core.js#L1634)). Fuentes: `getNodos` [:1506-1513](public/plataforma-core.js#L1506), `getActivacionesSemana` [:1514-1523](public/plataforma-core.js#L1514), `semanaRef`=reporte más reciente o `getLunes()` [:1556-1560](public/plataforma-core.js#L1556).

🔴 **Botones:** "+ Activar esta semana" → `registrarActivacion` (§4); 🗑 → `eliminarNodo` (§4).

La misma tarjeta de Mi Informe ("Nodos activos") **ya está portada read-only** en [informe.ts:155-208](src/lib/informe.ts#L155) + `MiInforme.tsx` (vía `getNodos`+`getNodosChartData` [:572-740](public/plataforma-core.js#L572)).

---

## 6. Estado de portabilidad a `/app`

- **NO existe bitácora del asesor en `/app` para ningún tenant.** Bajo `src/app/app/` solo hay `simulador` (Zurich), `simulador-consorcio`, `informe`, `tracker-consorcio`.
- [src/app/app/informe/page.tsx:231](src/app/app/informe/page.tsx#L231): la pestaña "Bitácora Semanal" es un **placeholder inerte** (los `.tab` no conmutan).
- `/vina` (B) no está bajo `/app` ni integrada al app-shell; es ruta top-level autónoma y **no es la fuente**.
- Ninguna lógica rica (nodos/homónimos/sugerencias) está portada a React. `informe.ts` solo **lee** `nodos`/`activaciones_nodo` para la tarjeta de Mi Informe.

---

## 7. Esquema resuelto (consultas read-only, 2026-06-10)

**proxis_dev** (ref `mkqgbmwmvypcjzlxidsm`, lo que lee `/app`) — columnas reales:
- `reportes`: `id, asesor, semana_inicio, semana_num, confirmado, created_at, persona_id, institucion_id, sin_actividad` — **tiene `persona_id` Y `asesor`**.
- `contactos`: `id, reporte_id, asesor, nombre, vinculo, tipo_contacto, llamo, reunion, prospectos, created_at, persona_id, institucion_id` — ✅ **tiene `nombre`, `tipo_contacto`, `created_at`**.
- `nodos`: `id, asesor, nombre, vinculo, fecha_primer_contacto, fecha_conversion, activaciones, total_prospectos, ultima_activacion, created_at, persona_id, institucion_id`.
- `activaciones_nodo`: `id, nodo_id, asesor, semana_inicio, prospectos, created_at, persona_id, institucion_id`.
- ⇒ Las 4 tablas en proxis_dev cargan **ambos** modelos: legacy (`asesor`) + nuevo (`persona_id`+`institucion_id`). El `/app` filtra por `persona_id`.

**Viña prod** (ref `uolmsxoudvkopscxbvij`, donde escribe A) — `nodos` usa `asesor` + `empresa` (**sin** `persona_id`/`institucion_id`).

**Datos de Consorcio (institucion `c05f3883-827d-4ab8-a0b8-4dba6424fcac`):**

| Tabla | proxis_dev (Consorcio) | Viña prod (`empresa=consorcio`) |
|---|---|---|
| reportes | 6 (todos semana 1, `2026-06-01`, `confirmado=false`) | 6 (idénticos) |
| contactos | sí (`tipo_contacto='nuevo'`) | 48 |
| **nodos** | **0** | **0** |
| **activaciones_nodo** | **0** | **0** |

**¿De dónde salieron los nodos de Consorcio que lee `/app/informe`?** → **De ningún lado: Consorcio tiene 0
nodos en ambas BD.** No es un bug: los 6 asesores solo tienen **la semana 1 (2026-06-01)** registrada con
contactos `'nuevo'`, y la regla §2 exige un nombre repetido en **≥2 semanas distintas** → con una sola
semana es **imposible** que existan nodos aún. El panel de nodos del `/app` para Consorcio mostrará el estado
vacío ("aún no tienes nodos"). Los **30 nodos / 38 activaciones** que existen en proxis_dev son de **otra
institución** (`16726d00-78ef-4885-9218-02c649244084`; p. ej. Verónica Castillo, Marcela Jara), no de Consorcio.

**Roster Consorcio en proxis_dev:** 6 asesores (Angela Castillo Guzmán, Carla Ortiz Concha, Ignacio Hidalgo
Lazcano, Jaime Caro Navarro, Paula Domínguez, Rocío Concha Silva) + Valeska Comparini Cruells (`mando`).

**Qué se puede mostrar HOY en la UI inerte del `/app` (leyendo proxis_dev por `persona_id`):**
1. 🟢 Historial de semanas (hoy: 1 semana por asesor) con su tabla de contactos (`nombre`, `vinculo`, `llamo`, `reunion`, `prospectos`, ✦ por `tipo_contacto`).
2. 🟢 Determinación "semana activa/cerrada/fantasma" por fecha (display).
3. 🟢 Tarjeta de nodos → **estado vacío** para Consorcio (0 nodos), con su gráfico vacío.
4. 🔴 Todo lo demás (abrir/guardar/activar/eliminar, homónimos, conversión) queda documentado para Fase 3.

---

## 8. PENDIENTE (no determinable en read-only)
1. **Mecanismo de sync Viña prod → proxis_dev.** Los 6 reportes / 48 contactos de Consorcio aparecen
   espejados en ambas BD (volcado aparente del 2026-06-05). No se determina si fue migración puntual o si
   hay sync vivo. Crítico para Fase 3 ("conectar el cable"). **[Corregido 2026-06-15: RESUELTO — no hay sync vivo; es copia MANUAL puntual por Management API. Ver el bloque corregido del Gap arquitectónico arriba.]**
2. **Cómo llegaron a proxis_dev los nodos de la institución `16726d00`** (30 nodos con `persona_id` nativo):
   sugiere que **algún** tenant escribe nodos directo en proxis_dev (¿bitácora distinta / IMR?). Fuera de
   alcance de Consorcio, pero relevante como precedente del modelo de escritura nativo.
3. Reglas de RLS / claves usadas por cada vía de escritura en producción (no inspeccionado). **[Corregido 2026-06-15: inspeccionado — Viña RLS cerrado + INSERT/UPDATE/DELETE revocado (lectura-sólo).]**

## 9. Ambigüedades marcadas (no asumidas)
- §0: A vs B — **RESUELTO por TPS: la fuente del calco es A.** B no se usa.
- §3 vs B: criterios de "semana activa" incompatibles (fecha-de-hoy en A vs `confirmado` en B). El calco sigue **A (fecha)**.
- §4/§5: `registrarActivacion` **duplica** el aporte en `contactos` (inserta una fila `activacion_nodo` además de la activación). Confirmar si es comportamiento deseado al clonar en Fase 3.
- §0: `semana_num` calendario (A) vs conteo (B) — el calco sigue **A (calendario desde `2026-03-30`)**.

---

_Generado en read-only el 2026-06-10. No se portó ni modificó código de la bitácora. No se tocó `/plataforma`, `/vina` ni `/api/vina/bitacora`._
