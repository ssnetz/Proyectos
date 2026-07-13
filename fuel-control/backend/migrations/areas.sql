-- Tabla de áreas municipales
CREATE TABLE IF NOT EXISTS areas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campo area_id en vehicles (con fallback para MySQL sin IF NOT EXISTS en ALTER)
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'area_id'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE vehicles ADD COLUMN area_id INT NULL REFERENCES areas(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Tabla de presupuestos por área y período
CREATE TABLE IF NOT EXISTS area_budgets (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  area_id       INT NOT NULL,
  period_year   SMALLINT NOT NULL,
  period_month  TINYINT NULL COMMENT '1-12, NULL = presupuesto anual',
  budget_type   ENUM('litros','pesos') NOT NULL DEFAULT 'litros',
  budget_amount DECIMAL(14,2) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_area_period (area_id, period_year, period_month),
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);
