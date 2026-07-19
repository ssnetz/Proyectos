-- Migración: agrega electores.habilitado, para poder marcar electores
-- inhabilitados (fallecidos, dados de baja del padrón, etc.) sin borrarlos.
-- Arranca en 1 (habilitado) para no afectar a nadie del padrón ya cargado.

ALTER TABLE electores ADD COLUMN habilitado TINYINT(1) NOT NULL DEFAULT 1 AFTER votado;
