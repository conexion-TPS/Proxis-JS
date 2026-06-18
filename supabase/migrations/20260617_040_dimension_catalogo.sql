-- Reconciliación 2a/2b — Catálogo de dimensiones ERRIM (dimension_catalogo)
-- Cierra brecha repo↔base: la tabla YA existe en mkqgbmwm. Idempotente/defensiva.

CREATE TABLE IF NOT EXISTS dimension_catalogo (
  id_dimension       text PRIMARY KEY,
  nombre_errim       text NOT NULL,
  etiqueta_coaching  text,
  capa               text NOT NULL,
  vocabulario        text NOT NULL,
  activa_en_pipeline boolean NOT NULL DEFAULT false,
  sensible           boolean NOT NULL DEFAULT false,
  destino_pipeline   text REFERENCES dimension_catalogo(id_dimension),
  codigo_origen      text,
  nota               text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── 1) PIPELINE (8) — destino_pipeline NULL, codigo_origen NULL, activa=true ──
-- Insertadas primero por la FK self-referencial destino_pipeline.
INSERT INTO dimension_catalogo
  (id_dimension, nombre_errim, etiqueta_coaching, capa, vocabulario,
   activa_en_pipeline, sensible, destino_pipeline, codigo_origen, nota)
VALUES
  ('contexto_situacional',    'Entorno Relacional',       NULL,                   'ontologica',    'pipeline', true, false, NULL, NULL,
   'Reformulación de contexto_situacional; condiciones del vínculo'),
  ('identidad_vendedora',     'Identidad Vendedora',      NULL,                   'ontologica',    'pipeline', true, false, NULL, NULL,
   'Síntesis de orden superior; se nutre de Modelos Mentales + ERRIM + Desempeño'),
  ('modelos_mentales',        'Modelos Mentales',         NULL,                   'ontologica',    'pipeline', true, false, NULL, NULL,
   'Creencias operativas; confidencialidad diferenciada (ontología 3.4)'),
  ('relacion_feedback',       'Apertura al Desarrollo',   NULL,                   'ontologica',    'pipeline', true, false, NULL, NULL,
   'Reformulación de relacion_feedback; permeabilidad al desarrollo'),
  ('relacion_prospeccion',    'Actividad de Prospección', NULL,                   'ontologica',    'pipeline', true, false, NULL, NULL,
   'Hábito C; señales de inactividad y meta de contactos'),
  ('perfil_conductual_notas', 'Perfil ERRIM',             NULL,                   'A_tipo',        'pipeline', true, false, NULL, NULL,
   'Aloja la hipótesis de tipo ERRIM; los tipos viven en tipo_catalogo'),
  ('equilibrio_adaptativo',   'Equilibrio Adaptativo',    NULL,                   'B_profundidad', 'pipeline', true, false, NULL, NULL,
   'Predisposición de base (distinta del Integrador, que es la meta y vive en progresion_integrador). Alimentada por C06 (reasignado desde F2) + AD01-AD07'),
  ('resiliencia',             'Resiliencia',              'Conducta bajo Presión','B_profundidad', 'pipeline', true, true,  NULL, NULL,
   'SENSIBLE: reservada al asesor. Estilo explicativo y conducta bajo presión. Alimentada por tps_c_f4. Etapa 3 filtra esta dimensión del supervisor')
ON CONFLICT (id_dimension) DO NOTHING;

-- ── 2) INSTRUMENTO (10) — vocabulario='instrumento', codigo_origen NULL ──────
-- destino_pipeline referencia filas de pipeline (ya insertadas arriba).
-- activa_en_pipeline=true SOLO en tps_c_f4 y tps_c_adapt (los 2 puentes).
-- sensible=true SOLO en tps_c_f4 y tps_d8.
INSERT INTO dimension_catalogo
  (id_dimension, nombre_errim, etiqueta_coaching, capa, vocabulario,
   activa_en_pipeline, sensible, destino_pipeline, codigo_origen, nota)
VALUES
  ('tps_a',       'Eje Asertividad',        NULL, 'A_tipo',        'instrumento', false, false, 'perfil_conductual_notas', NULL,
   'Modulo A; alimenta el plano de tipo'),
  ('tps_b',       'Eje Orientacion',        NULL, 'A_tipo',        'instrumento', false, false, 'perfil_conductual_notas', NULL,
   'Modulo B; alimenta el plano de tipo'),
  ('tps_c_f1',    'Iniciativa Comercial',   NULL, 'ontologica',    'instrumento', false, false, 'relacion_prospeccion',    NULL,
   'Modulo C F1'),
  ('tps_c_f2',    'Orientacion al Cliente', NULL, 'ontologica',    'instrumento', false, false, NULL,                      NULL,
   'Modulo C F2; sin puente limpio (cuidado del cliente, no encaja en las 6 actuales). Asignar destino cuando exista dimension relacional. Tras reasignar C06/C09 queda con 3 items (C07/C08-/C10-)'),
  ('tps_c_f3',    'Disciplina de Proceso',  NULL, 'ontologica',    'instrumento', false, false, 'relacion_prospeccion',    NULL,
   'Modulo C F3; salud operativa / orientacion a tarea'),
  ('tps_c_f4',    'Resiliencia',            NULL, 'B_profundidad', 'instrumento', true,  true,  'resiliencia',             NULL,
   'Modulo C F4; PUENTE TENDIDO en 2a. Items sensibles (rechazo, autoestima, ansiedad)'),
  ('tps_c_f5',    'Apertura al Desarrollo', NULL, 'ontologica',    'instrumento', false, false, 'relacion_feedback',       NULL,
   'Modulo C F5; recibe C09 reasignado desde F2'),
  ('tps_c_adapt', 'Equilibrio Adaptativo',  NULL, 'B_profundidad', 'instrumento', true,  false, 'equilibrio_adaptativo',   NULL,
   'puente activo; alimentada por C06+AD01-07'),
  ('tps_d',       'Juicio Situacional',     NULL, 'ontologica',    'instrumento', false, false, 'perfil_conductual_notas', NULL,
   'Modulo D; diagnostico operativo de tipo, NO base factorial (ipsativo)'),
  ('tps_d8',      'Necesidad de Aprobacion',NULL, 'B_profundidad', 'instrumento', false, true,  'resiliencia',             NULL,
   'Modulo D D08; SENSIBLE: necesidad de aprobacion / disculpa compulsiva ante critica')
ON CONFLICT (id_dimension) DO NOTHING;
