# PROXIS — Diseño de Consolidación
### Fuente de verdad del modelo de datos y plan de fases

> **Última actualización:** tras ejecutar Fase 0, paso 0.1 (origen Viña ordenado).
> Este documento reemplaza las partes desactualizadas del HANDOFF.

---

## ⏱️ ESTADO ACTUAL (leer primero)

| Hito | Estado |
|---|---|
| Migración Gemini → Groq/OpenRouter | ✅ **Completa** (6 edge functions + capa Next.js, verificada en producción) |
| Fase 0 · 0.0 Respaldo de Viña | ✅ **Ejecutado** |
| Fase 0 · 0.1 Ordenar origen (Viña) | ✅ **Ejecutado y verificado** |
| **Próximo paso** | **0.2 — limpiar `proxis_dev`** (toca el OTRO proyecto) |

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
- `empresa='zurich'` → institución **Zurich** (equipo Alejandra Espinoza)
- `empresa='vina'` → institución **Consorcio** (equipo Valeska Comparini) → **ya reclasificado a `consorcio` en 0.1**
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

**Solución (decidida):** identificador `persona_id` / `asesor_id` (**uuid**) propio, inmutable. El nombre pasa a ser atributo. Cubre a TODOS (asesores + mando, por el caso Roberto Matta/Valeska). Hacerlo en Fase 0 mientras los datos son pocos y sin colisiones.

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

---

### Pasos pendientes de Fase 0

| Paso | Proyecto | Acción | Estado |
|---|---|---|---|
| 0.2 | **proxis_dev** | Borrar institución duplicada muerta "IMR Brasil" (`67a7287b…`, 0 nodos/capas/usuarios) + 3 "Asesor Test Uno/Dos/Tres" (huérfanos seed) | ⬜ siguiente |
| 0.3 | proxis_dev | Crear tabla `persona` (uuid); agregar `institucion_id`+`persona_id` a grupo B; crear instituciones Zurich y Consorcio | ⬜ |
| 0.4 | lee Viña → escribe proxis_dev | Copia en espejo con tenant e ids resueltos | ⬜ |
| 0.5 | (comparación) | Verificación de consistencia fila por fila | ⬜ |
| 0.6 | — | Punto de control: datos consolidados y verificados, conviviendo con Viña. **Nada conmutado.** | ⬜ |

> ⚠️ **A partir del 0.2 se trabaja en `proxis_dev` (mkqgbmwm), NO en Viña.** Verificar SIEMPRE el nombre del proyecto arriba en Supabase antes de ejecutar.

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
- **Anonimización:** los T&C (módulo legal) comprometen anonimizar usuarios al darse de baja. **Aún no en vigor → entra cuando se incorpore la IA a producción.** Existe maquinaria: `anonymized_profiles`, `anonymization_audit_log`. Revisar el flujo antes de que aplique.
- **Autenticación:** login no uniformes, sin recuperar/ver contraseña. Auditar si es Supabase Auth, custom (`asesor_credentials`/`vina_credentials` sugieren custom), o mixto. Proyecto propio.
- **Visión de largo plazo (no diseñar aún, solo dejar puerta abierta vía `instituciones`):** módulo de marketing (generación + publicación automática en redes), contabilidad/facturación/cobros, todo en un dashboard único.
- **RLS:** tablas de Viña con anon key pública hardcodeada en `plataforma-core.js`. No urgente (datos no sensibles, 2 semanas). Se define correctamente sobre el modelo final.
- **`feedback`** sin tenant → verificar si debe ser tenant-aware.

---

*Fin. Próximo paso de ejecución: Fase 0, paso 0.2 — limpiar `proxis_dev` (institución duplicada + Asesor Test). Recordar: ese paso toca el OTRO proyecto.*
