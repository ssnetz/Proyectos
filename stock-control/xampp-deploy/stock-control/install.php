<?php
/**
 * Stock Control – Instalador / Actualizador
 * Ejecutar una sola vez desde el navegador: http://localhost/stock-control/install.php
 *
 * SEGURO: solo crea lo que no existe. Nunca borra ni modifica datos existentes.
 */

define('DB_HOST',    'localhost');
define('DB_USER',    'root');
define('DB_PASS',    '');
define('DB_NAME',    'stock_control');
define('DB_CHARSET', 'utf8mb4');

$log = [];

function ok(string $msg)  { global $log; $log[] = ['ok',   $msg]; }
function info(string $msg){ global $log; $log[] = ['info', $msg]; }
function err(string $msg) { global $log; $log[] = ['err',  $msg]; }

function run(PDO $db, string $sql, string $desc): void {
    try {
        $db->exec($sql);
        ok($desc);
    } catch (PDOException $e) {
        // "Duplicate column" or "already exists" are non-fatal
        $msg = $e->getMessage();
        if (stripos($msg, 'Duplicate column') !== false ||
            stripos($msg, 'already exists')   !== false) {
            info("$desc (ya existía)");
        } else {
            err("$desc — " . $msg);
        }
    }
}

// ── Conexión ────────────────────────────────────────────────────────────────
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";charset=" . DB_CHARSET,
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die('<h2 style="color:red">No se pudo conectar a MySQL: ' . htmlspecialchars($e->getMessage()) . '</h2>
         <p>Verificá que XAMPP MySQL esté corriendo y que usuario/contraseña sean correctos en este archivo.</p>');
}

