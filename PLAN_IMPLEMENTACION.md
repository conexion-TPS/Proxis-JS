# Proxis IA Coach — Plan de Implementación Completo

**Versión:** 1.0  
**Fecha:** 2026-05-23  
**Estado:** En desarrollo

---

## Visión general

Transformar el sistema actual (admin HTML estático + Edge Function básica) en una plataforma de coaching comercial por IA de nivel profesional, compuesta por:

1. **Panel admin Next.js** — gestión completa del sistema por parte del coach
2. **Plataforma del asesor Next.js** — interfaz web para reportes y métricas
3. **Motor de IA** — perfilamiento longitudinal, hipótesis, conocimiento autónomo
4. **Sailor App** — aplicación móvil iOS/Android de mensajería y coaching

---

## Estado actual del sistema

### Operativo
- Admin HTML estático (`admin/*.html`) conectado a Supabase proxis_dev
- Edge Function `proxis-monitor` (cron + trigger evaluation)
- Plataforma asesor en Next.js (`/plataforma`)
- Tablas: metas, reportes, contactos, ingresos, activaciones_nodo, trigger_config, config, prompts, message_log, asesor_emails, knowledge_base, asesor_perfil

### Pendiente de deploy
- Cambio de inyección de perfil en Edge Function (ya pusheado a GitHub)

---

## Arquitectura de entornos

```
desarrollo local  →  .env.local  →  Supabase proxis_dev
producción        →  Vercel env  →  Supabase proxis_prod
```

Las credenciales (Supabase, Gemini, Resend) se pasan como variables de entorno. El código es idéntico en ambos entornos.

---

## FASE 0 — Fundación Next.js Admin

**Objetivo:** Preparar la base sobre la cual se construyen todos los módulos.

### 0.1 Estructura de rutas
```
src/app/
  admin/
    layout.tsx          ← layout con sidebar + header + auth guard
    page.tsx            ← dashboard (redirect a /admin/dashboard)
    dashboard/page.tsx
    prompts/page.tsx
    triggers/page.tsx
    review/page.tsx
    knowledge/page.tsx
    perfil/page.tsx
    analytics/page.tsx
    hipotesis/page.tsx  ← nuevo
    conocimiento/page.tsx ← nuevo
    cuestionarios/page.tsx ← nuevo
    senales/page.tsx    ← nuevo
```

### 0.2 Variables de entorno
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_KEY
RESEND_KEY
```

### 0.3 Librerías compartidas
```
src/lib/
  supabase.ts      ← cliente Supabase (reemplaza SBC de _core.js)
  gemini.ts        ← callGemini()
  resend.ts        ← sendEmail()
  context.ts       ← buildContext() para cada asesor
  templates.ts     ← compileTemplate()
```

### 0.4 Componentes base reutilizables
```
src/components/admin/
  Layout.tsx       ← sidebar + header
  Table.tsx        ← tabla genérica con sort/filter
  Toast.tsx        ← notificaciones
  Modal.tsx        ← diálogos de confirmación
  Badge.tsx        ← estados (activo, pendiente, etc.)
  ConfidenceBar.tsx ← barra de confianza 0-100
  DimensionCard.tsx ← tarjeta de dimensión de perfil
