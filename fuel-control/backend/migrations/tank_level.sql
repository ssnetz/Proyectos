-- Nivel estimado de combustible por vehículo (litros), calculado solo, sin
-- sensores reales: sube con cada carga cargada y baja con los km GPS
-- importados (usando vehicles.km_per_liter). Cuando cruza el umbral bajo
-- (ver TANK_LEVEL_THRESHOLD_PCT en helpers.php) se genera sola una orden
-- de carga si no hay ya una pendiente para ese vehículo.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'fuel_level_liters'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE vehicles ADD COLUMN fuel_level_liters DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'fuel_level_updated_at'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE vehicles ADD COLUMN fuel_level_updated_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Marca en la orden de carga si la generó el sistema solo, para distinguirla
-- en la pantalla de Órdenes de Carga.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fuel_orders' AND COLUMN_NAME = 'auto_generada'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE fuel_orders ADD COLUMN auto_generada TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
