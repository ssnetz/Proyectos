CREATE TABLE IF NOT EXISTS zones (
    id     INT AUTO_INCREMENT PRIMARY KEY,
    name   VARCHAR(100) NOT NULL UNIQUE,
    active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO zones (name) VALUES
('Villa Parque San Jorge'),('Villa el Ancón'),('Villa Ahora'),('El Condado'),
('Villa Pan de Azúcar'),('Villa Cumbre Azul'),('Villa Pan de Azúcar Este'),
('Villa Buena Vista'),('Paraje Las Tunas'),('Villa Yuspe'),('Villa Belgrano'),
('La Toma'),('Colinas de Mallín'),('Mercantil'),('Alto Mieres'),('AATRA'),
('Parque Colina Municipal'),('Centro'),('Remembranza'),('Los Carolinos'),
('La Huelga'),('Marimón'),('Quinta Bouquet'),('Santa Teresita'),('Acceso Sur'),
('San José Obrero'),('San Buenas'),('Las Colmenas');

CREATE TABLE IF NOT EXISTS drivers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    dni          VARCHAR(20)  NOT NULL UNIQUE,
    phone        VARCHAR(30)  DEFAULT NULL,
    license_type VARCHAR(10)  DEFAULT NULL,
    hire_date    DATE         DEFAULT NULL,
    hourly_cost  DECIMAL(10,2) NOT NULL DEFAULT 0,
    active       TINYINT(1)  NOT NULL DEFAULT 1,
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cost_config (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id           INT NOT NULL,
    insurance_monthly    DECIMAL(12,2) NOT NULL DEFAULT 0,
    depreciation_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
    maintenance_per_km   DECIMAL(10,4) NOT NULL DEFAULT 0,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS routes (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id    INT NOT NULL,
    driver_id     INT NOT NULL,
    zone_id       INT NOT NULL,
    user_id       INT NOT NULL,
    departure_at  DATETIME NOT NULL,
    arrival_at    DATETIME NOT NULL,
    km_start      DECIMAL(10,1) NOT NULL,
    km_end        DECIMAL(10,1) NOT NULL,
    fuel_liters   DECIMAL(10,2) DEFAULT NULL,
    trips_to_dump INT NOT NULL DEFAULT 0,
    notes         TEXT DEFAULT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (driver_id)  REFERENCES drivers(id),
    FOREIGN KEY (zone_id)    REFERENCES zones(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
