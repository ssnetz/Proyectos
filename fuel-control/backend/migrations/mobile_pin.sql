-- PIN corto de 6 dígitos para el acceso restringido "Carga con Foto" desde
-- el celular (sin usuario/contraseña completos). Un login con PIN siempre
-- devuelve un token limitado al módulo fueling-photo, sin importar el rol
-- o los permisos normales del usuario dueño del PIN.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'pin'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE users ADD COLUMN pin VARCHAR(6) NULL UNIQUE AFTER permissions',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
