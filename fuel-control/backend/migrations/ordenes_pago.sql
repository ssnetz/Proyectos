-- Tabla de órdenes de pago
CREATE TABLE IF NOT EXISTS ordenes_pago (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  numero_op   VARCHAR(50) NOT NULL,
  supplier_id INT NOT NULL,
  fecha       DATE NOT NULL,
  estado      ENUM('borrador','cerrada','pagada') NOT NULL DEFAULT 'borrador',
  notas       TEXT,
  created_by  VARCHAR(100),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Agregar campo op_id a fueling (referencia a la orden de pago)
ALTER TABLE fueling ADD COLUMN IF NOT EXISTS op_id INT NULL DEFAULT NULL;
ALTER TABLE fueling ADD CONSTRAINT IF NOT EXISTS fk_fueling_op FOREIGN KEY (op_id) REFERENCES ordenes_pago(id) ON DELETE SET NULL;

SELECT 'OK - Tablas de órdenes de pago creadas' AS resultado;