```

### 0.5 Autenticación admin
- Fase inicial: `localStorage` con rol admin (igual que HTML actual)
- Fase posterior: Supabase Auth con RLS

**Entregables Fase 0:** Layout funcional con sidebar, auth guard, y cliente Supabase operativo.

---

## FASE 1 — Migración del admin HTML a Next.js

**Objetivo:** Replicar funcionalidad existente en Next.js. Sin features nuevas.

### Módulos a migrar (en orden)

#### 1.1 Dashboard (`/admin/dashboard`)
- Cards de navegación a todos los módulos
- Status de APIs (Gemini, Resend, Supabase)
- Métricas rápidas: mensajes enviados esta semana, asesores activos

#### 1.2 Prompts (`/admin/prompts`)
- Lista de prompts por trigger con versión activa
- Editor con preview en vivo (compilar template con asesor real)
- Versionado — activar/desactivar versiones
- Selector de asesor para preview

#### 1.3 Triggers (`/admin/triggers`)
- Tabla editable: trigger_id, descripción, cooldown, umbral, asunto, activo
- Configuración global de remitente
- Toggle activo/inactivo por trigger

#### 1.4 Revisión de mensajes (`/admin/review`)
- Lista de mensajes enviados con filtros (asesor, trigger, fecha)
- Vista detalle: prompt usado, respuesta generada
- Feedback 👍/👎 + reescritura manual
- Historial de feedback por trigger

#### 1.5 Base de conocimiento (`/admin/knowledge`)
- Carga de texto plano o `.txt`
- Lista de entradas con categoría y fecha
- Edición y eliminación

#### 1.6 Perfil de asesores (`/admin/perfil`)
- Selector de asesor
- 6 dimensiones ontológicas (textareas)
- Scores psicométricos (assertividad, sociabilidad)
- Chat de calibración con Gemini
- Generación de resumen IA
- Status del perfil (nuevo / guardado / confianza %)

#### 1.7 Analytics (`/admin/analytics`)
- Tasa de mensajes enviados por trigger
- Feedback positivo/negativo por trigger y asesor
- Asesores con más mensajes sin respuesta
- Evolución temporal de métricas

**Entregables Fase 1:** Admin completamente funcional en Next.js, paridad con HTML actual.

---

## FASE 2 — Infraestructura de datos nueva

**Objetivo:** Crear las tablas que sostienen el sistema de perfilamiento avanzado.

### 2.1 Nuevas tablas Supabase

```sql
-- Señales de comportamiento
CREATE TABLE behavioral_signals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor           text NOT NULL,
  fuente           text NOT NULL, -- 'plataforma'|'email'|'sailor'|'cuestionario'
  tipo             text NOT NULL,
  valor            text,
  dimension_target text,
  perfil_hint      text,
  confianza_hint   int,
  procesada        bool DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

-- Hipótesis generadas por la IA
CREATE TABLE deductions_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor           text NOT NULL,
  dimension        text,
  hipotesis        text NOT NULL,
  confianza        int,
  senales_usadas   uuid[],
  estado           text DEFAULT 'pendiente', -- 'pendiente'|'validada'|'rechazada'|'editada'
  correccion       text,
  reviewed_by      text,
  created_at       timestamptz DEFAULT now(),
  reviewed_at      timestamptz
);

-- Vacíos de conocimiento
CREATE TABLE knowledge_gaps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria        text,
  descripcion      text NOT NULL,
  perfil_afectado  text,
  asesor_afectado  text,
  prioridad        int DEFAULT 3,
  estado           text DEFAULT 'pendiente', -- 'pendiente'|'en_investigacion'|'cubierto'
  created_at       timestamptz DEFAULT now()
);

-- Base de conocimiento conductual estructurada
CREATE TABLE knowledge_base_conductual (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil            text, -- 'Energético'|'Sociable'|'Relacional'|'Reflexivo'|'Integrador'|'General'
  categoria         text, -- 'fortaleza'|'debilidad'|'tactica_cliente'|'ciclo_7pasos'|
                          -- 'backup_style'|'colision_espejo'|'diagnostico_perceptual'|
                          -- 'cierre'|'pregunta_interna'|'sales_dna'|'ruta_desarrollo'
  etapa_ciclo       text, -- si categoria='ciclo_7pasos'
  contexto          text,
  contenido         text NOT NULL,
  regla_inferencia  text,
  accion_correctiva text,
  fuente            text,
  completitud       int DEFAULT 50,
  created_at        timestamptz DEFAULT now()
);

-- Propuestas de conocimiento adquirido autónomamente
CREATE TABLE knowledge_proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id           uuid REFERENCES knowledge_gaps(id),
  metodo           text, -- 'deduccion_interna'|'busqueda_externa'
  fuente           text,
  contenido        text NOT NULL,
  razonamiento     text,
  confianza        int,
  estado           text DEFAULT 'pendiente',
  correccion       text,
  reviewed_by      text,
  created_at       timestamptz DEFAULT now(),
  reviewed_at      timestamptz
);

