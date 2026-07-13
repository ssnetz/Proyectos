-- Migración: agrega la tabla `people` (compartida con otros módulos, ej.
-- turnos-prioritarios) a una base de stock-control ya existente.
--
-- IMPORTANTE: antes de correr este archivo, seleccioná en phpMyAdmin (o con
-- `USE nombre_de_la_base;` si lo corrés por consola) la base de datos real
-- que usa tu proyecto de farmacia — revisá el valor de DB_NAME en
-- /var/www/html/farmacia/config/database.php para confirmar cuál es.

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
