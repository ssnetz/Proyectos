-- Multi-municipio: agrega la tabla `municipios` y la columna `municipio_id`
-- a las entidades existentes, para que un mismo Electis pueda atender a
-- varios Municipios/Comunas a la vez. Los datos que ya existan (todos de
-- Cosquín) quedan asignados al municipio "Cosquín" que crea esta migración.
--
-- Diseño: partidos/cargos/listas/candidatos son propios de cada municipio
-- (una elección local tiene sus propias listas por localidad). Un admin ve
-- y cambia entre cualquier municipio; un operador queda fijo al que se le
-- asigne en su usuario.

CREATE TABLE IF NOT EXISTS municipios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    provincia VARCHAR(100),
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO municipios (nombre, provincia)
SELECT 'Cosquín', 'Córdoba'
WHERE NOT EXISTS (SELECT 1 FROM municipios WHERE nombre = 'Cosquín');

SET @cosquin_id := (SELECT id FROM municipios WHERE nombre = 'Cosquín' LIMIT 1);

-- ── partidos ────────────────────────────────────────────────────────────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidos' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, CONCAT('ALTER TABLE partidos ADD COLUMN municipio_id INT NOT NULL DEFAULT ', @cosquin_id, ' AFTER id, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── cargos (+ pasar el UNIQUE de nombre a ser por municipio) ──────────────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cargos' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, CONCAT('ALTER TABLE cargos ADD COLUMN municipio_id INT NOT NULL DEFAULT ', @cosquin_id, ' AFTER id, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cargos' AND COLUMN_NAME = 'nombre' AND NON_UNIQUE = 0 AND INDEX_NAME != 'PRIMARY' LIMIT 1);
SET @sql := IF(@idx IS NOT NULL, CONCAT('ALTER TABLE cargos DROP INDEX `', @idx, '`'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cargos' AND INDEX_NAME = 'uk_cargo_municipio_nombre');
SET @sql := IF(@exist = 0, 'ALTER TABLE cargos ADD UNIQUE KEY uk_cargo_municipio_nombre (municipio_id, nombre)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── establecimientos ───────────────────────────────────────────────────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'establecimientos' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, CONCAT('ALTER TABLE establecimientos ADD COLUMN municipio_id INT NOT NULL DEFAULT ', @cosquin_id, ' AFTER id, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── mesas (+ pasar el UNIQUE de numero a ser por establecimiento) ─────────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mesas' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, CONCAT('ALTER TABLE mesas ADD COLUMN municipio_id INT NOT NULL DEFAULT ', @cosquin_id, ' AFTER id, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mesas' AND COLUMN_NAME = 'numero' AND NON_UNIQUE = 0 AND INDEX_NAME != 'PRIMARY' LIMIT 1);
SET @sql := IF(@idx IS NOT NULL, CONCAT('ALTER TABLE mesas DROP INDEX `', @idx, '`'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mesas' AND INDEX_NAME = 'uk_mesa_establecimiento_numero');
SET @sql := IF(@exist = 0, 'ALTER TABLE mesas ADD UNIQUE KEY uk_mesa_establecimiento_numero (establecimiento_id, numero)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── listas (denormalizado desde partido/cargo, para filtrar simple) ──────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listas' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, CONCAT('ALTER TABLE listas ADD COLUMN municipio_id INT NOT NULL DEFAULT ', @cosquin_id, ' AFTER id, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── fiscales ────────────────────────────────────────────────────────────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiscales' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, CONCAT('ALTER TABLE fiscales ADD COLUMN municipio_id INT NOT NULL DEFAULT ', @cosquin_id, ' AFTER id, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── electores ───────────────────────────────────────────────────────────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'electores' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, CONCAT('ALTER TABLE electores ADD COLUMN municipio_id INT NOT NULL DEFAULT ', @cosquin_id, ' AFTER id, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── actas ───────────────────────────────────────────────────────────────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'actas' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, CONCAT('ALTER TABLE actas ADD COLUMN municipio_id INT NOT NULL DEFAULT ', @cosquin_id, ' AFTER id, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── usuarios (nullable: NULL = admin ve todos los municipios) ────────────
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'municipio_id');
SET @sql := IF(@exist = 0, 'ALTER TABLE usuarios ADD COLUMN municipio_id INT NULL AFTER rol, ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Los operadores existentes (previos a esta migración) quedan asignados a
-- Cosquín; los admin quedan en NULL (ven todos los municipios).
UPDATE usuarios SET municipio_id = @cosquin_id WHERE rol = 'operador' AND municipio_id IS NULL;
