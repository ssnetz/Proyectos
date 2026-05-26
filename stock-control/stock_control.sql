-- ============================================================
--  Stock Control Farmacia — Municipalidad de Cosquín
--  Esquema completo de base de datos
--  Generado: 2026-05-26
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `stock_control`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `stock_control`;
-- ------------------------------------------------------------

-- ── categories ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `categories` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── suppliers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(150) NOT NULL,
  `contact`     VARCHAR(100),
  `email`       VARCHAR(100),
  `phone`       VARCHAR(30),
  `address`     TEXT,
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── locations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `locations` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(100) NOT NULL,
  `type`       VARCHAR(50)  DEFAULT 'deposito',
  `active`     TINYINT(1)   DEFAULT 1,
  `created_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `username`   VARCHAR(50)  NOT NULL UNIQUE,
  `email`      VARCHAR(100),
  `password`   VARCHAR(255) NOT NULL,
  `role`       ENUM('admin','operador') DEFAULT 'operador',
  `active`     TINYINT(1)   DEFAULT 1,
  `created_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── personas ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `personas` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `tipo_documento` TINYINT(1)   DEFAULT 1,
  `documento`     VARCHAR(20)  NOT NULL UNIQUE,
  `apellido`      VARCHAR(100) NOT NULL,
  `nombre`        VARCHAR(100) NOT NULL,
  `sexo`          CHAR(1)      DEFAULT 'M',
  `calle`         VARCHAR(150),
  `numeracion`    VARCHAR(20),
  `departamento`  VARCHAR(20),
  `piso`          VARCHAR(10),
  `barrio`        VARCHAR(100),
  `cuit_cuil`     VARCHAR(20),
  `active`        TINYINT(1)   DEFAULT 1,
  `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── products ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `products` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `code`               VARCHAR(50)   NOT NULL UNIQUE,
  `name`               VARCHAR(150)  NOT NULL,
  `description`        TEXT,
  `category_id`        INT,
  `supplier_id`        INT,
  `purchase_price`     DECIMAL(10,2) DEFAULT 0,
  `sale_price`         DECIMAL(10,2) DEFAULT 0,
  `stock`              INT           DEFAULT 0,
  `min_stock`          INT           DEFAULT 5,
  `unit`               VARCHAR(30)   DEFAULT 'unidad',
  `therapeutic_action` VARCHAR(200),
  `active`             TINYINT(1)    DEFAULT 1,
  `created_at`         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── product_lots ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_lots` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `product_id`      INT  NOT NULL,
  `lot_number`      VARCHAR(50),
  `expiration_date` DATE,
  `quantity`        INT  DEFAULT 0,
  `location_id`     INT,
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`)  REFERENCES `products`(`id`)  ON DELETE CASCADE,
  FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── product_stock ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_stock` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `product_id`  INT NOT NULL,
  `location_id` INT NOT NULL,
  `quantity`    INT DEFAULT 0,
  `updated_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_product_location` (`product_id`, `location_id`),
  FOREIGN KEY (`product_id`)  REFERENCES `products`(`id`)  ON DELETE CASCADE,
  FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── stock_movements ─────────────────────────────────────────
--  type = 'dispensa' → entrega a paciente (beneficiary_id → personas)
--  Las dispensas se agrupan por `reference` para representar una
--  entrega completa con múltiples ítems.
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `product_id`     INT         NOT NULL,
  `location_id`    INT,
  `to_location_id` INT,
  `beneficiary_id` INT,
  `category_id`    INT,
  `type`           ENUM('entrada','salida','ajuste','dispensa') NOT NULL,
  `quantity`       INT         NOT NULL,
  `previous_stock` INT         NOT NULL,
  `new_stock`      INT         NOT NULL,
  `reason`         VARCHAR(200),
  `reference`      VARCHAR(100),
  `user`           VARCHAR(80) DEFAULT 'admin',
  `user_id`        INT,
  `created_at`     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`)     REFERENCES `products`(`id`)   ON DELETE CASCADE,
  FOREIGN KEY (`location_id`)    REFERENCES `locations`(`id`)  ON DELETE SET NULL,
  FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`)  ON DELETE SET NULL,
  FOREIGN KEY (`beneficiary_id`) REFERENCES `personas`(`id`)   ON DELETE SET NULL,
  FOREIGN KEY (`category_id`)    REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Vista consolidada ────────────────────────────────────────
CREATE OR REPLACE VIEW `v_stock_consolidado` AS
  SELECT
    p.id, p.code, p.name, p.stock AS stock_total,
    p.min_stock, p.unit, p.active,
    c.name AS category_name,
    s.name AS supplier_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN suppliers  s ON p.supplier_id  = s.id
  WHERE p.active = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Datos iniciales opcionales ───────────────────────────────
-- Descomentá las líneas de abajo si instalás desde cero

-- INSERT IGNORE INTO `locations` (name, type) VALUES ('Farmacia Principal', 'farmacia');

-- INSERT IGNORE INTO `users` (username, email, password, role)
-- VALUES ('admin', 'admin@stock.com',
--   '$2y$12$bzZBJIhbVmT8OFx7IJ6NaOMwhi/H7kqVewtnoZDJJiHk.eWwVg1bC',
--   'admin');
-- (contraseña: admin123)
