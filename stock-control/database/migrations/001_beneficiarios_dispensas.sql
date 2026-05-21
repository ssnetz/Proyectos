-- Migración: agrega tablas de beneficiarios y dispensas
-- Segura para ejecutar en bases de datos existentes (IF NOT EXISTS)
USE stock_control;

CREATE TABLE IF NOT EXISTS beneficiarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dni VARCHAR(20) UNIQUE NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE,
    telefono VARCHAR(30),
    direccion TEXT,
    obra_social VARCHAR(100),
    numero_afiliado VARCHAR(50),
    observaciones TEXT,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispensas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    beneficiario_id INT NOT NULL,
    fecha DATE NOT NULL,
    observaciones TEXT,
    user_id INT,
    user VARCHAR(80),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS dispensa_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dispensa_id INT NOT NULL,
    product_id INT NOT NULL,
    cantidad INT NOT NULL,
    stock_previo INT NOT NULL,
    stock_nuevo INT NOT NULL,
    FOREIGN KEY (dispensa_id) REFERENCES dispensas(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);