-- Cuestionarios y preguntas
CREATE TABLE cuestionarios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL,
  tipo             text, -- 'psicometrico'|'micro'|'contextual'|'onboarding'
  descripcion      text,
  activo           bool DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE preguntas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuestionario_id  uuid REFERENCES cuestionarios(id),
  orden            int,
  texto            text NOT NULL,
  tipo_respuesta   text, -- 'escala_4'|'abierta'|'alternativas'|'si_no'
  opciones         jsonb, -- para tipo alternativas
  dimension_target text, -- dimensión de perfil que mide
  perfil_hint      text, -- perfil que sugiere si se responde de cierta forma
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE respuestas_cuestionario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor           text NOT NULL,
  cuestionario_id  uuid REFERENCES cuestionarios(id),
  pregunta_id      uuid REFERENCES preguntas(id),
  respuesta        text,
  contexto         text, -- situación en que se capturó
  created_at       timestamptz DEFAULT now()
);
```

### 2.2 Alteraciones a `asesor_perfil`

```sql
ALTER TABLE asesor_perfil
  ADD COLUMN assertividad_score    float,
  ADD COLUMN sociabilidad_score    float,
  ADD COLUMN perfil_dominante      text,
  ADD COLUMN backup_style_doc      text,
  ADD COLUMN cuello_botella_etapa  text,
  ADD COLUMN progresion_integrador int DEFAULT 0;
```

**Entregables Fase 2:** Todas las tablas creadas en proxis_dev. Scripts SQL versionados en `/supabase/migrations/`.

---

## FASE 3 — Módulos admin nuevos

### 3.1 Panel de hipótesis (`/admin/hipotesis`)

**Sección A — Hipótesis pendientes:**
- Lista ordenada por confianza descendente
- Por cada hipótesis: asesor, dimensión, texto, confianza (barra visual), señales usadas, fecha
- Botones: Validar / Rechazar / Editar y validar
- Al validar → actualiza `asesor_perfil` automáticamente

**Sección B — Historial:**
- Hipótesis pasadas con resultado (validada/rechazada/editada)
- Filtros por asesor, dimensión, período

**Sección C — Propuestas de conocimiento:**
- Conocimiento adquirido autónomamente pendiente de aprobación
- Fuente, razonamiento, confianza
- Aprobar → va a `knowledge_base_conductual`
- Rechazar → feedback para el motor

**Sección D — Vacíos de conocimiento:**
- Lista de knowledge_gaps por prioridad
- Estado: pendiente / en investigación / cubierto
- Botón "Investigar" → dispara motor de búsqueda autónoma

### 3.2 Conocimiento conductual (`/admin/conocimiento`)

Interface estructurada para poblar `knowledge_base_conductual`:
- Filtros por perfil y categoría
- Tabla de entradas con completitud visual
- Editor para agregar/editar entradas
- Vista de completitud global por perfil (qué tan lleno está cada cuadrante del FODA)
- Importar desde documentos `.txt`

### 3.3 Cuestionarios (`/admin/cuestionarios`)

**Diseñador de cuestionarios:**
- Crear cuestionario con nombre, tipo, descripción
- Agregar/reordenar preguntas
- Por pregunta: texto, tipo de respuesta, dimensión que mide, perfil hint
- Preview del cuestionario como lo verá el asesor

**Banco de preguntas:**
- Biblioteca de preguntas reutilizables
- Organizadas por dimensión del perfil y tipo de captura

**Respuestas:**
- Ver respuestas por asesor y cuestionario
- Señales generadas automáticamente desde cada respuesta

### 3.4 Señales de comportamiento (`/admin/senales`)

- Vista de `behavioral_signals` por asesor
- Timeline de señales con tipo, fuente y valor
- Señales procesadas vs. pendientes
- Filtros por fuente (plataforma, email, sailor, cuestionario)
- Mapa de cobertura de dimensiones por asesor (qué dimensiones tienen más/menos señales)

**Entregables Fase 3:** Cuatro módulos admin nuevos operativos.

---

## FASE 4 — Motor de análisis y perfilamiento

### 4.1 Edge Function: `proxis-analyzer`

Cron separado de `proxis-monitor`. Frecuencia: semanal (domingo 22:00 UTC).

**Proceso:**
```
Para cada asesor:
  1. Recuperar behavioral_signals no procesadas
  2. Recuperar asesor_perfil actual
  3. Recuperar knowledge_base_conductual relevante
  4. Enviar a Gemini con prompt analítico estructurado
  5. Gemini devuelve JSON:
     {
       hipotesis: [{ dimension, texto, confianza, senales_ids }],
       gaps_detectados: [{ categoria, descripcion, prioridad }],
       progresion_integrador: int
     }
  6. Guardar hipótesis en deductions_log (estado: 'pendiente')
  7. Guardar gaps en knowledge_gaps
  8. Actualizar progresion_integrador en asesor_perfil
  9. Marcar señales como procesadas
