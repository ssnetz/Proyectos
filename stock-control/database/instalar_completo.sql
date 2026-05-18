-- ============================================================
-- INSTALACIÓN COMPLETA - Farmacia Hospital Dr. Armando Cima
--
-- INSTRUCCIONES phpMyAdmin:
--   1. Abrí phpMyAdmin (no selecciones ninguna base todavía)
--   2. Clic en la pestaña "SQL" (la del servidor, no de una base)
--   3. Pegá TODO este contenido
--   4. Desmarcá "Abort on error"
--   5. Clic en "Continuar"
--
-- Este script crea la base de datos desde cero.
-- Si ya existe stock_control, la borra y la recrea.
-- ============================================================

DROP DATABASE IF EXISTS stock_control;
CREATE DATABASE stock_control CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stock_control;

-- ── Proveedores ───────────────────────────────────────────────────────────────
CREATE TABLE suppliers (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    contact    VARCHAR(100),
    email      VARCHAR(100),
    phone      VARCHAR(30),
    address    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Categorías ────────────────────────────────────────────────────────────────
CREATE TABLE categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- ── Productos / Medicamentos ──────────────────────────────────────────────────
CREATE TABLE products (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    code           VARCHAR(50) UNIQUE NOT NULL,
    name           VARCHAR(150) NOT NULL,
    description    TEXT,
    category_id    INT,
    supplier_id    INT,
    purchase_price DECIMAL(10,2) DEFAULT 0,
    sale_price     DECIMAL(10,2) DEFAULT 0,
    stock          INT DEFAULT 0,
    min_stock      INT DEFAULT 5,
    unit           VARCHAR(30) DEFAULT 'unidad',
    active         TINYINT(1) DEFAULT 1,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category_id),
    INDEX idx_supplier (supplier_id)
);

-- ── Ubicaciones (farmacia, guardia, dispensarios) ─────────────────────────────
CREATE TABLE locations (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    type       ENUM('farmacia','guardia','dispensario') NOT NULL DEFAULT 'dispensario',
    address    TEXT,
    active     TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO locations (id, name, type) VALUES
    (1, 'Farmacia Central', 'farmacia'),
    (2, 'Guardia',          'guardia');

-- ── Stock por producto y ubicación ───────────────────────────────────────────
CREATE TABLE product_stock (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    location_id INT NOT NULL,
    quantity    INT DEFAULT 0,
    min_stock   INT DEFAULT 5,
    UNIQUE KEY  uk_product_location (product_id, location_id),
    INDEX       idx_product  (product_id),
    INDEX       idx_location (location_id)
);

-- ── Movimientos de stock ──────────────────────────────────────────────────────
CREATE TABLE stock_movements (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    product_id     INT NOT NULL,
    location_id    INT NULL,
    to_location_id INT NULL,
    type           ENUM('entrada','salida','ajuste','transferencia') NOT NULL,
    quantity       INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock      INT NOT NULL,
    reason         VARCHAR(200),
    reference      VARCHAR(100),
    user           VARCHAR(80) DEFAULT 'admin',
    user_id        INT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product  (product_id),
    INDEX idx_location (location_id),
    INDEX idx_date     (created_at)
);

-- ── Usuarios ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50) UNIQUE NOT NULL,
    email      VARCHAR(100),
    password   VARCHAR(255) NOT NULL,
    role       ENUM('admin','operador') DEFAULT 'operador',
    active     TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Usuarios por defecto (contraseña: password)
INSERT INTO users (username, email, password, role) VALUES
  ('admin',    'admin@cima.com',    '$2y$12$bzZBJIhbVmT8OFx7IJ6NaOMwhi/H7kqVewtnoZDJJiHk.eWwVg1bC', 'admin'),
  ('operador', 'operador@cima.com', '$2y$12$GeQrk5QV1WmiCTwYYvDm7OgPS9q1wU5KdT6Q878uCLAeDcBe36z96', 'operador');

-- ── Vista consolidada de stock ────────────────────────────────────────────────
CREATE VIEW v_stock_consolidado AS
SELECT
    p.id, p.code, p.name, p.unit,
    p.category_id, p.supplier_id,
    p.purchase_price, p.sale_price, p.min_stock, p.active,
    c.name AS category_name,
    s.name AS supplier_name,
    COALESCE(SUM(ps.quantity), 0)                    AS stock_total,
    COALESCE(SUM(ps.quantity * p.purchase_price), 0) AS stock_value
FROM products p
LEFT JOIN categories    c  ON p.category_id = c.id
LEFT JOIN suppliers     s  ON p.supplier_id  = s.id
LEFT JOIN product_stock ps ON p.id = ps.product_id
WHERE p.active = 1
GROUP BY p.id, p.code, p.name, p.unit, p.category_id, p.supplier_id,
         p.purchase_price, p.sale_price, p.min_stock, p.active, c.name, s.name;

SELECT 'Base de datos creada correctamente' AS resultado;
