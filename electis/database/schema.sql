CREATE DATABASE IF NOT EXISTS electis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE electis;

-- Un mismo Electis puede atender a varios Municipios/Comunas a la vez.
-- Partidos/cargos/listas/candidatos/establecimientos/mesas/fiscales/
-- electores/actas son propios de cada municipio (una elección local tiene
-- sus propias listas y mesas por localidad). Un admin ve y cambia entre
-- cualquier municipio; un operador queda fijo al que se le asigne en
-- `usuarios.municipio_id`.
-- `provincia` hace las veces de "distrito" electoral en el padrón impreso
-- (en elecciones locales el distrito es la provincia); `seccion_electoral`
-- es la sección electoral provincial (ej. "12-Punilla"). El circuito ya es
-- por establecimiento (`establecimientos.circuito`), no por municipio.
CREATE TABLE IF NOT EXISTS municipios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    provincia VARCHAR(100),
    seccion_electoral VARCHAR(100),
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- `municipio_id` NULL = admin, ve y puede cambiar entre todos los
-- municipios. Un operador siempre tiene un municipio_id asignado y solo
-- opera dentro de ese.
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    contrasena VARCHAR(255) NOT NULL,
    rol ENUM('admin','operador') DEFAULT 'operador',
    municipio_id INT NULL,
    permissions JSON NULL,
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id)
);

CREATE TABLE IF NOT EXISTS partidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    sigla VARCHAR(30),
    color VARCHAR(20),
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id)
);

-- Un municipio maneja varias elecciones a lo largo del tiempo (2023, 2027...),
-- cada una con su propio padrón/mesas/listas/actas. Establecimientos y
-- partidos quedan por municipio (se reusan de una elección a otra); todo lo
-- demás (cargos, listas, candidatos, mesas, electores, actas, fiscales) es
-- exclusivo de cada elección.
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

-- Cargos electivos en juego (Intendente, Concejales, Consejo Escolar...).
-- `bancas` es la cantidad de puestos que reparte ese cargo (1 para cargos
-- ejecutivos unipersonales, N para cuerpos colegiados).
CREATE TABLE IF NOT EXISTS cargos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    eleccion_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    bancas INT DEFAULT 1,
    orden INT DEFAULT 0,
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    FOREIGN KEY (eleccion_id) REFERENCES elecciones(id),
    UNIQUE KEY uk_cargo_eleccion_nombre (eleccion_id, nombre)
);

-- Una lista es la candidatura de un partido para un cargo puntual (el mismo
-- partido tiene una lista distinta por cada cargo que compite). `municipio_id`
-- va denormalizado desde partido/cargo (ambos del mismo municipio) para
-- filtrar sin necesidad de JOIN en cada consulta; `eleccion_id` idem desde
-- `cargo_id` (un cargo ya es de una sola elección).
CREATE TABLE IF NOT EXISTS listas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    eleccion_id INT NOT NULL,
    partido_id INT NOT NULL,
    cargo_id INT NOT NULL,
    numero VARCHAR(20) NOT NULL,
    nombre VARCHAR(150),
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    FOREIGN KEY (eleccion_id) REFERENCES elecciones(id),
    FOREIGN KEY (partido_id) REFERENCES partidos(id),
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
    UNIQUE KEY uk_lista_cargo_numero (cargo_id, numero)
);

CREATE TABLE IF NOT EXISTS candidatos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lista_id INT NOT NULL,
    orden INT NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    documento VARCHAR(20),
    titular TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lista_id) REFERENCES listas(id)
);

CREATE TABLE IF NOT EXISTS establecimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(200),
    circuito VARCHAR(30),
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id)
);

-- `numero` es único dentro de cada establecimiento Y elección, no global: la
-- mesa "1" existe en el primer establecimiento de cada municipio, y esa misma
-- mesa "1" se vuelve a usar en cada elección nueva.
CREATE TABLE IF NOT EXISTS mesas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    eleccion_id INT NOT NULL,
    establecimiento_id INT NOT NULL,
    numero VARCHAR(20) NOT NULL,
    electores_habilitados INT DEFAULT 0,
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    FOREIGN KEY (eleccion_id) REFERENCES elecciones(id),
    FOREIGN KEY (establecimiento_id) REFERENCES establecimientos(id),
    UNIQUE KEY uk_mesa_eleccion_establecimiento_numero (eleccion_id, establecimiento_id, numero)
);

-- `mesa_id` nulo = fiscal general (de partido, no atado a una mesa fija).
CREATE TABLE IF NOT EXISTS fiscales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    eleccion_id INT NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    documento VARCHAR(20) NOT NULL,
    celular VARCHAR(30),
    partido_id INT,
    mesa_id INT,
    tipo ENUM('mesa','general') DEFAULT 'mesa',
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    FOREIGN KEY (eleccion_id) REFERENCES elecciones(id),
    FOREIGN KEY (partido_id) REFERENCES partidos(id),
    FOREIGN KEY (mesa_id) REFERENCES mesas(id)
);