```

### 4.2 Edge Function: `proxis-researcher`

Disparada manualmente desde admin (botón "Investigar" en knowledge_gaps).

**Proceso:**
```
Para cada gap en estado 'pendiente' con prioridad >= 4:
  1. Construir query de búsqueda desde la descripción del gap
  2. Opción A: Analizar behavioral_signals y deductions_log existentes
              buscando patrones que cubran el gap (deducción interna)
  3. Opción B: Búsqueda externa via Gemini con grounding
  4. Estructurar hallazgo como knowledge_proposal
  5. Guardar en knowledge_proposals (estado: 'pendiente')
  6. Actualizar gap a estado: 'en_investigacion'
  7. Notificar al admin
```

### 4.3 Lógica de selección de captura (inmanencia)

Función que decide si aflora una captura y en qué formato. Se invoca:
- Al final de cada mensaje generado por `proxis-monitor`
- Al recibir una respuesta de Sailor App

```typescript
function decidirCaptura(asesor: string, ctx: Context): CapturaDecision {
  // Analizar dimensiones con baja confianza
  // Considerar última captura (no saturar)
  // Considerar evento significativo de la semana
  // Seleccionar formato apropiado
  // Retornar: { capturar: bool, formato: string, dimension: string, pregunta: string }
}
```

**Entregables Fase 4:** Dos Edge Functions operativas + lógica de captura inmanente.

---

## FASE 5 — Captura de señales en plataforma web

**Objetivo:** Instrumentar la plataforma del asesor (`/plataforma`) con puntos de captura sutiles e imprevisibles.

### 5.1 Puntos de captura en `/plataforma`

| Momento | Tipo de captura | Frecuencia |
|---|---|---|
| Al enviar un reporte | 1 pregunta contextual | Ocasional (~30% de veces) |
| Al iniciar sesión | Micro-cuestionario (2-3 preguntas) | Raramente (~10%) |
| Debajo de un indicador inusual | Pregunta sobre ese dato específico | Cuando métrica es outlier |
| Al ver resultados del mes | Pregunta reflexiva | 1 vez/mes |

### 5.2 API endpoint de señales

```
POST /api/signals
Body: { asesor, fuente, tipo, valor, dimension_target }
```

Usado por plataforma web, emails y Sailor App.

### 5.3 Captura vía email

En `proxis-monitor`, después de generar el mensaje:
- Invocar `decidirCaptura()`
- Si corresponde, agregar pregunta al final del email
- Registrar que se envió esa pregunta (para no repetir pronto)
- Las respuestas por email se procesan manualmente o via webhook de Resend

**Entregables Fase 5:** Plataforma web instrumentada con captura inmanente.

---

## FASE 6 — Sistema de cuestionarios

### 6.1 Cuestionario de onboarding

Aplicado a cada asesor nuevo. 15-20 preguntas de Juicio Situacional (SJT) con elecciones forzadas — sin respuestas evidentemente "buenas" o "malas".

Produce los scores iniciales de `assertividad_score` y `sociabilidad_score` y ubica al asesor en el cuadrante Merrill-Reid.

Se presenta en `/plataforma` como: *"Antes de comenzar, queremos conocer tu estilo para ayudarte mejor."*

### 6.2 Micro-cuestionarios periódicos

1-3 preguntas. Aparecen de forma imprevisible en la plataforma o vía Sailor. Apuntan a dimensiones específicas con baja confianza.

### 6.3 Preguntas de contexto situacional

Vinculadas a eventos específicos (semana sin reporte, récord de contactos, baja en métricas). La pregunta es contextual al evento, no genérica.

### 6.4 Sesiones programadas

Para asesores nuevos o con muchas dimensiones sin cubrir: sesión de 20-30 min anunciada con anticipación en Sailor App. *"Tenemos una sesión para conocerte mejor — ¿podemos hablar el jueves a las 10?"*

**Entregables Fase 6:** Sistema de cuestionarios operativo, onboarding funcionando, señales siendo capturadas.

---

## FASE 7 — Sailor App (iOS y Android)

### 7.1 Visión

Sailor es la superficie de coaching más poderosa del sistema. No es solo un canal de entrega de mensajes — es el canal de escucha más rico. Cada interacción en Sailor puede ser simultáneamente un mensaje de coaching y un punto de captura de señal.

### 7.2 Tecnología

**Stack recomendado:** React Native con Expo
- Un solo código base para iOS y Android
- Expo Push Notifications para notificaciones nativas
- Integración directa con Supabase JS SDK
- FastLane para builds automáticos

### 7.3 Arquitectura de Sailor

```
Sailor App
  ├── Auth (nombre de asesor → Supabase)
  ├── Feed de mensajes del coach
  ├── Chat con coach IA
  ├── Métricas rápidas (resumen semanal)
  ├── Captura de señales (transparente)
  └── Notificaciones push
