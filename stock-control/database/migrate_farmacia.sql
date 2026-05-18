-- ═══════════════════════════════════════════════════════════════════
--  MIGRACIÓN: Stock Control → Sistema de Farmacia
--  Ejecutar en phpMyAdmin: seleccionar la base stock_control
--  y pegar este script en la pestaña SQL
-- ═══════════════════════════════════════════════════════════════════

USE stock_control;

-- Deshabilitar verificación de claves foráneas para poder eliminar en cualquier orden
SET FOREIGN_KEY_CHECKS = 0;

-- ── Eliminar tablas del esquema anterior ─────────────────────────────────────
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS categories;

-- ── Eliminar tablas nuevas por si ya existen (para re-ejecutar limpio) ───────
DROP TABLE IF EXISTS movimientos_stock;
DROP TABLE IF EXISTS stock_lotes;
DROP TABLE IF EXISTS medicamentos;
DROP TABLE IF EXISTS proveedores;
DROP TABLE IF EXISTS categorias_terapeuticas;

-- Rehabilitar verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- ═══════════════════════════════════════════════════════════════════
--  CREAR NUEVAS TABLAS
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Categorías Terapéuticas ────────────────────────────────────────────────
CREATE TABLE categorias_terapeuticas (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL UNIQUE,
    descripcion   TEXT
);

-- ── 2. Proveedores (droguerías, laboratorios, distribuidoras) ─────────────────
CREATE TABLE proveedores (
    id_proveedor  INT AUTO_INCREMENT PRIMARY KEY,
    razon_social  VARCHAR(150) NOT NULL,
    contacto      VARCHAR(100),
    email         VARCHAR(100),
    telefono      VARCHAR(30),
    direccion     TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── 3. Medicamentos — Catálogo ────────────────────────────────────────────────
CREATE TABLE medicamentos (
    id_medicamento       INT AUTO_INCREMENT PRIMARY KEY,
    nombre_comercial     VARCHAR(150) NOT NULL,
    nombre_generico      VARCHAR(150) NOT NULL,
    presentacion         VARCHAR(200),          -- Ej: "Caja de 20 comprimidos 500 mg"
    laboratorio          VARCHAR(150),
    id_categoria         INT,
    -- Campos especiales de regulación y almacenamiento
    controlado           TINYINT(1) NOT NULL DEFAULT 0,  -- Psicotrópico / requiere receta archivada
    refrigerado          TINYINT(1) NOT NULL DEFAULT 0,  -- Requiere cadena de frío
    fraccionable         TINYINT(1) NOT NULL DEFAULT 0,  -- Se vende por unidad, no solo caja cerrada
    activo               TINYINT(1) NOT NULL DEFAULT 1,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria) REFERENCES categorias_terapeuticas(id) ON DELETE SET NULL
);

-- ── 4. Stock por Lotes — Inventario ──────────────────────────────────────────
CREATE TABLE stock_lotes (
    id_stock              INT AUTO_INCREMENT PRIMARY KEY,
    id_medicamento        INT NOT NULL,
    id_proveedor          INT,
    codigo_barras         VARCHAR(100),
    lote                  VARCHAR(80)   NOT NULL,
    fecha_caducidad       DATE          NOT NULL,
    cantidad_existente    INT           NOT NULL DEFAULT 0,
    stock_minimo          INT           NOT NULL DEFAULT 5,
    precio_costo          DECIMAL(10,2) NOT NULL DEFAULT 0,
    precio_venta          DECIMAL(10,2) NOT NULL DEFAULT 0,
    fecha_ultima_compra   DATE,
    ubicacion             VARCHAR(100),              -- Estante, góndola o área de la farmacia
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_medicamento) REFERENCES medicamentos(id_medicamento) ON DELETE CASCADE,
    FOREIGN KEY (id_proveedor)   REFERENCES proveedores(id_proveedor)   ON DELETE SET NULL
);

-- ── 5. Movimientos de Stock — Auditoría ──────────────────────────────────────
CREATE TABLE movimientos_stock (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    id_stock        INT NOT NULL,
    id_medicamento  INT NOT NULL,
    tipo            ENUM('entrada','salida','ajuste') NOT NULL,
    cantidad        INT NOT NULL,
    stock_anterior  INT NOT NULL,
    stock_nuevo     INT NOT NULL,
    motivo          VARCHAR(200),
    referencia      VARCHAR(100),
    usuario         VARCHAR(80) DEFAULT 'admin',
    user_id         INT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_stock)       REFERENCES stock_lotes(id_stock)        ON DELETE CASCADE,
    FOREIGN KEY (id_medicamento) REFERENCES medicamentos(id_medicamento) ON DELETE CASCADE
);

-- ── 6. Usuarios — se conserva la estructura, solo se actualizan los datos ─────
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    email       VARCHAR(100),
    password    VARCHAR(255) NOT NULL,
    role        ENUM('admin','operador') DEFAULT 'operador',
    active      TINYINT(1) DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════
