<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Diagnóstico Stock Control</title>
<style>
body{font-family:monospace;max-width:900px;margin:30px auto;padding:20px;background:#f9fafb}
h2{margin-top:24px;border-bottom:2px solid #ccc;padding-bottom:6px}
.ok{color:#16a34a;font-weight:bold}
.err{color:#dc2626;font-weight:bold}
.warn{color:#d97706;font-weight:bold}
pre{background:#1f2937;color:#f9fafb;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:13px}
th{background:#e5e7eb}
</style>
</head>
<body>
<h1>🔧 Diagnóstico del Sistema</h1>

<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

// ── Sesión ──────────────────────────────────────────────────────────────────
session_set_cookie_params(['path' => '/', 'samesite' => 'Lax', 'httponly' => true]);
session_start();
echo "<h2>1. Sesión PHP</h2>";
if (!empty($_SESSION['user'])) {
    $u = $_SESSION['user'];
    echo "<p class='ok'>✓ Sesión activa — usuario: {$u['username']} ({$u['role']})</p>";
} else {
    echo "<p class='warn'>⚠ No hay sesión activa. Logueate en la app primero, luego volvé acá.</p>";
}

// ── Conexión DB ──────────────────────────────────────────────────────────────
echo "<h2>2. Conexión a la Base de Datos</h2>";
try {
    require_once __DIR__ . '/config/database.php';
    $db = getDB();
    echo "<p class='ok'>✓ Conectado correctamente</p>";
} catch (Exception $e) {
    echo "<p class='err'>✗ Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p>Revisá <code>config/database.php</code></p>";
    die();
}

// ── Tablas ───────────────────────────────────────────────────────────────────
echo "<h2>3. Tablas</h2><table><tr><th>Tabla</th><th>Registros</th><th>Estado</th></tr>";
$tables = ['products','product_lots','stock_movements','locations','categories','suppliers','personas','users','dispensas'];
foreach ($tables as $t) {
    try {
        $count = $db->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
        echo "<tr><td>$t</td><td>$count</td><td class='ok'>OK</td></tr>";
    } catch (Exception $e) {
        echo "<tr><td>$t</td><td>—</td><td class='err'>FALTA: " . htmlspecialchars($e->getMessage()) . "</td></tr>";
    }
}
echo "</table>";

// ── Columnas products ────────────────────────────────────────────────────────
echo "<h2>4. Columnas de <code>products</code></h2>";
try {
    $cols = $db->query("SHOW COLUMNS FROM products")->fetchAll(PDO::FETCH_ASSOC);
    echo "<table><tr><th>Campo</th><th>Tipo</th><th>Null</th><th>Default</th></tr>";
    foreach ($cols as $c) {
        echo "<tr><td>{$c['Field']}</td><td>{$c['Type']}</td><td>{$c['Null']}</td><td>{$c['Default']}</td></tr>";
    }
    echo "</table>";
} catch (Exception $e) {
    echo "<p class='err'>" . htmlspecialchars($e->getMessage()) . "</p>";
}

// ── Columnas product_lots ────────────────────────────────────────────────────
echo "<h2>5. Columnas de <code>product_lots</code></h2>";
try {
    $cols = $db->query("SHOW COLUMNS FROM product_lots")->fetchAll(PDO::FETCH_ASSOC);
    echo "<table><tr><th>Campo</th><th>Tipo</th></tr>";
    foreach ($cols as $c) {
        echo "<tr><td>{$c['Field']}</td><td>{$c['Type']}</td></tr>";
    }
    echo "</table>";
} catch (Exception $e) {
    echo "<p class='err'>Tabla product_lots: " . htmlspecialchars($e->getMessage()) . "</p>";
}

// ── Columnas stock_movements ─────────────────────────────────────────────────
echo "<h2>6. Columnas de <code>stock_movements</code></h2>";
try {
    $cols = $db->query("SHOW COLUMNS FROM stock_movements")->fetchAll(PDO::FETCH_ASSOC);
    echo "<table><tr><th>Campo</th><th>Tipo</th></tr>";
    foreach ($cols as $c) {
        echo "<tr><td>{$c['Field']}</td><td>{$c['Type']}</td></tr>";
    }
    echo "</table>";
} catch (Exception $e) {
    echo "<p class='err'>Tabla stock_movements: " . htmlspecialchars($e->getMessage()) . "</p>";
}

// ── Test queries del dashboard ───────────────────────────────────────────────
echo "<h2>7. Test queries del Dashboard</h2>";
$tests = [
    "products.active"        => "SELECT COUNT(*) FROM products WHERE active = 1",
    "products.purchase_price"=> "SELECT COALESCE(SUM(stock * purchase_price), 0) FROM products WHERE active = 1",
    "products JOIN categories"=> "SELECT p.id, c.name FROM products p LEFT JOIN categories c ON p.category_id = c.id LIMIT 1",
    "stock_movements.created_at"=> "SELECT created_at FROM stock_movements LIMIT 1",
    "stock_movements JOIN products"=> "SELECT m.type, p.name FROM stock_movements m JOIN products p ON m.product_id = p.id LIMIT 1",
    "product_lots.expiry_date"=> "SELECT pl.expiry_date, DATEDIFF(pl.expiry_date, CURDATE()) FROM product_lots pl LIMIT 1",
    "product_lots.location_id"=> "SELECT pl.location_id FROM product_lots pl LIMIT 1",
    "product_lots JOIN products"=> "SELECT pl.id, p.name FROM product_lots pl JOIN products p ON pl.product_id = p.id LIMIT 1",
];
echo "<table><tr><th>Query</th><th>Resultado</th></tr>";
foreach ($tests as $label => $sql) {
    try {
        $r = $db->query($sql)->fetchColumn();
        echo "<tr><td>$label</td><td class='ok'>OK" . ($r !== false ? " ($r)" : "") . "</td></tr>";
    } catch (Exception $e) {
        echo "<tr><td>$label</td><td class='err'>ERROR: " . htmlspecialchars($e->getMessage()) . "</td></tr>";
    }
}
echo "</table>";

// ── Versión PHP ──────────────────────────────────────────────────────────────
echo "<h2>8. Entorno</h2>";
echo "<p>PHP: " . phpversion() . "</p>";
echo "<p>MySQL: " . $db->query("SELECT VERSION()")->fetchColumn() . "</p>";
echo "<p>Sesión guardada en: " . session_save_path() . "</p>";

echo "<hr><p style='color:#6b7280;font-size:.85em'>Borrá este archivo (diag.php) cuando termines el diagnóstico.</p>";
?>
</body></html>
