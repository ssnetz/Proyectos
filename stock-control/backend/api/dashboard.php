<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db = getDB();

try {

// ─── Estadísticas globales ───────────────────────────────────────────────────

$totalProducts  = $db->query("SELECT COUNT(*) FROM products WHERE active = 1")->fetchColumn();
$totalSuppliers = $db->query("SELECT COUNT(*) FROM suppliers")->fetchColumn();
$totalLocations = $db->query("SELECT COUNT(*) FROM locations WHERE active = 1")->fetchColumn();

$stockValue = $db->query(
    "SELECT COALESCE(SUM(ps.quantity * p.purchase_price), 0)
     FROM product_stock ps
     JOIN products p ON ps.product_id = p.id
     WHERE p.active = 1"
)->fetchColumn();

// Productos con stock bajo (total consolidado <= min_stock)
$lowStockCount = $db->query(
    "SELECT COUNT(*) FROM (
         SELECT p.id
         FROM products p
         LEFT JOIN product_stock ps ON p.id = ps.product_id
         WHERE p.active = 1
         GROUP BY p.id, p.min_stock
         HAVING COALESCE(SUM(ps.quantity), 0) <= p.min_stock
     ) t"
)->fetchColumn();

$outOfStock = $db->query(
    "SELECT COUNT(*) FROM (
         SELECT p.id
         FROM products p
         LEFT JOIN product_stock ps ON p.id = ps.product_id
         WHERE p.active = 1
         GROUP BY p.id, p.min_stock
         HAVING COALESCE(SUM(ps.quantity), 0) = 0
     ) t"
)->fetchColumn();

// ─── Stock bajo por producto (consolidado) ───────────────────────────────────

$lowStockProducts = $db->query(
    "SELECT p.id, p.code, p.name, p.min_stock,
            c.name AS category_name,
            COALESCE(SUM(ps.quantity), 0) AS stock_total
     FROM products p
     LEFT JOIN categories    c  ON p.category_id  = c.id
     LEFT JOIN product_stock ps ON p.id = ps.product_id
     WHERE p.active = 1
     GROUP BY p.id, p.code, p.name, p.min_stock, c.name
     HAVING COALESCE(SUM(ps.quantity), 0) <= p.min_stock
     ORDER BY stock_total ASC
     LIMIT 10"
)->fetchAll();

// ─── Stock por ubicación ─────────────────────────────────────────────────────

$stockByLocation = $db->query(
    "SELECT l.id, l.name, l.type,
            COUNT(DISTINCT ps.product_id)         AS product_count,
            COALESCE(SUM(ps.quantity), 0)          AS total_units,
            SUM(ps.quantity <= ps.min_stock)       AS low_stock_count
     FROM locations l
     LEFT JOIN product_stock ps ON l.id = ps.location_id
     WHERE l.active = 1
     GROUP BY l.id, l.name, l.type
     ORDER BY FIELD(l.type,'farmacia','guardia','dispensario'), l.name"
)->fetchAll();

// ─── Últimos movimientos ─────────────────────────────────────────────────────

$recentMovements = $db->query(
    "SELECT m.type, m.quantity, m.created_at,
            p.name AS product_name,
            lf.name AS location_name,
            lt.name AS to_location_name
     FROM stock_movements m
     JOIN products  p  ON m.product_id  = p.id
     LEFT JOIN locations lf ON m.location_id    = lf.id
     LEFT JOIN locations lt ON m.to_location_id = lt.id
     ORDER BY m.created_at DESC
     LIMIT 8"
)->fetchAll();

// ─── Movimientos últimos 7 días ──────────────────────────────────────────────

$movementsByDay = $db->query(
    "SELECT DATE(created_at) AS day,
            SUM(CASE WHEN type='entrada'       THEN quantity ELSE 0 END) AS entradas,
            SUM(CASE WHEN type='salida'        THEN quantity ELSE 0 END) AS salidas,
            SUM(CASE WHEN type='transferencia' THEN quantity ELSE 0 END) AS transferencias
     FROM stock_movements
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at)
     ORDER BY day"
)->fetchAll();

// ─── Vencimientos próximos ───────────────────────────────────────────────────

$expiringSoon = $db->query(
    "SELECT COUNT(*) FROM product_lots
     WHERE quantity > 0
       AND expiration_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)"
)->fetchColumn();

$expiringWarning = $db->query(
    "SELECT COUNT(*) FROM product_lots
     WHERE quantity > 0
       AND expiration_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)"
)->fetchColumn();

$expiredCount = $db->query(
    "SELECT COUNT(*) FROM product_lots
     WHERE quantity > 0 AND expiration_date < CURDATE()"
)->fetchColumn();

$expiringProducts = $db->query(
    "SELECT p.code, p.name, l.name AS location_name,
            pl.lot_number, pl.expiration_date, pl.quantity,
            DATEDIFF(pl.expiration_date, CURDATE()) AS days_until_expiry
     FROM product_lots pl
     JOIN products  p ON pl.product_id  = p.id
     JOIN locations l ON pl.location_id = l.id
     WHERE pl.quantity > 0
       AND pl.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
     ORDER BY pl.expiration_date ASC
     LIMIT 10"
)->fetchAll();

jsonResponse([
    'stats' => [
        'total_products'   => (int)$totalProducts,
        'total_suppliers'  => (int)$totalSuppliers,
        'total_locations'  => (int)$totalLocations,
        'low_stock_count'  => (int)$lowStockCount,
        'out_of_stock'     => (int)$outOfStock,
        'stock_value'      => (float)$stockValue,
        'expiring_soon'    => (int)$expiringSoon,
        'expiring_warning' => (int)$expiringWarning,
        'expired_count'    => (int)$expiredCount,
    ],
    'stock_by_location'  => $stockByLocation,
    'low_stock_products' => $lowStockProducts,
    'expiring_products'  => $expiringProducts,
    'recent_movements'   => $recentMovements,
    'movements_by_day'   => $movementsByDay,
]);

} catch (Exception $e) {
    jsonError('Error en dashboard: ' . $e->getMessage(), 500);
}