```

### 7.4 Módulos de Sailor

#### 7.4.1 Autenticación
- Login por nombre (igual que plataforma web actual)
- Persistencia de sesión local
- Sin contraseña en fase inicial — código de verificación vía email

#### 7.4.2 Feed de mensajes
- Lista cronológica de mensajes recibidos del coach IA
- Mensajes entregados previamente por email, ahora también en app
- Estado: leído / no leído
- Acción rápida de reacción (👍👎) que genera `behavioral_signal`

#### 7.4.3 Chat con coach IA
- Interfaz de chat tipo WhatsApp
- Mensajes del coach (IA) a la izquierda, del asesor a la derecha
- La IA responde con mensajes cortos, puntuales, en el tono del perfil del asesor
- Cada mensaje del coach puede terminar con pregunta reflexiva (captura inmanente)
- Respuestas del asesor → `behavioral_signals` de alta calidad

**El loop de coaching + perfilamiento:**
```
IA detecta dimensión con confianza baja
    ↓
Genera mensaje relevante + pregunta reflexiva al final
    ↓
Asesor responde en chat
    ↓
Respuesta → behavioral_signal
    ↓
Motor analiza → confianza de dimensión sube
```

#### 7.4.4 Métricas rápidas
- Resumen de la semana: contactos, PC ratio, estado vs. meta
- Indicador de progresión hacia Modo Integrador (visual, no técnico)
- Comparación con semanas anteriores

#### 7.4.5 Captura inmanente en Sailor
La lógica de `decidirCaptura()` determina si y cómo aflora una captura después de cada interacción:

| Momento | Formato posible |
|---|---|
| Después de reporte | 1 pregunta con alternativas en chat |
| Después de semana difícil | Pregunta reflexiva abierta |
| Push notification inesperada | "Tenemos una pregunta para vos" |
| Cierre de diálogo | Pregunta contextual al tema hablado |
| Lunes de inicio de mes | Micro-cuestionario de 3 preguntas |

#### 7.4.6 Notificaciones push
- Mensajes de coaching automáticos (reemplaza email como canal principal)
- Alertas de métricas críticas (semana sin reporte, bajo meta)
- Invitaciones a sesiones de preguntas
- Mensajes de reconocimiento (cuando el asesor supera una meta)

### 7.5 Integración con el backend

**Nuevas tablas para Sailor:**
```sql
CREATE TABLE sailor_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor       text NOT NULL,
  origen       text, -- 'coach_ia'|'asesor'
  contenido    text NOT NULL,
  tipo         text, -- 'mensaje'|'pregunta'|'reaccion'
  leido        bool DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor       text NOT NULL,
  token        text NOT NULL,
  plataforma   text, -- 'ios'|'android'
  activo       bool DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