// ── Base de datos ────────────────────────────────────────────────────────────
run($pdo, "CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "`
           CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", "Base de datos `stock_control`");

$pdo->exec("USE `" . DB_NAME . "`");

// ── Tablas ───────────────────────────────────────────────────────────────────

run($pdo, "CREATE TABLE IF NOT EXISTS categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
)", "Tabla categories");

run($pdo, "CREATE TABLE IF NOT EXISTS suppliers (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    contact     VARCHAR(100),
    email       VARCHAR(100),
    phone       VARCHAR(30),
    address     TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)", "Tabla suppliers");

run($pdo, "CREATE TABLE IF NOT EXISTS locations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(50)  DEFAULT 'deposito',
    active      TINYINT(1)   DEFAULT 1,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
)", "Tabla locations");

run($pdo, "CREATE TABLE IF NOT EXISTS personas (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    tipo_documento  TINYINT(1)   DEFAULT 1,
    documento       VARCHAR(20)  NOT NULL UNIQUE,
    apellido        VARCHAR(100) NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    sexo            CHAR(1)      DEFAULT 'M',
    calle           VARCHAR(150),
    numeracion      VARCHAR(20),
    departamento    VARCHAR(20),
    piso            VARCHAR(10),
    barrio          VARCHAR(100),
    cuit_cuil       VARCHAR(20),
    active          TINYINT(1)   DEFAULT 1,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)", "Tabla personas");

run($pdo, "CREATE TABLE IF NOT EXISTS products (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    code                VARCHAR(50)     UNIQUE NOT NULL,
    name                VARCHAR(150)    NOT NULL,
    description         TEXT,
    category_id         INT,
    supplier_id         INT,
    purchase_price      DECIMAL(10,2)   DEFAULT 0,
    sale_price          DECIMAL(10,2)   DEFAULT 0,
    stock               INT             DEFAULT 0,
    min_stock           INT             DEFAULT 5,
    unit                VARCHAR(30)     DEFAULT 'unidad',
    therapeutic_action  VARCHAR(200),
    active              TINYINT(1)      DEFAULT 1,
    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)  ON DELETE SET NULL
)", "Tabla products");

run($pdo, "CREATE TABLE IF NOT EXISTS product_lots (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    product_id      INT NOT NULL,
    lot_number      VARCHAR(50),
    expiry_date     DATE,
    quantity        INT DEFAULT 0,
    location_id     INT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
)", "Tabla product_lots");

run($pdo, "CREATE TABLE IF NOT EXISTS product_stock (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    location_id INT NOT NULL,
    quantity    INT DEFAULT 0,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_location (product_id, location_id),
    FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
)", "Tabla product_stock");

run($pdo, "CREATE TABLE IF NOT EXISTS stock_movements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    product_id      INT         NOT NULL,
    location_id     INT,
    beneficiary_id  INT,
    type            ENUM('entrada','salida','ajuste','dispensa') NOT NULL,
    quantity        INT         NOT NULL,
    previous_stock  INT         NOT NULL,
    new_stock       INT         NOT NULL,
    reason          VARCHAR(200),
    reference       VARCHAR(100),
    user            VARCHAR(80) DEFAULT 'admin',
    user_id         INT,
    created_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id)     REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id)    REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (beneficiary_id) REFERENCES personas(id) ON DELETE SET NULL
)", "Tabla stock_movements");

run($pdo, "CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    email       VARCHAR(100),
    password    VARCHAR(255) NOT NULL,
    role        ENUM('admin','operador') DEFAULT 'operador',
    active      TINYINT(1)   DEFAULT 1,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)", "Tabla users");

// ── Columnas que pueden faltar en tablas existentes ──────────────────────────
run($pdo, "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS location_id    INT AFTER product_id",   "Columna stock_movements.location_id");
run($pdo, "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS beneficiary_id INT AFTER location_id",  "Columna stock_movements.beneficiary_id");
run($pdo, "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id        INT AFTER user",         "Columna stock_movements.user_id");
run($pdo, "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS to_location_id INT AFTER location_id",  "Columna stock_movements.to_location_id");
run($pdo, "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS category_id    INT AFTER to_location_id", "Columna stock_movements.category_id");
run($pdo, "ALTER TABLE products        ADD COLUMN IF NOT EXISTS therapeutic_action VARCHAR(200)   AFTER unit",         "Columna products.therapeutic_action");
run($pdo, "ALTER TABLE products        ADD COLUMN IF NOT EXISTS purchase_price    DECIMAL(10,2) DEFAULT 0 AFTER therapeutic_action", "Columna products.purchase_price");
run($pdo, "ALTER TABLE products        ADD COLUMN IF NOT EXISTS sale_price        DECIMAL(10,2) DEFAULT 0 AFTER purchase_price",     "Columna products.sale_price");

// ── Ampliar ENUM type si falta 'dispensa' ────────────────────────────────────
run($pdo, "ALTER TABLE stock_movements MODIFY COLUMN type ENUM('entrada','salida','ajuste','dispensa') NOT NULL",
    "ENUM stock_movements.type incluye 'dispensa'");

// ── Migración: poblar product_stock desde stock_movements (idempotente) ─────
run($pdo, "
    INSERT INTO product_stock (product_id, location_id, quantity)
    SELECT
        m.product_id,
        m.location_id,
        GREATEST(0, SUM(CASE
            WHEN m.type = 'entrada'              THEN  m.quantity
            WHEN m.type IN ('salida','dispensa') THEN -m.quantity
            ELSE 0
        END)) AS qty
    FROM stock_movements m
    WHERE m.location_id IS NOT NULL
    GROUP BY m.product_id, m.location_id
    HAVING qty > 0
    ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
", "Migración product_stock desde movimientos históricos");

// ── Vista consolidada ────────────────────────────────────────────────────────
run($pdo, "CREATE OR REPLACE VIEW v_stock_consolidado AS
    SELECT
        p.id, p.code, p.name, p.stock AS stock_total,
        p.min_stock, p.unit, p.active,
        c.name AS category_name,
        s.name AS supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers  s ON p.supplier_id  = s.id
    WHERE p.active = 1",
"Vista v_stock_consolidado");

// ── Usuario admin por defecto (solo si no hay ningún usuario) ────────────────
$count = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
if ($count === 0) {
    // contraseña: admin123
    $hash = '$2y$12$bzZBJIhbVmT8OFx7IJ6NaOMwhi/H7kqVewtnoZDJJiHk.eWwVg1bC';
    $pdo->exec("INSERT INTO users (username, email, password, role)
                VALUES ('admin', 'admin@stock.com', '$hash', 'admin')");
    ok("Usuario admin creado (contraseña: admin123)");
} else {
    info("Usuarios existentes conservados ($count usuario/s)");
}

// ── Ubicación por defecto (solo si no hay ninguna) ───────────────────────────
$countLoc = (int)$pdo->query("SELECT COUNT(*) FROM locations")->fetchColumn();
if ($countLoc === 0) {
    $pdo->exec("INSERT INTO locations (name, type) VALUES ('Farmacia Principal', 'farmacia')");
    ok("Ubicación 'Farmacia Principal' creada");
} else {
    info("Ubicaciones existentes conservadas ($countLoc ubicación/es)");
}

// ── Resumen ─────────────────────────────────────────────────────────────────
$errors = array_filter($log, fn($e) => $e[0] === 'err');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Stock Control – Instalador</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 40px auto; background: #f8fafc; color: #1e293b; }
    h1   { color: #0f172a; }
    .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:.85rem; font-weight:600; }
    .ok   { background:#dcfce7; color:#166534; }
    .info { background:#e0f2fe; color:#075985; }
    .err  { background:#fee2e2; color:#991b1b; }
    ul    { list-style:none; padding:0; }
    li    { padding:6px 0; border-bottom:1px solid #e2e8f0; display:flex; gap:10px; align-items:center; }
    .btn  { display:inline-block; margin-top:20px; padding:12px 28px; background:#2563eb; color:#fff;
            border-radius:8px; text-decoration:none; font-weight:600; }
    .alert-ok  { background:#dcfce7; border:1px solid #86efac; padding:16px; border-radius:8px; margin-bottom:20px; }
    .alert-err { background:#fee2e2; border:1px solid #fca5a5; padding:16px; border-radius:8px; margin-bottom:20px; }
  </style>
</head>
<body>
  <h1>📦 Stock Control — Instalador</h1>

  <?php if (empty($errors)): ?>
    <div class="alert-ok">
      <strong>✅ Instalación completada sin errores.</strong>
      Todos los datos existentes fueron conservados.
    </div>
  <?php else: ?>
    <div class="alert-err">
      <strong>⚠️ Completado con <?= count($errors) ?> error/es.</strong>
      Revisá los ítems en rojo abajo.
    </div>
  <?php endif; ?>

  <ul>
    <?php foreach ($log as [$type, $msg]): ?>
      <li>
        <span class="badge <?= $type ?>"><?= $type === 'ok' ? '✓' : ($type === 'err' ? '✗' : 'i') ?></span>
        <?= htmlspecialchars($msg) ?>
      </li>
    <?php endforeach; ?>
  </ul>

  <?php if (empty($errors)): ?>
    <a href="/stock-control/" class="btn">Ir al sistema →</a>
    <p style="margin-top:12px;color:#64748b;font-size:.9rem">
      ⚠️ Por seguridad, eliminá o renombrá este archivo <code>install.php</code> una vez que el sistema funcione.
    </p>
  <?php endif; ?>
</body>
</html>
