-- ============================================================
-- INSTALACIÓN COMPLETA v3.0
-- Farmacia Hospital Dr. Armando Cima
--
-- INSTRUCCIONES phpMyAdmin:
--   1. Abrí phpMyAdmin (no selecciones ninguna base todavía)
--   2. Clic en la pestaña "SQL" (la del servidor, no de una base)
--   3. Pegá TODO este contenido
--   4. Desmarcá "Abort on error"
--   5. Clic en "Continuar"
-- ============================================================

DROP DATABASE IF EXISTS stock_control;
CREATE DATABASE stock_control CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stock_control;

-- ── Proveedores ───────────────────────────────────────────────────────────────
CREATE TABLE suppliers (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    contact    VARCHAR(100),
    email      VARCHAR(100),
    phone      VARCHAR(30),
    address    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Categorías ────────────────────────────────────────────────────────────────
CREATE TABLE categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- ── Productos / Medicamentos ──────────────────────────────────────────────────
CREATE TABLE products (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    code               VARCHAR(50) UNIQUE NOT NULL,
    name               VARCHAR(150) NOT NULL,
    description        TEXT,
    therapeutic_action VARCHAR(150) DEFAULT NULL,
    category_id        INT,
    supplier_id        INT,
    purchase_price     DECIMAL(10,2) DEFAULT 0,
    sale_price         DECIMAL(10,2) DEFAULT 0,
    stock              INT DEFAULT 0,
    min_stock          INT DEFAULT 5,
    unit               VARCHAR(30) DEFAULT 'unidad',
    active             TINYINT(1) DEFAULT 1,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category_id),
    INDEX idx_supplier (supplier_id)
);

-- ── Dependencias / Ubicaciones ────────────────────────────────────────────────
CREATE TABLE locations (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    type       ENUM('farmacia','guardia','dispensario','odontologia','vacutanorio','laboratorio','otros') NOT NULL DEFAULT 'dispensario',
    address    TEXT,
    active     TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO locations (id, name, type) VALUES
    (1, 'Farmacia Central', 'farmacia'),
    (2, 'Guardia',          'guardia');

-- ── Stock por producto y ubicación ───────────────────────────────────────────
CREATE TABLE product_stock (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    location_id INT NOT NULL,
    quantity    INT DEFAULT 0,
    min_stock   INT DEFAULT 5,
    UNIQUE KEY  uk_product_location (product_id, location_id),
    INDEX       idx_product  (product_id),
    INDEX       idx_location (location_id)
);

-- ── Movimientos de stock ──────────────────────────────────────────────────────
CREATE TABLE stock_movements (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    product_id     INT NOT NULL,
    location_id    INT NULL,
    to_location_id INT NULL,
    type           ENUM('entrada','salida','ajuste','transferencia') NOT NULL,
    quantity       INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock      INT NOT NULL,
    reason         VARCHAR(200),
    reference      VARCHAR(100),
    user           VARCHAR(80) DEFAULT 'admin',
    user_id        INT NULL,
    lot_number     VARCHAR(80) NULL,
    expiration_date DATE NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product  (product_id),
    INDEX idx_location (location_id),
    INDEX idx_date     (created_at)
);

-- ── Lotes ────────────────────────────────────────────────────────────────────
CREATE TABLE product_lots (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    product_id      INT NOT NULL,
    location_id     INT NOT NULL,
    lot_number      VARCHAR(80),
    expiration_date DATE,
    quantity        INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_product    (product_id),
    INDEX idx_location   (location_id),
    INDEX idx_expiration (expiration_date)
);

-- ── Usuarios ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50) UNIQUE NOT NULL,
    email      VARCHAR(100),
    password   VARCHAR(255) NOT NULL,
    role       ENUM('admin','operador') DEFAULT 'operador',
    active     TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Usuarios por defecto (contraseña: password)
INSERT INTO users (username, email, password, role) VALUES
  ('admin',    'admin@cima.com',    '$2y$12$bzZBJIhbVmT8OFx7IJ6NaOMwhi/H7kqVewtnoZDJJiHk.eWwVg1bC', 'admin'),
  ('operador', 'operador@cima.com', '$2y$12$GeQrk5QV1WmiCTwYYvDm7OgPS9q1wU5KdT6Q878uCLAeDcBe36z96', 'operador');

-- ── Vista consolidada de stock ────────────────────────────────────────────────
CREATE VIEW v_stock_consolidado AS
SELECT
    p.id, p.code, p.name, p.unit, p.therapeutic_action,
    p.category_id, p.supplier_id,
    p.purchase_price, p.sale_price, p.min_stock, p.active,
    c.name AS category_name,
    s.name AS supplier_name,
    COALESCE(SUM(ps.quantity), 0)                    AS stock_total,
    COALESCE(SUM(ps.quantity * p.purchase_price), 0) AS stock_value
FROM products p
LEFT JOIN categories    c  ON p.category_id = c.id
LEFT JOIN suppliers     s  ON p.supplier_id  = s.id
LEFT JOIN product_stock ps ON p.id = ps.product_id
WHERE p.active = 1
GROUP BY p.id, p.code, p.name, p.unit, p.therapeutic_action,
         p.category_id, p.supplier_id,
         p.purchase_price, p.sale_price, p.min_stock, p.active, c.name, s.name;

-- ============================================================
-- IMPORTACIÓN DE MEDICAMENTOS E INSUMOS
-- Hospital Dr. Armando Cima
--
-- CÓMO EJECUTAR EN phpMyAdmin:
--   1. Seleccioná la base 'stock_control' en el panel izquierdo
--   2. Pestaña 'SQL'
--   3. Pegá TODO el contenido de este archivo
--   4. Desmarcá 'Detener en caso de error' (Abort on error)
--   5. Clic en 'Continuar'
-- ============================================================


-- ── Categorías ─────────────────────────────────────────────
INSERT IGNORE INTO categories (name, description) VALUES
  ('Insumos',     'Insumos y materiales hospitalarios'),
  ('Medicación',  'Medicamentos fuera del programa Remediar'),
  ('Remediar',    'Medicación del programa Remediar'),
  ('Vacunatorio', 'Vacunas y productos de vacunatorio');

