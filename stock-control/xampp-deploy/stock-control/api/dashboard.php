<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db = getDB();

$totalProducts  = $db->query("SELECT COUNT(*) FROM products WHERE active = 1")->fetchColumn();
$lowStockCount  = $db->query("SELECT COUNT(*) FROM products WHERE active = 1 AND stock <= min_stock")->fetchColumn();
$outOfStock     = $db->query("SELECT COUNT(*) FROM products WHERE active = 1 AND stock = 0")->fetchColumn();
$totalSuppliers = $db->query("SELECT COUNT(*) FROM suppliers")->fetchColumn();

$stockValue = $db->query(
    "SELECT COALESCE(SUM(stock * purchase_price), 0) FROM products WHERE active = 1"
)->fetchColumn();

$lowStockProducts = $db->query(
    "SELECT p.id, p.code, p.name, p.stock, p.min_stock, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.active = 1 AND p.stock <= p.min_stock
     ORDER BY p.stock ASC
     LIMIT 10"
)->fetchAll();

$recentMovements = $db->query(
    "SELECT m.type, m.quantity, m.created_at, p.name AS product_name
     FROM stock_movements m
     JOIN products p ON m.product_id = p.id
     ORDER BY m.created_at DESC
     LIMIT 8"
)->fetchAll();

$movementsByDay = $db->query(
    "SELECT DATE(created_at) AS day,
            SUM(CASE WHEN type='entrada' THEN quantity ELSE 0 END) AS entradas,
            SUM(CASE WHEN type='salida'  THEN quantity ELSE 0 END) AS salidas
     FROM stock_movements
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at)
     ORDER BY day"
)->fetchAll();

$expiringSoon = $db->query(
    "SELECT pl.id, pl.lot_number, pl.expiry_date, pl.quantity,
            p.name AS product_name,
            DATEDIFF(pl.expiry_date, CURDATE()) AS days_left
     FROM product_lots pl
     JOIN products p ON pl.product_id = p.id
     WHERE pl.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       AND pl.quantity > 0
     ORDER BY pl.expiry_date ASC
     LIMIT 20"
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
    'expiring_soon'      => $expiringSoon,
]);
