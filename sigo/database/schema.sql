-- SIGO — Sistema Integrado de Gestión de Obras
-- Municipalidad de Cosquín
--
-- Correr una vez contra una base de datos vacía para arrancar. El módulo de
-- Obras todavía no está definido (falta acordar qué campos y estados
-- necesita) — este schema por ahora solo trae lo mínimo para que el login y
-- la gestión de usuarios funcionen.

CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(80)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('admin','operator') NOT NULL DEFAULT 'operator',
    permissions JSON NULL, -- NULL = acceso a todos los módulos
    active      TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuario admin inicial — cambiar la contraseña apenas se entra por primera vez.
-- Contraseña: sigo2026 (hash bcrypt de ejemplo, generar uno propio en producción)
-- INSERT INTO users (username, password, role) VALUES ('admin', '$2y$10$REEMPLAZAR_CON_HASH_REAL', 'admin');
