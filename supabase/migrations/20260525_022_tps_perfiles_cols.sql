-- Nuevas columnas de UX para tps_perfiles
ALTER TABLE tps_perfiles
  ADD COLUMN IF NOT EXISTS coach_tono    text     DEFAULT 'directo',
  ADD COLUMN IF NOT EXISTS tps_progress  smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notif_push    boolean  DEFAULT true,
  ADD COLUMN IF NOT EXISTS onb_completado boolean DEFAULT false;
