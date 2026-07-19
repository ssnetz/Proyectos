-- Migración: agrega electores.observaciones. Se completa automáticamente
-- con "Elector inhabilitado" al destildar el checkbox Habilitado en la
-- pantalla de Electores (y se limpia al volver a tildarlo), pero queda
-- como texto libre por si se necesita anotar otra cosa.

ALTER TABLE electores ADD COLUMN observaciones VARCHAR(255) AFTER habilitado;
