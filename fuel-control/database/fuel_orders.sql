CREATE TABLE IF NOT EXISTS fuel_orders (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id       INT NOT NULL,
    user_id          INT NOT NULL,
    fuel_type        VARCHAR(30) NOT NULL,
    liters_requested DECIMAL(10,2) NOT NULL,
    driver_name      VARCHAR(120) NOT NULL,
    notes            TEXT DEFAULT NULL,
    status           ENUM('pendiente','completada','cancelada') NOT NULL DEFAULT 'pendiente',
    ordered_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
