-- Permisos por módulo para usuarios no administradores.
-- NULL = acceso a todos los módulos (comportamiento actual, por defecto).
-- Un admin siempre tiene acceso completo sin importar este campo.
--
-- Ejecutar en la base `stock_control` (dueña: farmacia).
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'permissions'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE users ADD COLUMN permissions JSON NULL AFTER role',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