--  DATOS DE EJEMPLO
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO categorias_terapeuticas (nombre, descripcion) VALUES
  ('Analgésico',              'Medicamentos para el control del dolor'),
  ('Antibiótico',             'Medicamentos para tratar infecciones bacterianas'),
  ('Antiinflamatorio',        'Medicamentos para reducir inflamación'),
  ('Antihipertensivo',        'Medicamentos para controlar la presión arterial'),
  ('Antihistamínico',         'Medicamentos para reacciones alérgicas'),
  ('Vitaminas y Suplementos', 'Suplementos vitamínicos y minerales');

INSERT INTO proveedores (razon_social, contacto, email, telefono, direccion) VALUES
  ('Droguería del Sur S.A.',    'Ana Martínez',  'compras@drogueriadelsur.com', '+54 11 4500-0001', 'Av. Corrientes 1234, CABA'),
  ('Laboratorios Biol S.R.L.',  'Pedro Gómez',   'ventas@labsbiol.com.ar',      '+54 11 4500-0002', 'Av. San Martín 456, CABA'),
  ('Distribuidora Farma Norte', 'Laura Sánchez', 'info@farmanorte.com.ar',      '+54 351 4500-003', 'Bv. San Juan 789, Córdoba');

INSERT INTO medicamentos (nombre_comercial, nombre_generico, presentacion, laboratorio, id_categoria, controlado, refrigerado, fraccionable) VALUES
  ('Actron',            'Ibuprofeno',         'Caja de 20 comprimidos de 400 mg',  'Bayer',               1, 0, 0, 1),
  ('Amoxidal',          'Amoxicilina',         'Caja de 12 cápsulas de 500 mg',     'Laboratorio Raffo',   2, 0, 0, 0),
  ('Voltaren',          'Diclofenac sódico',   'Tubo de gel 50 g al 1%',            'Novartis',            3, 0, 0, 0),
  ('Enalapril GE',      'Enalapril',           'Caja de 30 comprimidos de 10 mg',   'Laboratorio Elea',    4, 0, 0, 1),
  ('Histiacil',         'Difenhidramina',      'Frasco de 120 ml jarabe',           'Laboratorio Inverni', 5, 0, 0, 0),
  ('Rivotril',          'Clonazepam',          'Caja de 30 comprimidos de 0,5 mg',  'Roche',               1, 1, 0, 0),
  ('Insulina Glargina', 'Insulina Glargina',   'Caja con 5 lapiceras de 3 ml',      'Sanofi',              6, 0, 1, 0);

INSERT INTO stock_lotes
  (id_medicamento, id_proveedor, codigo_barras, lote, fecha_caducidad, cantidad_existente, stock_minimo, precio_costo, precio_venta, fecha_ultima_compra, ubicacion)
VALUES
  (1, 1, '7790040123456', 'LOT-2024-001', '2026-03-31',  80, 20,  450.00,  950.00, '2024-10-15', 'Estante A-1'),
  (2, 2, '7790040234567', 'LOT-2024-002', '2025-12-31',  45, 15,  600.00, 1250.00, '2024-11-01', 'Estante B-2'),
  (3, 1, '7790040345678', 'LOT-2024-003', '2026-06-30',  30, 10,  800.00, 1600.00, '2024-10-20', 'Estante A-3'),
  (4, 3, '7790040456789', 'LOT-2024-004', '2027-01-31', 120, 30,  200.00,  450.00, '2024-11-10', 'Estante C-1'),
  (5, 2, '7790040567890', 'LOT-2024-005', '2025-09-30',  25, 10,  380.00,  780.00, '2024-10-05', 'Estante B-4'),
  (6, 1, '7790040678901', 'LOT-2024-006', '2026-08-31',  15,  5,  950.00, 1900.00, '2024-11-15', 'Armario Controlados'),
  (7, 3, '7790040789012', 'LOT-2024-007', '2025-07-31',   8,  5, 3200.00, 6500.00, '2024-10-28', 'Heladera Farmacia');

-- Usuarios (contraseña: password) — solo inserta si no existen
INSERT IGNORE INTO users (username, email, `password`, role) VALUES
  ('admin',    'admin@farmacia.com',    '$2y$12$bzZBJIhbVmT8OFx7IJ6NaOMwhi/H7kqVewtnoZDJJiHk.eWwVg1bC', 'admin'),
  ('operador', 'operador@farmacia.com', '$2y$12$GeQrk5QV1WmiCTwYYvDm7OgPS9q1wU5KdT6Q878uCLAeDcBe36z96', 'operador');

-- ═══════════════════════════════════════════════════════════════════
--  VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════════════
SELECT 'categorias_terapeuticas' AS tabla, COUNT(*) AS filas FROM categorias_terapeuticas
UNION ALL
SELECT 'proveedores',    COUNT(*) FROM proveedores
UNION ALL
SELECT 'medicamentos',   COUNT(*) FROM medicamentos
UNION ALL
SELECT 'stock_lotes',    COUNT(*) FROM stock_lotes
UNION ALL
SELECT 'movimientos_stock', COUNT(*) FROM movimientos_stock
UNION ALL
SELECT 'users',          COUNT(*) FROM users;
