-- Inicializa en "tanque lleno" a todos los vehículos con capacidad de
-- tanque cargada que todavía no tuvieron ningún movimiento (carga o GPS)
-- desde que se agregó el nivel estimado. Sin esto, quedan en "—" hasta la
-- primera carga o importación de GPS en vez de arrancar llenos como se
-- definió. Correr después de tank_level.sql. Es seguro repetirlo: solo
-- toca los vehículos que siguen en NULL.
UPDATE vehicles
SET fuel_level_liters = tank_capacity, fuel_level_updated_at = NOW()
WHERE tank_capacity IS NOT NULL AND fuel_level_liters IS NULL;
