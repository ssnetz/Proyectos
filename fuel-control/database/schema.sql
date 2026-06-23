-- Sistema de Control de Combustible
CREATE DATABASE IF NOT EXISTS fuel_control CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE fuel_control;

CREATE TABLE IF NOT EXISTS users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(80)  NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       ENUM('admin','operator') NOT NULL DEFAULT 'operator',
    active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vehicles (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    plate      VARCHAR(20)  NOT NULL UNIQUE,
    type       VARCHAR(50)  NOT NULL DEFAULT 'Auto',  -- Auto, Camioneta, Camión, Motoniveladora, Pala de Carga, Bobcat, Tractor, Otros
    active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fueling (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    user_id         INT NOT NULL,
    liters          DECIMAL(10,2) NOT NULL,
    km_recorridos   DECIMAL(10,1) DEFAULT NULL,
    price_per_liter DECIMAL(10,4) DEFAULT NULL,
    total_cost      DECIMAL(12,2) DEFAULT NULL,
    fuel_type       VARCHAR(30)  NOT NULL DEFAULT 'Diesel 500',
    station         VARCHAR(120) DEFAULT NULL,
    notes           TEXT         DEFAULT NULL,
    fueled_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuario admin inicial (contraseña: admin123)
INSERT IGNORE INTO users (username, password, role) VALUES
    ('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

CREATE TABLE IF NOT EXISTS fuel_prices (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    fuel_type  VARCHAR(30) NOT NULL,
    price      DECIMAL(10,4) NOT NULL,
    user_id    INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
