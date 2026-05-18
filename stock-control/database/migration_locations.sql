-- ============================================================
-- MIGRACIÓN: Soporte multi-ubicación
-- Hospital Dr. Armando Cima
--
-- CÓMO EJECUTAR EN phpMyAdmin:
--   1. Seleccioná la base de datos "stock_control" en el panel izquierdo
--   2. Clic en la pestaña "SQL"
--   3. Pegá TODO este contenido
--   4. IMPORTANTE: desmarcá la opción "Abort on error" (o "Detener en caso de error")
--      para que continúe aunque alguna columna ya exista
--   5. Clic en "Continuar" o "Go"
-- ============================================================

USE stock_control;

-- ── 1. Tabla de ubicaciones ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    type        ENUM('farmacia','guardia','dispensario') NOT NULL DEFAULT 'dispensario',
    address     TEXT,
    active      TINYINT(1) DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO locations (id, name, type) VALUES
    (1, 'Farmacia Central', 'farmacia'),
    (2, 'Guardia',          'guardia');

-- ── 2. Stock por producto y ubicación ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_stock (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    location_id INT NOT NULL,
    quantity    INT DEFAULT 0,
    min_stock   INT DEFAULT 5,
    UNIQUE KEY  uk_product_location (product_id, location_id),
    FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Migrar stock actual de cada producto a Farmacia Central
INSERT IGNORE INTO product_stock (product_id, location_id, quantity, min_stock)
SELECT id, 1, stock, min_stock FROM products WHERE active = 1;

-- ── 3. Nuevas columnas en movimientos ────────────────────────────────────────
-- Si alguna de estas líneas da error "Duplicate column", simplemente la omitís
-- y continuás con la siguiente. Eso significa que la columna ya existía.

ALTER TABLE stock_movements ADD COLUMN location_id    INT NULL AFTER product_id;
ALTER TABLE stock_movements ADD COLUMN to_location_id INT NULL AFTER location_id;

-- Agregar el tipo "transferencia" al ENUM
ALTER TABLE stock_movements
    MODIFY COLUMN type ENUM('entrada','salida','ajuste','transferencia') NOT NULL;

-- Asignar movimientos existentes a Farmacia Central
UPDATE stock_movements SET location_id = 1 WHERE location_id IS NULL;

-- ── 4. Vista consolidada de stock ─────────────────────────────────────────────
DROP VIEW IF EXISTS v_stock_consolidado;

CREATE VIEW v_stock_consolidado AS
SELECT
    p.id,
    p.code,
    p.name,
    p.unit,
    p.category_id,
    p.supplier_id,
    p.purchase_price,
    p.sale_price,
    p.min_stock,
    p.active,
    c.name AS category_name,
    s.name AS supplier_name,
    COALESCE(SUM(ps.quantity), 0)                    AS stock_total,
    COALESCE(SUM(ps.quantity * p.purchase_price), 0) AS stock_value
FROM products p
LEFT JOIN categories    c  ON p.category_id  = c.id
LEFT JOIN suppliers     s  ON p.supplier_id  = s.id
LEFT JOIN product_stock ps ON p.id = ps.product_id
WHERE p.active = 1
GROUP BY
    p.id, p.code, p.name, p.unit, p.category_id, p.supplier_id,
    p.purchase_price, p.sale_price, p.min_stock, p.active,
    c.name, s.name;
