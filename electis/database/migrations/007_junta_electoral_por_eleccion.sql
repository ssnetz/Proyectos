-- Migración: mueve junta_electoral_nombre de municipios a elecciones.
-- Un municipio tiene varias elecciones (2023, 2027...) y cada una es
-- independiente (mismo criterio que nombre/fecha, ya en elecciones); tenerlo
-- en municipios hacía que editarlo para una elección cambiara el troquel de
-- TODAS las elecciones de ese municipio, pasadas y futuras.
--
-- Se agrega la columna en elecciones, se copia el valor que ya tuviera cada
-- municipio (para no perder lo ya cargado en Configuración) a todas sus
-- elecciones, y se borra la columna vieja de municipios.

ALTER TABLE elecciones ADD COLUMN junta_electoral_nombre VARCHAR(150) NOT NULL DEFAULT 'JUNTA ELECTORAL MUNICIPAL' AFTER fecha;

UPDATE elecciones e
JOIN municipios m ON m.id = e.municipio_id
SET e.junta_electoral_nombre = m.junta_electoral_nombre;

ALTER TABLE municipios DROP COLUMN junta_electoral_nombre;
