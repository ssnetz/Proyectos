CREATE DATABASE IF NOT EXISTS turnos_prioritarios CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE turnos_prioritarios;

-- Nota: los datos de personas (pacientes/beneficiarios) viven en la base
-- `stock_control`, tabla `people` (compartida con el sistema de stock de la
-- farmacia del hospital). Este módulo la referencia por id (persona_id) sin
-- clave foránea real, ya que es una base de datos distinta en el mismo
-- servidor MySQL.

CREATE TABLE IF NOT EXISTS profesionales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apellidos VARCHAR(100) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    matricula VARCHAR(30) UNIQUE NOT NULL,
    especialidad VARCHAR(100),
    domicilio VARCHAR(200),
    celular VARCHAR(30),
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS instituciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) UNIQUE NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turnos_prioritarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    persona_id INT NOT NULL,
    profesional_id INT NOT NULL,
    institucion_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    motivo VARCHAR(200),
    prioridad ENUM('alta','media','baja') DEFAULT 'media',
    estado ENUM('pendiente','confirmado','atendido','cancelado') DEFAULT 'pendiente',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profesional_id) REFERENCES profesionales(id),
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id),
    INDEX idx_persona (persona_id),
    INDEX idx_fecha (fecha)
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    contrasena VARCHAR(255) NOT NULL,
    rol ENUM('admin','operador') DEFAULT 'operador',
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Datos de ejemplo

INSERT INTO instituciones (nombre, descripcion) VALUES
  ('Hospital Cima', 'Sede central del Hospital Cima'),
  ('Centro de Salud Norte', 'Centro de atención primaria zona norte'),
  ('Centro de Salud Sur', 'Centro de atención primaria zona sur');

INSERT INTO profesionales (apellidos, nombres, matricula, especialidad, domicilio, celular) VALUES
  ('Pérez',    'Ana',     'MP-1001', 'Clínica Médica', 'Rivadavia 220, Mendoza',    '+54 261 500-0001'),
  ('González', 'Diego',   'MP-1002', 'Traumatología',  'Sarmiento 340, Mendoza',    '+54 261 500-0002'),
  ('Rodríguez','Valeria', 'MP-1003', 'Pediatría',      'Chile 88, Godoy Cruz',      '+54 261 500-0003');

-- contraseña: password
INSERT INTO usuarios (usuario, email, contrasena, rol) VALUES
  ('admin',    'admin@hospitalcima.com',    '$2y$12$bzZBJIhbVmT8OFx7IJ6NaOMwhi/H7kqVewtnoZDJJiHk.eWwVg1bC', 'admin'),
  ('operador', 'operador@hospitalcima.com', '$2y$12$GeQrk5QV1WmiCTwYYvDm7OgPS9q1wU5KdT6Q878uCLAeDcBe36z96', 'operador');