```

**Edge Function: `proxis-push`**
- Envía notificaciones push vía Expo Push API
- Se integra con `proxis-monitor` — los mensajes van a email Y a Sailor simultáneamente
- Las respuestas del asesor en Sailor se envían al backend vía API REST

### 7.6 Panel admin para Sailor (`/admin/sailor`)

- Vista de conversaciones por asesor
- Historial de mensajes enviados y respuestas recibidas
- Señales generadas desde cada conversación
- Estado de tokens push (activos/inactivos por dispositivo)
- Estadísticas de apertura y respuesta en app vs. email

### 7.7 Fases de desarrollo de Sailor

**Sailor v1 — MVP:**
- Auth básica
- Feed de mensajes (lectura)
- Reacción 👍👎
- Notificaciones push

**Sailor v2 — Chat:**
- Chat bidireccional con coach IA
- Preguntas reflexivas al final de mensajes
- Captura de señales desde respuestas

**Sailor v3 — Perfilamiento completo:**
- Micro-cuestionarios integrados
- Métricas rápidas
- Sesiones programadas
- Progresión hacia Integrador (visual)

---

## Cronograma estimado

| Fase | Módulo | Estimado |
|---|---|---|
| 0 | Fundación Next.js Admin | 1 semana |
| 1 | Migración admin HTML → Next.js | 2 semanas |
| 2 | Infraestructura de datos nueva | 3 días |
| 3 | Módulos admin nuevos | 2 semanas |
| 4 | Motor de análisis (Edge Functions) | 1 semana |
| 5 | Captura de señales en plataforma web | 1 semana |
| 6 | Sistema de cuestionarios | 1 semana |
| 7.v1 | Sailor App MVP | 3 semanas |
| 7.v2 | Sailor App Chat | 2 semanas |
| 7.v3 | Sailor App Perfilamiento | 2 semanas |

**Total estimado:** ~16 semanas de desarrollo activo

---

## Principios que guían toda la implementación

1. **Relativismo del perfil** — Ningún módulo presenta perfiles como diagnósticos definitivos. Siempre hipótesis con confianza.

2. **Inmanencia del sistema** — La captura de datos no es un módulo separado. Está latente en cada interacción y aflora de forma imprevisible.

3. **La entidad "siendo" en la cultura** — El sistema considera siempre perfil + variables situacionales + contexto cultural. Nunca solo el perfil.

4. **Validación humana** — La IA propone. El coach valida. Ningún cambio al perfil ocurre sin revisión humana.

5. **Autonomía con supervisión** — La IA puede investigar autónomamente, pero todo hallazgo pasa por validación antes de incorporarse.

6. **Humildad epistémica** — Toda comunicación al asesor propone e invita, nunca diagnostica ni sentencia.

---

## Vacíos documentales pendientes (afectan implementación)

Estos contenidos deben estar listos antes de las fases que los requieren:

| Contenido | Requerido para |
|---|---|
| Cuestionario psicométrico (items 1-4) | Fase 6 — Onboarding |
| Ruta Sociable → Integrador | Fase 4 — Motor de análisis |
| Colisión Sociable vs. Sociable | Fase 4 — Motor de análisis |
| Documentación TPS interna (Capa 2) | Fase 4 — Prompts del motor |
| FODA formal por perfil | Fase 3 — Módulo conocimiento |

---

*Documento generado en sesión de arquitectura 2026-05-23. Actualizar cuando cambien decisiones de diseño.*
