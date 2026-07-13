CREATE DATABASE IF NOT EXISTS stock_control CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stock_control;

CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(30),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category_id INT,
    supplier_id INT,
    purchase_price DECIMAL(10,2) DEFAULT 0,
    sale_price DECIMAL(10,2) DEFAULT 0,
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 5,
    unit VARCHAR(30) DEFAULT 'unidad',
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    type ENUM('entrada','salida','ajuste') NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reason VARCHAR(200),
    reference VARCHAR(100),
    user VARCHAR(80) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Datos de ejemplo
INSERT INTO categories (name, description) VALUES
  ('Electrónica', 'Dispositivos y componentes electrónicos'),
  ('Herramientas', 'Herramientas manuales y eléctricas'),
  ('Insumos', 'Materiales de consumo general'),
  ('Repuestos', 'Piezas y repuestos varios');

INSERT INTO suppliers (name, contact, email, phone) VALUES
  ('Proveedor Tech S.A.', 'Juan García', 'contacto@provtech.com', '+54 11 4000-0001'),
  ('Distribuidora Central', 'María López', 'ventas@distcentral.com', '+54 11 4000-0002'),
  ('Importadora Norte', 'Carlos Ruiz', 'info@impnorte.com', '+54 11 4000-0003');

INSERT INTO products (code, name, description, category_id, supplier_id, purchase_price, sale_price, stock, min_stock, unit) VALUES
  ('PROD-001', 'Cable HDMI 2m', 'Cable HDMI alta velocidad 2 metros', 1, 1, 500, 950, 25, 10, 'unidad'),
  ('PROD-002', 'Teclado USB', 'Teclado USB español 104 teclas', 1, 1, 1200, 2200, 8, 10, 'unidad'),
  ('PROD-003', 'Mouse inalámbrico', 'Mouse inalámbrico 2.4GHz', 1, 2, 900, 1700, 3, 5, 'unidad'),
  ('PROD-004', 'Destornillador Phillips', 'Set destornilladores Phillips 4 piezas', 2, 3, 300, 600, 15, 8, 'set'),
  ('PROD-005', 'Cinta adhesiva', 'Cinta adhesiva transparente 48mm x 50m', 3, 2, 80, 150, 2, 20, 'rollo'),
  ('PROD-006', 'Filtro de aire', 'Filtro de aire universal 10x20cm', 4, 3, 450, 850, 12, 5, 'unidad');

-- ─── Auth: columna user_id en movimientos y tabla de usuarios ───────────────

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id INT AFTER user;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','operador') DEFAULT 'operador',
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- contraseña: password
INSERT INTO users (username, email, `password`, role) VALUES
  ('admin',    'admin@stock.com',    '$2y$12$bzZBJIhbVmT8OFx7IJ6NaOMwhi/H7kqVewtnoZDJJiHk.eWwVg1bC', 'admin'),
  ('operador', 'operador@stock.com', '$2y$12$GeQrk5QV1WmiCTwYYvDm7OgPS9q1wU5KdT6Q878uCLAeDcBe36z96', 'operador');

-- ─── People: datos de personas compartidos con otros módulos (ej. turnos-prioritarios) ───

CREATE TABLE IF NOT EXISTS people (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    address VARCHAR(200),
    phone VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO people (document_number, first_name, last_name, address, phone) VALUES
  ('30111222', 'Marta',   'Fernández', 'Av. San Martín 450, Mendoza',  '+54 261 400-0001'),
  ('27888999', 'Roberto', 'Gómez',     'Belgrano 1120, Godoy Cruz',    '+54 261 400-0002'),
  ('40555666', 'Lucía',   'Torres',    'Las Heras 780, Guaymallén',    '+54 261 400-0003');