-- ── Insumos hospitalarios (191 ítems) ─────────────────────────────
INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('INS-001', 'Agua Oxigenada x 1l', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-002', 'Aguja EV 25/8 21 G x 1"', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-003', 'Aguja IM 40/8 21 G x 1 1/2 "', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-004', 'Aguja SC 16/5 25 G x 5/8', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-005', 'Aguja 25x6/ 23GX 1" Celeste', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-006', 'Aguja 18 G x 1 1/2" (1,2 x 40 mm) Rosa', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-007', 'Aguja pericraneal 23 G (Butterfly)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-008', 'Aguja pericraneal 25 G (Butterfly)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-009', 'Alcohol al 70%', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-010', 'Alcohol al 96 %', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-011', 'Alcohol en gel', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-012', 'Algodón x 500 g', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-013', 'Baja lengua adulto x 100 u', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-014', 'Baja lengua pediatrico x 100 u', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-015', 'Barbijos quirurgicos', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-016', 'Barbijos KN95', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-017', 'Bisturi Nº 11 X 100', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-018', 'Bisturi Nº 15 x 100', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-019', 'Bisturi Nº 22 x 100', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-020', 'Bisturi Nº 23 x 100', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-021', 'Bolsa para recolectar orina 2000 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-022', 'Canulas para oxigenacion nasal (Adultos) K-27', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-023', 'Canulas para oxigenacion nasal (Pediatrica) K-27', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-024', 'Carbón activado en polvo x 1 Kg', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-025', 'Cateter Abbocath Nº 18', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-026', 'Cateter Abbocath Nº 20', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-027', 'Cateter Abbocath Nº 22', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-028', 'Cateter Abbocath Nº 24', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-029', 'Cateter Uretral latex rojo 10 (FR/CH)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-030', 'Cepillos endocervicales', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-031', 'Chata', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-032', 'Cinta Hipoalargenica de 2,5 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-033', 'Cinta Hipoalargenica de 5 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-034', 'Cinta testigo p/esterilizar', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-035', 'Cinta de papel', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-036', 'Clamp umbilical', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-037', 'Electrodos 3M x 50', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-038', 'Espatulas de aire', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-039', 'Especulos Vaginales Pequeños', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-040', 'Especulos Vaginales Medianos', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-041', 'Especulos Vaginales Grandes', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-042', 'Estetoscopio', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-043', 'Formalina en pastillas Fco. x 100 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-044', 'Frasco Humidificador para concentrador de oxigeno (marak SRL)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-045', 'Gasa 1,8 Kg', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-046', 'Gasa Iodoformada', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-047', 'Gel para Ultrasonido x 5 l/ 3 l/ 1L', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-048', 'Glucometro ONE TOUCH Select Plus Flex', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-049', 'Glucometro Accu Chek Guide', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-050', 'Guantes esteriles Nº 7', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0);

INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('INS-051', 'Guantes esteriles Nº 7 1/2', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-052', 'Guantes esteriles Nº 8', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-053', 'Guantes XS x 100 u', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-054', 'Guantes S x 100 u', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-055', 'Guantes M x 100 u', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-056', 'Guantes L x 100', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-057', 'Hisopos Vaginales', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-058', 'Histerometros', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-059', 'Indicador de Esterilización (Calor seco) x 100', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-060', 'Iodo povidona 5 litros', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-061', 'Iodo povidona jabonosa 5 litros', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-062', 'Jabón quirurgico polvo x 1 kg', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-063', 'Jeringas de 1 cc sin aguja', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-064', 'Jeringas de 3 cc sin aguja', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-065', 'Jeringas de 5 cc sin aguja', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-066', 'Jeringas de 10 cc sin aguja', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-067', 'Jeringas de 20 cc sin aguja', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-068', 'Lidocaina en gel', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-069', 'Llave 3 vias Kabu c/prolongador de 30 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-070', 'Mascara de oxigeno con reservorio (Adulto)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-071', 'Mascara de oxigeno con reservorio (Pediatrica)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-072', 'Mascara Venturi (Adulto)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-073', 'Mascara Venturi (Pediatrica)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-074', 'Mascara y ampolla de nebulizacion (Adulto)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-075', 'Mascara y ampolla de nebulizacion (Pediatrica)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-076', 'Nitrofurazona x 1 l', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-077', 'Ovata 10 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-078', 'Ovata 15 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-079', 'Oxímetro Silfab adultos', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-080', 'Oxímetro Silfab pediatrico', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-081', 'Pañales p/ adultos', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-082', 'Papagayo', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-083', 'Papel ECG 50 mm x 30 m', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-084', 'Papel ECG FUKUDA DENSHI OP-119TE 63 mm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-085', 'Papel p/ecografia SONY UPP-110S 110mm x 20 m', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-086', 'Placas Odontologicas', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-087', 'Perfus Macrogotero', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-088', 'Perfus Microgotero', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-089', 'Pinza Mayer', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-090', 'Porta objetos de vidrio x 50', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-091', 'Rifamicina Spray', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-092', 'Sachet de aspiracion', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-093', 'Solución Dextrosa x 500 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-094', 'Solución Fisiologica x 500 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-095', 'Solución Lugol x litro', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-096', 'Solución Ringer x 500 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-097', 'Sonda foley (vesical) Nº 16', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-098', 'Sonda foley (vesical) Nº 18', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-099', 'Sonda foley (vesical) Nº 12 (Pediatrica )', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-100', 'Sonda foley (vesical) Nº 14', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0);

INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('INS-101', 'Sonda Nasogastrica (Adulto) FR 10 TIPO K30 (NEGRO)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-102', 'Sonda Nasogastrica (Pediatrica) FR 6 TIPO K33 (VERDE)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-103', 'Sonda Nasogastrica FR 8 (Adulto-Ped) (Celeste)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-104', 'Sonda Para intubacion gástrica tipo levine K9', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-105', 'Sonda Para intubacion gástrica Tubo PVC FR 16 TIPO K10 (NARANJA)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-106', 'Sonda para aspiracion de mucus con regulador de succion K-30 P FR8 (Ped.)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-107', 'Sonda para aspiracion de mucus con regulador de succion K-32 P FR16 (Ad.)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-108', 'Steri-Strip 3M R1540 x 5', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-109', 'Sulfadiazina de plata c/ lidocaina 400 g', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-110', 'Tela adhesiva de oxido de zinc de 2,5 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-111', 'Tela adhesiva de oxido de zinc de 5 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-112', 'Tensiometros adultos con estetoscopio', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-113', 'Tensiometro p/ obesos', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-114', 'Tensiometros pediatricos', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-115', 'Termometros digitales', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-116', 'Tiras reactivas Accu chek Guide x 50', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-117', 'Tiras reactivas ONETOUCH Select Plus Flex', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-118', 'Tubo endotraqueal Nº 6 FR 24', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-119', 'Tubo endotraqueal Nº 6,5 FR 26', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-120', 'Tubo endotraqueal Nº 7 FR 28', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-121', 'Tubo endotraqueal Nº 7,5 FR 30', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-122', 'Tubo endotraqueal Nº 8 FR 32', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-123', 'Tubo endotraqueal Nº 8,5', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-124', 'Tubo endotraqual Nº 2,5 (Pediatrica) FR 11', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-125', 'Tubo endotraqual Nº 3 (Pediatrica) FR', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-126', 'Tubo endotraqual Nº 3,5 (Pediatrica) FR 14', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-127', 'Tubo endotraqual Nº 4 (Pediatrica) FR 16', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-128', 'Tubo endotraqual Nº 4,5 (Pediatrica) FR 18', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-129', 'Tubo endotraqual Nº 5 (Pediatrica) FR 20', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-130', 'Tubo Guedel Orofaringeo (Mayo) Nº 2 (verde) 80 mm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-131', 'Tubo Guedel Orofaringeo (Mayo) Nº 3 (amarillo) 90 mm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-132', 'Tubo Guedel Orofaringeo (Mayo) Nº 4 (rojo) 100 mm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-133', 'Tubo Guedel Orofaringeo (Mayo) Nº 5 (azul) 110 mm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-134', 'Vaselina Liquida 5 litros', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-135', 'Vaselina Liquida x litro', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-136', 'Vaselina sólida 3 kg/ 1 kg', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-137', 'Venda de yeso 10 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-138', 'Venda de yeso 15 cm', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-139', 'AMPOLLAS', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-140', 'Adenosina 3 mg/ml amp. x 2 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-141', 'Adrenalina 1 mg/ml amp. x 1 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-142', 'Agua Destilada x 5 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-143', 'Aminofilina 240 mg /10 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-144', 'Amiodarona 150 mg/3ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-145', 'Ampicilina + Sulbactam', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-146', 'Atropina sulfato 1mg/ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-147', 'Becozym (Vit B1, B2, B5, B6, PP) amp.', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-148', 'Betametasona 8 mg/2ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-149', 'Ceftriaxona 1 g', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-150', 'Ciprofloxacina 200 mg/100 ml inyectable', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0);

INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('INS-151', 'Clindamicina', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-152', 'Cloruro de Potasio 15 mEq/ 5 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-153', 'Cloruro de Sodio 200 mg/ml/10 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-154', 'Dexametasona 4 mg/ml amp. X 2 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-155', 'Diazepam 10 mg/2 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-156', 'Diclofenac sódico 75 mg/3 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-157', 'Difenhidramina 10 mg/ml x 1ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-158', 'Digoxina 0,25 mg/ml x 1 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-159', 'Dipirona sódica 500 mg/ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-160', 'Dopamina 100 mg/2,5 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-161', 'Fenitoina sódica 100 mg/2 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-162', 'Flumazenil 0,5 mg/ 5 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-163', 'Furosemida 20 mg/2 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-164', 'Heparina sodica 5000 UI/ML x 10 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-165', 'Hidrocortizona 100', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-166', 'Hidrocortizona 500', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-167', 'Hioscina butilbromuro + dipirona 20 mg/250 mg/5 ml (Compuesta)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-168', 'Hioscina butilbromuro 20 mg/ml x 1 ml (Simple)', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-169', 'Ketorolac 30 mg/ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-170', 'Labetalol 5 mg/ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-171', 'Levomepromazina 25 mg/ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-172', 'Lidocaina 1% sin epinefrina', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-173', 'Lidocaina 2% fco ampolla x 25 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-174', 'Lorazepam 4 mg/ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-175', 'Metoclopramida clorhidrato 10 mg/2 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-176', 'Midazolam 15 mg/ 3ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-177', 'Nalbulfina 10 mg/ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-178', 'Naloxona 0,4 mg/ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-179', 'Nitroglicerina 25 mg/5ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-180', 'Noradrenalina', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-181', 'Paracetamol 500 mg/50 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-182', 'Penicilina 1.200.00', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-183', 'Penicilina 2.400.00', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-184', 'Ranitidina 50 mg/ 5 ml IM/EV', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-185', 'Solución Glucosada Hipertonica 50% 500 mg/ml x 10 ml', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-186', 'Material poroso', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-187', 'Vasos Odonto', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-188', 'Fijador para PAP', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-189', 'INSULINA NPH', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-190', 'INSULINA CTE', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0),
  ('INS-191', 'TEST COVID', (SELECT id FROM categories WHERE name = 'Insumos'), 'unidad', 5, 0, 0);

-- ── Medicación fuera de Remediar (108 ítems) ──────────────────────
INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('MED-001', 'Acido Folico 1 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-002', 'Acido Folico 5 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-003', 'Acido Valproico jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-004', 'Aerocamara Adultos', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-005', 'Aerocamara Pediatrica', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-006', 'Ambroxol Jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-007', 'Amlodipina 10 mg comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-008', 'Amoxicilina 500 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-009', 'Amoxicilina 500 mg Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-010', 'Amoxicilina + Ac. Clavulanico 400 mg. Jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-011', 'Amoxicilina + Ac. Clavulanico 1g Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-012', 'Aspirina 100 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-013', 'Atenolol 50 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-014', 'Atorvastatina 10 mg Comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-015', 'Azitromicina 500 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-016', 'Azitromicina Susp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-017', 'Betametasona + Asoc Crema', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-018', 'Betametasona Crema', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-019', 'Betametasona Gtas.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-020', 'Bromhexina Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-021', 'Bromuro de Ipratropio Aerosol', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-022', 'Bromuro de Ipratropio Gotas', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-023', 'Budesonide Aerosol', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-024', 'Budesonide Susp. Gotas', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-025', 'Carbamacepina 200 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-026', 'Carbamacepina Jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-027', 'Carvedilol 25 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-028', 'Cefalexina 500 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-029', 'Cefalexina 500 mg Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-030', 'Ciprofloxacina 500 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-031', 'Ciprof. + Lidocaina + Hidrocort. Gtas Oticas', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-032', 'Claritromicina 500 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-033', 'Claritromicina 250 mg Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-034', 'Clonazepam 1 mg Comprimidos ranurados', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-035', 'Clonazepam 2 mg Comprimidos ranurados', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-036', 'Crema de Bismuto Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-037', 'Diclofenac 75 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-038', 'Difenhidramina Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-039', 'Difenhidramina Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-040', 'Dipirona comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-041', 'Dipirona Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-042', 'Divalproato de sodio 500 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-043', 'Enalapril 10 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-044', 'Fenitoina 100 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-045', 'Fenofibrato 200 mg Comprimidos', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-046', 'Fluconazol 150 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-047', 'Furosemida 40 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-048', 'Glicazida 60 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-049', 'Hidroclorotiazida 50 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-050', 'Hierro + Ac. Folico Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0);

INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('MED-051', 'Homatropina 4 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-052', 'Ibuprofeno 400 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-053', 'Ibuprofeno 2% Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-054', 'Ketorolac sublingual Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-055', 'Levotiroxina 50 mcg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-056', 'Levotiroxina 100 mcg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-057', 'Loratadina Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-058', 'Loratadina Jbe.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-059', 'Lorazepam sublingual 1 mg', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-060', 'Loperamida Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-061', 'Losartan 50 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-062', 'Losartan 100 mg Comprimidos ranurados', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-063', 'Mebendazol Jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-064', 'Mebendazol 200 mg comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-065', 'Metildopa 500 mg comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-066', 'Metformina 500 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-067', 'Metformina 850 mg comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-068', 'Metoclopramida 2% Gtas', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-069', 'Metoclopramida 5% Gtas', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-070', 'Metronidazol 500 mg Comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-071', 'Metronidazol susp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-072', 'Nistatina Susp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-073', 'Norfloxacina 400 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-074', 'Omeprazol 20 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-075', 'Paracetamol 500 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-076', 'Permetrina 5% Crema', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-077', 'Prednisona 8 mg comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-078', 'Prednisona 40 mg comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-079', 'Risperidona 2 mg comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-080', 'Salbutamol Aerosol', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-081', 'Salbutamol Solución p/ Nebulizar', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-082', 'Sales RO', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-083', 'Sertralina 100 mg Comp.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-084', 'Tobramicina colirio', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-085', 'Tobramicina + Dexam. Gtas Oft.', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-086', 'Proparacaina 0,5% gotas anestesicas', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-087', 'Azitromicina jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-088', 'Amoxicilina comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-089', 'Amoxicilina jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-090', 'Amoxicilina + Ac. Clav jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-091', 'Amlodipina comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-092', 'Budesonide aerosol', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-093', 'Cefalexina comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-094', 'Cefalexina jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-095', 'Ciprofloxacina comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-096', 'Enalapril comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-097', 'Furosemida comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-098', 'Ibuprofeno comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-099', 'Ibuprofeno jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-100', 'Loratadina jbe', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0);

INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('MED-101', 'Paracetamol comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-102', 'Paracetamol gtas', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-103', 'Salbutamol aerosol', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-104', 'Sales de r.o', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-105', 'Paracetamol comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-106', 'Paracetamol gtas', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-107', 'Ibuprofeno comp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0),
  ('MED-108', 'Ibuprofeno susp', (SELECT id FROM categories WHERE name = 'Medicación'), 'unidad', 5, 0, 0);

-- ── Remediar (119 ítems) ────────────────────────────────────────────
INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('REM-802', 'Aciclovir 400 mg Comp x 20', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-117', 'Ácido Fólico 1 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-003', 'Ácido Fusídico 2% crema x 15 g', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-004', 'Ácido Valproico Jarabe 250/5 mg/ml x 120 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-803', 'Allopurinol 300 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-006', 'Amiodarona 200 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-007', 'Amlodipina 10 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-008', 'Amlodipina 5 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-009', 'Amlodipina + Losartan 5/50 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-010', 'Amoxicilina 500 mg Comp x 21', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-011', 'Amoxicilina 500/5 mg/ml Susp x 120 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-103', 'Amoxicilina + Ac. Clavulánico 875/125 mg Comp x 14', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-104', 'Amoxicilina + Ac. Clavulánico 400/57 mg Susp x 70 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-014', 'Aspirina 100 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-015', 'Atenolol 50 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-016', 'Azitromicina 500 mg comp x 5', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-017', 'Azitromicina 200/5 mg/ml Susp x 30 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-018', 'Betametasona Crema 0,1 % x 15 g', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-019', 'Betametasona Gotas 0,5 mg/ml x 15 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-020', 'Bisoprolol Fumarato Comp. 5 mg x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-021', 'Budesonide Aer. Bronq. x 200 d', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-022', 'Budesonide + Formoterol Aer. Bronq 160/4,5 mcg', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-023', 'Calcio elemental 500 a 1000 mg comp x 60', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-024', 'Carbamazepina 200 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-025', 'Carvedilol 25 mg comp x 28/30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-026', 'Carvedilol 6,25 mg comp x 28/30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-027', 'Cefalexina 500 mg Comp x 28', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-028', 'Cefalexina 250/5 mg/ml Susp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-029', 'Cefalexina 500/5 mg/ml Susp x 90 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-030', 'Ceftriaxona 1 G Polvo para inyectable', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-031', 'Ciprofloxacina 500 mg Comp x 10/14', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-032', 'Ciprofloxacina + Hidrocortisona  0,2+1 G% Soluc. otica x 5 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-033', 'Claritromicina 500 mg Comp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-034', 'Clindamicina 300 mg Comp x 16', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-035', 'Clindamicina + Ketoconazol Comp. Vaginales 100+400 mg', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-036', 'Dexametasona Amp 8 mg/2ml x 2 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-037', 'Difenhidramina 50 mg Comp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-038', 'Difenhidramina Jarabe 12,5/5 mg/ml x 120 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-039', 'Digoxina 0,25 mg Comp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-040', 'Divalproato de Sodio 500 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-041', 'Enalapril 10 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-042', 'Eritromicina 500 mg Comp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-043', 'Eritromicina 200/5 mg/ml Susp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-044', 'Eritromicina 50/5 mg/ml Soluc. oftalmica x 5 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-045', 'Espaciadores para aerosoles', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-046', 'Espironolactona Comp. 25 mg x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-047', 'Extracto de calendula crema', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-048', 'Fenitoina 100 mg Comp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-049', 'Fenofibrato 200 mg Caps. x 10', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-050', 'Fluconazol 150 mg Comp x 1', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0);

INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('REM-051', 'Furazolidona susp 16,5 mg/5 ml x 250 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-052', 'Furosemida 40 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-053', 'Gentamicina crema 0,1%', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-054', 'Gentamicina soluc. oftalmica 0,3 %', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-055', 'Glibenclamida 5 mg Comp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-056', 'Gliclazida LM 60 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-057', 'Hidroclorotiazida 25 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-058', 'Hierro (S. Ferroso) Soluc. oral 12,5/100 g/ml x 30 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-059', 'Hierro + Ac. Fólico 60-130+0,4-1,2 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-060', 'Homatropina 4 mg Comp x 10', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-061', 'Ibuprofeno Comp 400 mg x 10', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-062', 'Ibuprofeno 100/5 mg/ml Susp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-063', 'Ipratropio Bromuro 25/100 mg/ml soluc p/nebulizacion', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-064', 'Ivermectina 6 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-065', 'Labetalol Comp. 200 mg x 20 u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-066', 'Levodopa + Carbidopa 250/25 mg Comp x 60', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-067', 'Levotiroxina 100 mcg Comp x 30/50', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-068', 'Levotiroxina 50 mcg Comp x 30/50', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-069', 'Loperamida 2 mg Comp x 10', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-070', 'Loratadina 10 mg Comp x 10', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-071', 'Loratadina Jarabe 1mg/ml x 60 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-072', 'Losartan 100 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-073', 'Losartan 50 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-074', 'Mebendazol 200 mg Comp', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-075', 'Mebendazol 100 mg/5 ml Susp x 30 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-076', 'Meprednisona Comp. 4 mg x 20u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-077', 'Meprednisona Comp. 8 mg x 20u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-078', 'Metformina 1000 mg Comp 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-079', 'Metformina 500 mg x Comp 30 u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-080', 'Metformina LP 850 mg Comp x 30u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-081', 'Metildopa Comp. 500 mg x 30u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-082', 'Metoclopramida solucion 2% env. 20 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-083', 'Metoclopramida solucion 5 % env. 20 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-084', 'Metronidazol 500 mg Comp x 15', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-085', 'Metronidazol 500 mg Comp Vaginales x 8u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-086', 'Metronidazol Susp 125/5 mg/ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-087', 'Miconazol Crema al 2% x 30 gr', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-088', 'Nistatina Comp Vaginales 100000 UI', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-089', 'Nistatina 100.000 UI /ML Susp x 24 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-090', 'Nitrofurantoina 100 mg Caps', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-091', 'Norfloxacina 400 mg Comp x 14', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-092', 'Omeprazol 20 mg Caps x 28/30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-093', 'Paracetamol 500 mg Comp x 10u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-094', 'Paracetamol Soluc Oral 100 mg/ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-095', 'Peine fino metalico', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-096', 'Penicilina G 2.400.000 UI Amp x 1', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-305', 'Permetrina 5% Crema Fluida 100 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-098', 'Permetrina Locion 1 %', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-099', 'Polivitaminico A+C+D Solución Oral x 20 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-366', 'Rosuvastatina 20 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0);

INSERT IGNORE INTO products (code, name, category_id, unit, min_stock, purchase_price, sale_price) VALUES
  ('REM-101', 'Salbutamol 100 mcg Aeros. Bronq x 200 ds', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-102', 'Salbutamol Soluc. p/neb 5 mg/ml x 10 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-103', 'Sales de Rehidratacion Oral  Sobres x 1', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-104', 'Simvastatina 20 mg Comp x 30', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-505', 'Sulfadiazina de plata + Vit A + Lidocaina crema', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-763', 'Sulfametoxazol + Trimetoprima (Cotrimoxazol) Comp 800+160 mg', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-107', 'Sulfametoxazol + Trimetoprima (Cotrimoxazol) Susp 200+40/5 mg/ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-464', 'Tobramicina Soluc oftálmica 0.3% x 5 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-108', 'Valproato de magnesio Comp. 400 mg x 30u', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-110', 'Vit A + Vit E + Alantoina Emulsion', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-111', 'Vitamina D Solución Oral 300-500 UI/Gota x 10 ml', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-431', 'Biperideno 2 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-432', 'Diazepam 10 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-435', 'Escitalopram 20 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-474', 'Haloperidol 10 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-467', 'Haloperidol 5 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-433', 'Risperidona 1 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-434', 'Risperidona 2 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0),
  ('REM-375', 'Sertralina 50 mg Comp.', (SELECT id FROM categories WHERE name = 'Remediar'), 'unidad', 5, 0, 0);

-- ── Stock inicial en Farmacia Central (cantidad = 0) ───────────────────
INSERT IGNORE INTO product_stock (product_id, location_id, quantity, min_stock)
SELECT p.id, 1, 0, p.min_stock FROM products p
WHERE p.code LIKE 'INS-%' OR p.code LIKE 'MED-%' OR p.code LIKE 'REM-%';

SELECT CONCAT('Importados: ', COUNT(*), ' productos') AS resultado
FROM products WHERE code LIKE 'INS-%' OR code LIKE 'MED-%' OR code LIKE 'REM-%';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS therapeutic_action VARCHAR(150) DEFAULT NULL AFTER description;
UPDATE products SET therapeutic_action = 'Antiarrítmico'                     WHERE code = 'INS-140';
UPDATE products SET therapeutic_action = 'Vasopresivo / Broncodilatador'      WHERE code = 'INS-141';
UPDATE products SET therapeutic_action = 'Disolvente / Vehículo'              WHERE code = 'INS-142';
UPDATE products SET therapeutic_action = 'Broncodilatador xantínico'          WHERE code = 'INS-143';
UPDATE products SET therapeutic_action = 'Antiarrítmico'                      WHERE code = 'INS-144';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'INS-145';
UPDATE products SET therapeutic_action = 'Anticolinérgico'                    WHERE code = 'INS-146';
UPDATE products SET therapeutic_action = 'Vitamínico (B1, B2, B5, B6)'        WHERE code = 'INS-147';
UPDATE products SET therapeutic_action = 'Corticoide'                         WHERE code = 'INS-148';
UPDATE products SET therapeutic_action = 'Antibiótico cefalosporina'          WHERE code = 'INS-149';
UPDATE products SET therapeutic_action = 'Antibiótico quinolona'              WHERE code = 'INS-150';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'INS-151';
UPDATE products SET therapeutic_action = 'Electrolito'                        WHERE code = 'INS-152';
UPDATE products SET therapeutic_action = 'Electrolito'                        WHERE code = 'INS-153';
UPDATE products SET therapeutic_action = 'Corticoide'                         WHERE code = 'INS-154';
UPDATE products SET therapeutic_action = 'Ansiolítico / Anticonvulsivo'       WHERE code = 'INS-155';
UPDATE products SET therapeutic_action = 'AINE / Analgésico'                  WHERE code = 'INS-156';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'INS-157';
UPDATE products SET therapeutic_action = 'Glucósido cardíaco'                 WHERE code = 'INS-158';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'INS-159';
UPDATE products SET therapeutic_action = 'Vasopresivo / Inotrópico'           WHERE code = 'INS-160';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'INS-161';
UPDATE products SET therapeutic_action = 'Antagonista benzodiazepinas'        WHERE code = 'INS-162';
UPDATE products SET therapeutic_action = 'Diurético'                          WHERE code = 'INS-163';
UPDATE products SET therapeutic_action = 'Anticoagulante'                     WHERE code = 'INS-164';
UPDATE products SET therapeutic_action = 'Corticoide'                         WHERE code = 'INS-165';
UPDATE products SET therapeutic_action = 'Corticoide'                         WHERE code = 'INS-166';
UPDATE products SET therapeutic_action = 'Antiespasmódico / Analgésico'       WHERE code = 'INS-167';
UPDATE products SET therapeutic_action = 'Antiespasmódico'                    WHERE code = 'INS-168';
UPDATE products SET therapeutic_action = 'AINE / Analgésico'                  WHERE code = 'INS-169';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Betabloqueante'  WHERE code = 'INS-170';
UPDATE products SET therapeutic_action = 'Antipsicótico / Sedante'            WHERE code = 'INS-171';
UPDATE products SET therapeutic_action = 'Anestésico local'                   WHERE code = 'INS-172';
UPDATE products SET therapeutic_action = 'Anestésico local'                   WHERE code = 'INS-173';
UPDATE products SET therapeutic_action = 'Ansiolítico / Anticonvulsivo'       WHERE code = 'INS-174';
UPDATE products SET therapeutic_action = 'Antiemético / Procinético'          WHERE code = 'INS-175';
UPDATE products SET therapeutic_action = 'Sedante / Ansiolítico'              WHERE code = 'INS-176';
UPDATE products SET therapeutic_action = 'Analgésico opioide'                 WHERE code = 'INS-177';
UPDATE products SET therapeutic_action = 'Antagonista opioide'                WHERE code = 'INS-178';
UPDATE products SET therapeutic_action = 'Vasodilatador / Antiangionoso'      WHERE code = 'INS-179';
UPDATE products SET therapeutic_action = 'Vasopresivo'                        WHERE code = 'INS-180';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'INS-181';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'INS-182';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'INS-183';
UPDATE products SET therapeutic_action = 'Antiulceroso / Antisecretor H2'     WHERE code = 'INS-184';
UPDATE products SET therapeutic_action = 'Suplemento energético'              WHERE code = 'INS-185';
UPDATE products SET therapeutic_action = 'Antidiabético / Insulina'           WHERE code = 'INS-189';
UPDATE products SET therapeutic_action = 'Antidiabético / Insulina'           WHERE code = 'INS-190';
UPDATE products SET therapeutic_action = 'Diagnóstico'                        WHERE code = 'INS-191';
UPDATE products SET therapeutic_action = 'Vitamínico / Hematínico'            WHERE code = 'MED-001';
UPDATE products SET therapeutic_action = 'Vitamínico / Hematínico'            WHERE code = 'MED-002';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'MED-003';
UPDATE products SET therapeutic_action = 'Dispositivo inhalador'              WHERE code = 'MED-004';
UPDATE products SET therapeutic_action = 'Dispositivo inhalador'              WHERE code = 'MED-005';
UPDATE products SET therapeutic_action = 'Mucolítico / Expectorante'          WHERE code = 'MED-006';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Calcioantagonista' WHERE code = 'MED-007';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-008';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-009';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-010';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-011';
UPDATE products SET therapeutic_action = 'Antiagregante plaquetario / AINE'   WHERE code = 'MED-012';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Betabloqueante'  WHERE code = 'MED-013';
UPDATE products SET therapeutic_action = 'Hipolipemiante / Estatina'          WHERE code = 'MED-014';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-015';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-016';
UPDATE products SET therapeutic_action = 'Corticoide tópico'                  WHERE code = 'MED-017';
UPDATE products SET therapeutic_action = 'Corticoide tópico'                  WHERE code = 'MED-018';
UPDATE products SET therapeutic_action = 'Corticoide'                         WHERE code = 'MED-019';
UPDATE products SET therapeutic_action = 'Mucolítico / Expectorante'          WHERE code = 'MED-020';
UPDATE products SET therapeutic_action = 'Broncodilatador anticolinérgico'    WHERE code = 'MED-021';
UPDATE products SET therapeutic_action = 'Broncodilatador anticolinérgico'    WHERE code = 'MED-022';
UPDATE products SET therapeutic_action = 'Corticoide inhalado / Antiasmático' WHERE code = 'MED-023';
UPDATE products SET therapeutic_action = 'Corticoide inhalado / Antiasmático' WHERE code = 'MED-024';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'MED-025';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'MED-026';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Betabloqueante'  WHERE code = 'MED-027';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-028';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-029';
UPDATE products SET therapeutic_action = 'Antibiótico quinolona'              WHERE code = 'MED-030';
UPDATE products SET therapeutic_action = 'Antibiótico + Anestésico + Corticoide ótico' WHERE code = 'MED-031';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-032';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-033';
UPDATE products SET therapeutic_action = 'Ansiolítico / Antiepiléptico'       WHERE code = 'MED-034';
UPDATE products SET therapeutic_action = 'Ansiolítico / Antiepiléptico'       WHERE code = 'MED-035';
UPDATE products SET therapeutic_action = 'Antidiarreico / Protector gástrico' WHERE code = 'MED-036';
UPDATE products SET therapeutic_action = 'AINE / Analgésico'                  WHERE code = 'MED-037';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'MED-038';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'MED-039';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'MED-040';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'MED-041';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'MED-042';
UPDATE products SET therapeutic_action = 'Antihipertensivo / IECA'            WHERE code = 'MED-043';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'MED-044';
UPDATE products SET therapeutic_action = 'Hipolipemiante / Fibrato'           WHERE code = 'MED-045';
UPDATE products SET therapeutic_action = 'Antifúngico'                        WHERE code = 'MED-046';
UPDATE products SET therapeutic_action = 'Diurético'                          WHERE code = 'MED-047';
UPDATE products SET therapeutic_action = 'Antidiabético / Sulfonilurea'       WHERE code = 'MED-048';
UPDATE products SET therapeutic_action = 'Diurético / Antihipertensivo'       WHERE code = 'MED-049';
UPDATE products SET therapeutic_action = 'Hematínico / Antianémico'           WHERE code = 'MED-050';
UPDATE products SET therapeutic_action = 'Antiespasmódico'                    WHERE code = 'MED-051';
UPDATE products SET therapeutic_action = 'AINE / Analgésico / Antipirético'   WHERE code = 'MED-052';
UPDATE products SET therapeutic_action = 'AINE / Analgésico / Antipirético'   WHERE code = 'MED-053';
UPDATE products SET therapeutic_action = 'AINE / Analgésico'                  WHERE code = 'MED-054';
UPDATE products SET therapeutic_action = 'Hormona tiroidea'                   WHERE code = 'MED-055';
UPDATE products SET therapeutic_action = 'Hormona tiroidea'                   WHERE code = 'MED-056';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'MED-057';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'MED-058';
UPDATE products SET therapeutic_action = 'Ansiolítico / Benzodiazepina'       WHERE code = 'MED-059';
UPDATE products SET therapeutic_action = 'Antidiarreico'                      WHERE code = 'MED-060';
UPDATE products SET therapeutic_action = 'Antihipertensivo / ARA II'          WHERE code = 'MED-061';
UPDATE products SET therapeutic_action = 'Antihipertensivo / ARA II'          WHERE code = 'MED-062';
UPDATE products SET therapeutic_action = 'Antiparasitario'                    WHERE code = 'MED-063';
UPDATE products SET therapeutic_action = 'Antiparasitario'                    WHERE code = 'MED-064';
UPDATE products SET therapeutic_action = 'Antihipertensivo'                   WHERE code = 'MED-065';
UPDATE products SET therapeutic_action = 'Antidiabético / Biguanida'          WHERE code = 'MED-066';
UPDATE products SET therapeutic_action = 'Antidiabético / Biguanida'          WHERE code = 'MED-067';
UPDATE products SET therapeutic_action = 'Antiemético / Procinético'          WHERE code = 'MED-068';
UPDATE products SET therapeutic_action = 'Antiemético / Procinético'          WHERE code = 'MED-069';
UPDATE products SET therapeutic_action = 'Antibiótico / Antiprotozoario'      WHERE code = 'MED-070';
UPDATE products SET therapeutic_action = 'Antibiótico / Antiprotozoario'      WHERE code = 'MED-071';
UPDATE products SET therapeutic_action = 'Antifúngico'                        WHERE code = 'MED-072';
UPDATE products SET therapeutic_action = 'Antibiótico quinolona'              WHERE code = 'MED-073';
UPDATE products SET therapeutic_action = 'Inhibidor bomba de protones'        WHERE code = 'MED-074';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'MED-075';
UPDATE products SET therapeutic_action = 'Antiparasitario (escabicida)'       WHERE code = 'MED-076';
UPDATE products SET therapeutic_action = 'Corticoide sistémico'               WHERE code = 'MED-077';
UPDATE products SET therapeutic_action = 'Corticoide sistémico'               WHERE code = 'MED-078';
UPDATE products SET therapeutic_action = 'Antipsicótico'                      WHERE code = 'MED-079';
UPDATE products SET therapeutic_action = 'Broncodilatador / Agonista B2'      WHERE code = 'MED-080';
UPDATE products SET therapeutic_action = 'Broncodilatador / Agonista B2'      WHERE code = 'MED-081';
UPDATE products SET therapeutic_action = 'Rehidratación oral'                 WHERE code = 'MED-082';
UPDATE products SET therapeutic_action = 'Antidepresivo / ISRS'               WHERE code = 'MED-083';
UPDATE products SET therapeutic_action = 'Antibiótico oftálmico'              WHERE code = 'MED-084';
UPDATE products SET therapeutic_action = 'Antibiótico + Corticoide oftálmico' WHERE code = 'MED-085';
UPDATE products SET therapeutic_action = 'Anestésico oftálmico'               WHERE code = 'MED-086';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-087';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-088';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-089';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-090';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Calcioantagonista' WHERE code = 'MED-091';
UPDATE products SET therapeutic_action = 'Corticoide inhalado / Antiasmático' WHERE code = 'MED-092';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-093';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'MED-094';
UPDATE products SET therapeutic_action = 'Antibiótico quinolona'              WHERE code = 'MED-095';
UPDATE products SET therapeutic_action = 'Antihipertensivo / IECA'            WHERE code = 'MED-096';
UPDATE products SET therapeutic_action = 'Diurético'                          WHERE code = 'MED-097';
UPDATE products SET therapeutic_action = 'AINE / Analgésico / Antipirético'   WHERE code = 'MED-098';
UPDATE products SET therapeutic_action = 'AINE / Analgésico / Antipirético'   WHERE code = 'MED-099';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'MED-100';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'MED-101';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'MED-102';
UPDATE products SET therapeutic_action = 'Broncodilatador / Agonista B2'      WHERE code = 'MED-103';
UPDATE products SET therapeutic_action = 'Rehidratación oral'                 WHERE code = 'MED-104';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'MED-105';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'MED-106';
UPDATE products SET therapeutic_action = 'AINE / Analgésico / Antipirético'   WHERE code = 'MED-107';
UPDATE products SET therapeutic_action = 'AINE / Analgésico / Antipirético'   WHERE code = 'MED-108';
UPDATE products SET therapeutic_action = 'Antiviral'                          WHERE code = 'REM-802';
UPDATE products SET therapeutic_action = 'Vitamínico / Hematínico'            WHERE code = 'REM-117';
UPDATE products SET therapeutic_action = 'Antibiótico tópico'                 WHERE code = 'REM-003';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'REM-004';
UPDATE products SET therapeutic_action = 'Antigotoso / Hipouricemiante'       WHERE code = 'REM-803';
UPDATE products SET therapeutic_action = 'Antiarrítmico'                      WHERE code = 'REM-006';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Calcioantagonista' WHERE code = 'REM-007';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Calcioantagonista' WHERE code = 'REM-008';
UPDATE products SET therapeutic_action = 'Antihipertensivo combinado'         WHERE code = 'REM-009';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-010';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-011';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-103';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-104';
UPDATE products SET therapeutic_action = 'Antiagregante plaquetario'          WHERE code = 'REM-014';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Betabloqueante'  WHERE code = 'REM-015';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-016';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-017';
UPDATE products SET therapeutic_action = 'Corticoide tópico'                  WHERE code = 'REM-018';
UPDATE products SET therapeutic_action = 'Corticoide'                         WHERE code = 'REM-019';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Betabloqueante'  WHERE code = 'REM-020';
UPDATE products SET therapeutic_action = 'Corticoide inhalado / Antiasmático' WHERE code = 'REM-021';
UPDATE products SET therapeutic_action = 'Corticoide + Broncodilatador'       WHERE code = 'REM-022';
UPDATE products SET therapeutic_action = 'Suplemento mineral'                 WHERE code = 'REM-023';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'REM-024';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Betabloqueante'  WHERE code = 'REM-025';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Betabloqueante'  WHERE code = 'REM-026';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-027';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-028';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-029';
UPDATE products SET therapeutic_action = 'Antibiótico cefalosporina'          WHERE code = 'REM-030';
UPDATE products SET therapeutic_action = 'Antibiótico quinolona'              WHERE code = 'REM-031';
UPDATE products SET therapeutic_action = 'Antibiótico + Corticoide ótico'     WHERE code = 'REM-032';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-033';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-034';
UPDATE products SET therapeutic_action = 'Antibiótico + Antifúngico vaginal'  WHERE code = 'REM-035';
UPDATE products SET therapeutic_action = 'Corticoide'                         WHERE code = 'REM-036';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'REM-037';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'REM-038';
UPDATE products SET therapeutic_action = 'Glucósido cardíaco / Antiarrítmico' WHERE code = 'REM-039';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'REM-040';
UPDATE products SET therapeutic_action = 'Antihipertensivo / IECA'            WHERE code = 'REM-041';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-042';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-043';
UPDATE products SET therapeutic_action = 'Antibiótico oftálmico'              WHERE code = 'REM-044';
UPDATE products SET therapeutic_action = 'Dispositivo inhalador'              WHERE code = 'REM-045';
UPDATE products SET therapeutic_action = 'Diurético ahorrador de potasio'     WHERE code = 'REM-046';
UPDATE products SET therapeutic_action = 'Cicatrizante / Antiinflamatorio tópico' WHERE code = 'REM-047';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'REM-048';
UPDATE products SET therapeutic_action = 'Hipolipemiante / Fibrato'           WHERE code = 'REM-049';
UPDATE products SET therapeutic_action = 'Antifúngico'                        WHERE code = 'REM-050';
UPDATE products SET therapeutic_action = 'Antibiótico / Antiprotozoario'      WHERE code = 'REM-051';
UPDATE products SET therapeutic_action = 'Diurético'                          WHERE code = 'REM-052';
UPDATE products SET therapeutic_action = 'Antibiótico tópico'                 WHERE code = 'REM-053';
UPDATE products SET therapeutic_action = 'Antibiótico oftálmico'              WHERE code = 'REM-054';
UPDATE products SET therapeutic_action = 'Antidiabético / Sulfonilurea'       WHERE code = 'REM-055';
UPDATE products SET therapeutic_action = 'Antidiabético / Sulfonilurea'       WHERE code = 'REM-056';
UPDATE products SET therapeutic_action = 'Diurético / Antihipertensivo'       WHERE code = 'REM-057';
UPDATE products SET therapeutic_action = 'Hematínico / Antianémico'           WHERE code = 'REM-058';
UPDATE products SET therapeutic_action = 'Hematínico / Antianémico'           WHERE code = 'REM-059';
UPDATE products SET therapeutic_action = 'Antiespasmódico'                    WHERE code = 'REM-060';
UPDATE products SET therapeutic_action = 'AINE / Analgésico / Antipirético'   WHERE code = 'REM-061';
UPDATE products SET therapeutic_action = 'AINE / Analgésico / Antipirético'   WHERE code = 'REM-062';
UPDATE products SET therapeutic_action = 'Broncodilatador anticolinérgico'    WHERE code = 'REM-063';
UPDATE products SET therapeutic_action = 'Antiparasitario'                    WHERE code = 'REM-064';
UPDATE products SET therapeutic_action = 'Antihipertensivo / Betabloqueante'  WHERE code = 'REM-065';
UPDATE products SET therapeutic_action = 'Antiparkinsónico'                   WHERE code = 'REM-066';
UPDATE products SET therapeutic_action = 'Hormona tiroidea'                   WHERE code = 'REM-067';
UPDATE products SET therapeutic_action = 'Hormona tiroidea'                   WHERE code = 'REM-068';
UPDATE products SET therapeutic_action = 'Antidiarreico'                      WHERE code = 'REM-069';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'REM-070';
UPDATE products SET therapeutic_action = 'Antihistamínico'                    WHERE code = 'REM-071';
UPDATE products SET therapeutic_action = 'Antihipertensivo / ARA II'          WHERE code = 'REM-072';
UPDATE products SET therapeutic_action = 'Antihipertensivo / ARA II'          WHERE code = 'REM-073';
UPDATE products SET therapeutic_action = 'Antiparasitario'                    WHERE code = 'REM-074';
UPDATE products SET therapeutic_action = 'Antiparasitario'                    WHERE code = 'REM-075';
UPDATE products SET therapeutic_action = 'Corticoide sistémico'               WHERE code = 'REM-076';
UPDATE products SET therapeutic_action = 'Corticoide sistémico'               WHERE code = 'REM-077';
UPDATE products SET therapeutic_action = 'Antidiabético / Biguanida'          WHERE code = 'REM-078';
UPDATE products SET therapeutic_action = 'Antidiabético / Biguanida'          WHERE code = 'REM-079';
UPDATE products SET therapeutic_action = 'Antidiabético / Biguanida'          WHERE code = 'REM-080';
UPDATE products SET therapeutic_action = 'Antihipertensivo'                   WHERE code = 'REM-081';
UPDATE products SET therapeutic_action = 'Antiemético / Procinético'          WHERE code = 'REM-082';
UPDATE products SET therapeutic_action = 'Antiemético / Procinético'          WHERE code = 'REM-083';
UPDATE products SET therapeutic_action = 'Antibiótico / Antiprotozoario'      WHERE code = 'REM-084';
UPDATE products SET therapeutic_action = 'Antibiótico / Antiprotozoario vaginal' WHERE code = 'REM-085';
UPDATE products SET therapeutic_action = 'Antibiótico / Antiprotozoario'      WHERE code = 'REM-086';
UPDATE products SET therapeutic_action = 'Antifúngico tópico'                 WHERE code = 'REM-087';
UPDATE products SET therapeutic_action = 'Antifúngico vaginal'                WHERE code = 'REM-088';
UPDATE products SET therapeutic_action = 'Antifúngico'                        WHERE code = 'REM-089';
UPDATE products SET therapeutic_action = 'Antibiótico urinario'               WHERE code = 'REM-090';
UPDATE products SET therapeutic_action = 'Antibiótico quinolona'              WHERE code = 'REM-091';
UPDATE products SET therapeutic_action = 'Inhibidor bomba de protones'        WHERE code = 'REM-092';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'REM-093';
UPDATE products SET therapeutic_action = 'Analgésico / Antipirético'          WHERE code = 'REM-094';
UPDATE products SET therapeutic_action = 'Antiparasitario (pediculosis)'      WHERE code = 'REM-095';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-096';
UPDATE products SET therapeutic_action = 'Antiparasitario (escabicida)'       WHERE code = 'REM-305';
UPDATE products SET therapeutic_action = 'Antiparasitario (pediculicida)'     WHERE code = 'REM-098';
UPDATE products SET therapeutic_action = 'Vitamínico / Suplemento'            WHERE code = 'REM-099';
UPDATE products SET therapeutic_action = 'Hipolipemiante / Estatina'          WHERE code = 'REM-366';
UPDATE products SET therapeutic_action = 'Broncodilatador / Agonista B2'      WHERE code = 'REM-101';
UPDATE products SET therapeutic_action = 'Broncodilatador / Agonista B2'      WHERE code = 'REM-102';
UPDATE products SET therapeutic_action = 'Rehidratación oral'                 WHERE code = 'REM-103';
UPDATE products SET therapeutic_action = 'Hipolipemiante / Estatina'          WHERE code = 'REM-104';
UPDATE products SET therapeutic_action = 'Antibiótico tópico / Cicatrizante'  WHERE code = 'REM-505';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-763';
UPDATE products SET therapeutic_action = 'Antibiótico'                        WHERE code = 'REM-107';
UPDATE products SET therapeutic_action = 'Antibiótico oftálmico'              WHERE code = 'REM-464';
UPDATE products SET therapeutic_action = 'Antiepiléptico'                     WHERE code = 'REM-108';
UPDATE products SET therapeutic_action = 'Vitamínico / Cicatrizante'          WHERE code = 'REM-110';
UPDATE products SET therapeutic_action = 'Vitamínico / Suplemento'            WHERE code = 'REM-111';
UPDATE products SET therapeutic_action = 'Anticolinérgico / Antiparkinsónico' WHERE code = 'REM-431';
UPDATE products SET therapeutic_action = 'Ansiolítico / Anticonvulsivo'       WHERE code = 'REM-432';
UPDATE products SET therapeutic_action = 'Antidepresivo / ISRS'               WHERE code = 'REM-435';
UPDATE products SET therapeutic_action = 'Antipsicótico'                      WHERE code = 'REM-474';
UPDATE products SET therapeutic_action = 'Antipsicótico'                      WHERE code = 'REM-467';
UPDATE products SET therapeutic_action = 'Antipsicótico'                      WHERE code = 'REM-433';
UPDATE products SET therapeutic_action = 'Antipsicótico'                      WHERE code = 'REM-434';
UPDATE products SET therapeutic_action = 'Antidepresivo / ISRS'               WHERE code = 'REM-375';
FROM products WHERE therapeutic_action IS NOT NULL;

INSERT IGNORE INTO categories (name, description)
VALUES ('Psicotrópicos', 'Medicamentos psicotrópicos de dispensación controlada');
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Psicotrópicos')
WHERE code IN (
  'MED-034',  -- Clonazepam 1 mg
  'MED-035',  -- Clonazepam 2 mg
  'MED-059',  -- Lorazepam sublingual 1 mg
  'REM-432',  -- Diazepam 10 mg Comp.
  'INS-155',  -- Diazepam 10 mg/2 ml (inyectable)
  'INS-174',  -- Lorazepam 4 mg/ml (inyectable)
  'INS-176'   -- Midazolam 15 mg/3 ml (inyectable)
);
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Psicotrópicos')
WHERE code IN (
  'MED-079',  -- Risperidona 2 mg
  'REM-433',  -- Risperidona 1 mg
  'REM-434',  -- Risperidona 2 mg
  'REM-467',  -- Haloperidol 5 mg
  'REM-474',  -- Haloperidol 10 mg
  'REM-431',  -- Biperideno 2 mg
  'INS-171'   -- Levomepromazina 25 mg/ml (inyectable)
);
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Psicotrópicos')
WHERE code IN (
  'MED-083',  -- Sertralina 100 mg
  'REM-435',  -- Escitalopram 20 mg
  'REM-375'   -- Sertralina 50 mg
);
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE c.name = 'Psicotrópicos';

SELECT CONCAT('Instalación completada: ', COUNT(*), ' productos cargados') AS resultado
FROM products;