-- Padrón de electores. Es un dataset propio de Electis (no se comparte con
-- el padrón de pacientes de farmacia/turnos-prioritarios: son datasets con
-- origen y alcance legal distintos). Pensado para importarse en bloque
-- desde el padrón oficial de cada municipio, uno por elección (el mismo
-- vecino puede aparecer en el padrón de 2023 y en el de 2027 con datos
-- distintos); `votado` se usa el día de la elección.
CREATE TABLE IF NOT EXISTS electores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    eleccion_id INT NOT NULL,
    orden INT,
    documento VARCHAR(20) NOT NULL,
    tipo VARCHAR(10),
    apellido VARCHAR(100) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    sexo CHAR(1),
    fecha_nacimiento DATE,
    domicilio VARCHAR(200),
    mesa_id INT,
    votado TINYINT(1) DEFAULT 0,
    habilitado TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    FOREIGN KEY (eleccion_id) REFERENCES elecciones(id),
    FOREIGN KEY (mesa_id) REFERENCES mesas(id),
    INDEX idx_documento (documento),
    INDEX idx_mesa (mesa_id),
    INDEX idx_apellido_nombre (apellido, nombre)
);

-- Acta de escrutinio de una mesa. El detalle de votos por lista vive en
-- `acta_votos`; acá solo los totales que no dependen de una lista puntual.
CREATE TABLE IF NOT EXISTS actas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    municipio_id INT NOT NULL,
    eleccion_id INT NOT NULL,
    mesa_id INT NOT NULL UNIQUE,
    electores_votantes INT DEFAULT 0,
    votos_blanco INT DEFAULT 0,
    votos_nulos INT DEFAULT 0,
    votos_recurridos INT DEFAULT 0,
    votos_impugnados INT DEFAULT 0,
    estado ENUM('pendiente','cargada','validada') DEFAULT 'pendiente',
    observaciones TEXT,
    cargado_por INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    FOREIGN KEY (eleccion_id) REFERENCES elecciones(id),
    FOREIGN KEY (mesa_id) REFERENCES mesas(id),
    FOREIGN KEY (cargado_por) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS acta_votos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    acta_id INT NOT NULL,
    lista_id INT NOT NULL,
    votos INT DEFAULT 0,
    FOREIGN KEY (acta_id) REFERENCES actas(id),
    FOREIGN KEY (lista_id) REFERENCES listas(id),
    UNIQUE KEY uk_acta_lista (acta_id, lista_id)
);

-- Datos de ejemplo

INSERT INTO municipios (nombre, provincia, seccion_electoral) VALUES
  ('Cosquín', 'Córdoba', '12-Punilla');

INSERT INTO elecciones (municipio_id, nombre, fecha) VALUES
  (1, 'Elección 2023', '2023-06-11');

INSERT INTO cargos (municipio_id, eleccion_id, nombre, bancas, orden) VALUES
  (1, 1, 'Intendente', 1, 1),
  (1, 1, 'Concejales', 8, 2);

INSERT INTO partidos (municipio_id, nombre, sigla, color) VALUES
  (1, 'Frente Vecinal', 'FV', '#2563eb'),
  (1, 'Unión Cívica', 'UC', '#dc2626'),
  (1, 'Nueva Alianza', 'NA', '#16a34a');

INSERT INTO establecimientos (municipio_id, nombre, direccion, circuito) VALUES
  (1, 'Escuela N°1 Domingo F. Sarmiento', 'San Martín 450, Cosquín', '01'),
  (1, 'Escuela N°5 Manuel Belgrano', 'Rivadavia 220, Cosquín', '01');

INSERT INTO mesas (municipio_id, eleccion_id, establecimiento_id, numero, electores_habilitados) VALUES
  (1, 1, 1, '0001', 350),
  (1, 1, 1, '0002', 340),
  (1, 1, 2, '0003', 320);

-- contraseña: password
INSERT INTO usuarios (usuario, email, contrasena, rol, municipio_id) VALUES
  ('admin',    'admin@electis.local',    '$2y$12$bzZBJIhbVmT8OFx7IJ6NaOMwhi/H7kqVewtnoZDJJiHk.eWwVg1bC', 'admin', NULL),
  ('operador', 'operador@electis.local', '$2y$12$GeQrk5QV1WmiCTwYYvDm7OgPS9q1wU5KdT6Q878uCLAeDcBe36z96', 'operador', 1);
