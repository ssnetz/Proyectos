USE stock_control;

CREATE TABLE IF NOT EXISTS product_lots (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    product_id     INT NOT NULL,
    location_id    INT NOT NULL,
    lot_number     VARCHAR(100),
    expiration_date DATE,
    quantity       INT DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_product   (product_id),
    INDEX idx_location  (location_id),
    INDEX idx_expiration(expiration_date)
);
