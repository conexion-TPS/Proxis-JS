-- Reconciliación 2b — Catálogo de tipos ERRIM (tipo_catalogo)
-- Mapea codigo_origen histórico (letra E/S/R/A/I) → id_tipo ERRIM plano.
-- Lo consume supabase/functions/_shared/tipo-catalogo.ts (analyzer + researcher).
-- Cierra brecha repo↔base: la tabla YA existe en mkqgbmwm. Idempotente.

CREATE TABLE IF NOT EXISTS tipo_catalogo (
  id_tipo            text PRIMARY KEY,
  nombre_errim       text NOT NULL,
  inicial_errim      text NOT NULL,
  codigo_origen      text,
  naturaleza         text NOT NULL,
  eje_asertividad    text,
  eje_orientacion    text,
  motivacion_interna text,
  ruta_desarrollo    text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Seed de los 5 tipos. ON CONFLICT (id_tipo) DO NOTHING (la base ya los tiene).
-- nombre_errim y ruta_desarrollo CONFIRMADOS por TPS (2026-06-17):
-- nombre_errim = nombre ERRIM acentuado; ruta_desarrollo = NULL en los 5.
INSERT INTO tipo_catalogo
  (id_tipo, nombre_errim, inicial_errim, codigo_origen, naturaleza,
   eje_asertividad, eje_orientacion, motivacion_interna, ruta_desarrollo)
VALUES
  ('energetico', 'Energético', 'E',   'E',  'tipo_base', 'alta', 'tarea',   'Logro e independencia', NULL),
  ('reflexivo',  'Reflexivo',  'Ref', 'A',  'tipo_base', 'baja', 'tarea',   'Conocimiento',          NULL),
  ('relacional', 'Relacional', 'Rel', 'R',  'tipo_base', 'baja', 'persona', 'Vínculo',               NULL),
  ('magnetico',  'Magnético',  'M',   'S',  'tipo_base', 'alta', 'persona', 'Reconocimiento',        NULL),
  ('integrador', 'Integrador', 'I',   'I',  'meta',      NULL,   NULL,      'Modulación lograda',    NULL)
ON CONFLICT (id_tipo) DO NOTHING;
