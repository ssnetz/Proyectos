-- Migración: agrega "elecciones" como una dimensión nueva dentro de cada
-- municipio (2023, 2027, ...). A partir de acá, cargos/listas/candidatos/
-- mesas/electores/actas/fiscales son exclusivos de cada elección;
-- establecimientos y partidos siguen compartidos por municipio (se reusan
-- de una elección a otra).
--
-- Todo lo que ya está cargado hoy queda agrupado en una elección nueva
-- llamada "Elección 2023" (una por cada municipio existente), para no
-- perder ni tener que retocar nada de lo ya cargado.
--
-- IMPORTANTE: hacé un backup completo de la base antes de correr esto.
-- Es un cambio de estructura (ALTER TABLE), no algo que se pueda deshacer
-- fácil si algo sale mal a mitad de camino.
--
-- Cómo correrlo en phpMyAdmin: pestaña "SQL" de la base `electis`, pegar
-- todo este archivo y ejecutar. OJO: cada ALTER TABLE en MySQL/MariaDB hace
-- commit implícito por su cuenta (no hay rollback real de todo el bloque si
-- algo falla a mitad de camino) — por eso el backup previo no es opcional.
--
-- Antes de que un índice único se pueda borrar, tiene que dejar de ser el
-- que sostiene la clave foránea de esa columna; por eso cada tabla agrega
-- primero un índice "de respaldo" sobre la columna vieja antes de tocar el
-- índice único.

-- 1) Tabla nueva de elecciones
CREATE TABLE IF NOT EXISTS elecciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    fecha DATE,
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id)
);

-- 2) Una "Elección 2023" por cada municipio existente, para agrupar ahí todo
--    lo ya cargado.
INSERT INTO elecciones (municipio_id, nombre, fecha)
SELECT id, 'Elección 2023', '2023-06-11' FROM municipios;

-- 3) cargos
ALTER TABLE cargos ADD COLUMN eleccion_id INT NULL AFTER municipio_id;
UPDATE cargos c
  JOIN elecciones e ON e.municipio_id = c.municipio_id
  SET c.eleccion_id = e.id;
ALTER TABLE cargos MODIFY eleccion_id INT NOT NULL;
ALTER TABLE cargos ADD INDEX idx_cargos_municipio (municipio_id);
ALTER TABLE cargos DROP INDEX uk_cargo_municipio_nombre;
ALTER TABLE cargos ADD UNIQUE KEY uk_cargo_eleccion_nombre (eleccion_id, nombre);
ALTER TABLE cargos ADD FOREIGN KEY (eleccion_id) REFERENCES elecciones(id);

-- 4) listas
ALTER TABLE listas ADD COLUMN eleccion_id INT NULL AFTER municipio_id;
UPDATE listas l
  JOIN elecciones e ON e.municipio_id = l.municipio_id
  SET l.eleccion_id = e.id;
ALTER TABLE listas MODIFY eleccion_id INT NOT NULL;
ALTER TABLE listas ADD FOREIGN KEY (eleccion_id) REFERENCES elecciones(id);

-- 5) mesas
ALTER TABLE mesas ADD COLUMN eleccion_id INT NULL AFTER municipio_id;
UPDATE mesas m
  JOIN elecciones e ON e.municipio_id = m.municipio_id
  SET m.eleccion_id = e.id;
ALTER TABLE mesas MODIFY eleccion_id INT NOT NULL;
ALTER TABLE mesas ADD INDEX idx_mesas_establecimiento (establecimiento_id);
ALTER TABLE mesas DROP INDEX uk_mesa_establecimiento_numero;
ALTER TABLE mesas ADD UNIQUE KEY uk_mesa_eleccion_establecimiento_numero (eleccion_id, establecimiento_id, numero);
ALTER TABLE mesas ADD FOREIGN KEY (eleccion_id) REFERENCES elecciones(id);

-- 6) electores
ALTER TABLE electores ADD COLUMN eleccion_id INT NULL AFTER municipio_id;
UPDATE electores el
  JOIN elecciones e ON e.municipio_id = el.municipio_id
  SET el.eleccion_id = e.id;
ALTER TABLE electores MODIFY eleccion_id INT NOT NULL;
ALTER TABLE electores ADD FOREIGN KEY (eleccion_id) REFERENCES elecciones(id);
ALTER TABLE electores ADD INDEX idx_eleccion (eleccion_id);

-- 7) actas
ALTER TABLE actas ADD COLUMN eleccion_id INT NULL AFTER municipio_id;
UPDATE actas a
  JOIN elecciones e ON e.municipio_id = a.municipio_id
  SET a.eleccion_id = e.id;
ALTER TABLE actas MODIFY eleccion_id INT NOT NULL;
ALTER TABLE actas ADD FOREIGN KEY (eleccion_id) REFERENCES elecciones(id);

-- 8) fiscales
ALTER TABLE fiscales ADD COLUMN eleccion_id INT NULL AFTER municipio_id;
UPDATE fiscales f
  JOIN elecciones e ON e.municipio_id = f.municipio_id
  SET f.eleccion_id = e.id;
ALTER TABLE fiscales MODIFY eleccion_id INT NOT NULL;
ALTER TABLE fiscales ADD FOREIGN KEY (eleccion_id) REFERENCES elecciones(id);

-- Verificación rápida post-migración: no debería devolver ninguna fila.
-- SELECT 'cargos' t, COUNT(*) FROM cargos WHERE eleccion_id IS NULL
-- UNION ALL SELECT 'listas', COUNT(*) FROM listas WHERE eleccion_id IS NULL
-- UNION ALL SELECT 'mesas', COUNT(*) FROM mesas WHERE eleccion_id IS NULL
-- UNION ALL SELECT 'electores', COUNT(*) FROM electores WHERE eleccion_id IS NULL
-- UNION ALL SELECT 'actas', COUNT(*) FROM actas WHERE eleccion_id IS NULL
-- UNION ALL SELECT 'fiscales', COUNT(*) FROM fiscales WHERE eleccion_id IS NULL;
