-- Reconciliación 2b — Corrige tipo_catalogo.ruta_desarrollo (divergencia de 041)
-- La migración 041 sembró ruta_desarrollo=NULL en los 5 tipos. Acá se completan
-- los 4 tipos base; integrador queda NULL a propósito (es la meta, no una ruta).
-- No edita 041. Idempotente por naturaleza (re-aplicar deja el mismo valor).

UPDATE tipo_catalogo SET ruta_desarrollo = 'suma responsividad'      WHERE id_tipo = 'energetico';
UPDATE tipo_catalogo SET ruta_desarrollo = 'suma empuje y calidez'   WHERE id_tipo = 'reflexivo';
UPDATE tipo_catalogo SET ruta_desarrollo = 'suma dominancia'         WHERE id_tipo = 'relacional';
UPDATE tipo_catalogo SET ruta_desarrollo = 'suma foco y sustancia'   WHERE id_tipo = 'magnetico';
-- integrador: ruta_desarrollo permanece NULL (sin UPDATE).
