<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db = getDB();

// ─── Stats ───────────────────────────────────────────────────────────────────
$totalProducts = $db->query(
    "SELECT COUNT(*) FROM medicamentos WHERE activo = 1"
)->fetchColumn();

$lowStockCount = $db->query(
    "SELECT COUNT(DISTINCT sl.id_medicamento)
     FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1 AND sl.cantidad_existente <= sl.stock_minimo AND sl.cantidad_existente > 0"
)->fetchColumn();

$outOfStock = $db->query(
    "SELECT COUNT(DISTINCT sl.id_medicamento)
     FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1 AND sl.cantidad_existente = 0"
)->fetchColumn();

$totalSuppliers = $db->query("SELECT COUNT(*) FROM proveedores")->fetchColumn();

$stockValue = $db->query(
    "SELECT COALESCE(SUM(sl.cantidad_existente * sl.precio_costo), 0)
     FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1"
)->fetchColumn();

// ─── Low stock products (old field names for React) ──────────────────────────
$lowStockProducts = $db->query(
    "SELECT
         sl.id_stock       AS id,
         CONCAT('LOT-', LPAD(m.id_medicamento,3,'0')) AS code,
         m.nombre_comercial AS name,
         sl.cantidad_existente AS stock,
         sl.stock_minimo   AS min_stock,
         ct.nombre         AS category_name
     FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     LEFT JOIN categorias_terapeuticas ct ON m.id_categoria = ct.id
     WHERE m.activo = 1 AND sl.cantidad_existente <= sl.stock_minimo
     ORDER BY sl.cantidad_existente ASC
     LIMIT 10"
)->fetchAll();

// ─── Recent movements (old field names for React) ────────────────────────────
$recentMovements = $db->query(
    "SELECT mv.tipo AS type, mv.cantidad AS quantity, mv.created_at,
            m.nombre_comercial AS product_name
     FROM movimientos_stock mv
     JOIN medicamentos m ON mv.id_medicamento = m.id_medicamento
     ORDER BY mv.created_at DESC
     LIMIT 8"
)->fetchAll();

// ─── Movements by day ────────────────────────────────────────────────────────
$movementsByDay = $db->query(
    "SELECT DATE(created_at) AS day,
            SUM(CASE WHEN tipo='entrada' THEN cantidad ELSE 0 END) AS entradas,
            SUM(CASE WHEN tipo='salida'  THEN cantidad ELSE 0 END) AS salidas
     FROM movimientos_stock
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at)
     ORDER BY day"
)->fetchAll();

jsonResponse([
    'stats' => [
        'total_products'  => (int)$totalProducts,
        'low_stock_count' => (int)$lowStockCount,
        'out_of_stock'    => (int)$outOfStock,
        'total_suppliers' => (int)$totalSuppliers,
        'stock_value'     => (float)$stockValue,
    ],
    'low_stock_products' => $lowStockProducts,
    'recent_movements'   => $recentMovements,
    'movements_by_day'   => $movementsByDay,
]);
