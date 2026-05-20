<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
requireAuth();

$report = $_GET['report'] ?? '';
$from   = $_GET['from']   ?? date('Y-m-01');
$to     = $_GET['to']     ?? date('Y-m-d');

match ($report) {
    'dispensas'   => reportDispensas($db, $from, $to),
    'movimientos' => reportMovimientos($db, $from, $to, $_GET['type'] ?? ''),
    'stock'       => reportStock($db),
    'stock_bajo'  => reportStockBajo($db),
    default       => jsonError('Reporte no válido. Use: dispensas, movimientos, stock, stock_bajo', 400),
};

function reportDispensas(PDO $db, string $from, string $to): void {
    $stmt = $db->prepare(
        "SELECT m.id, m.created_at, m.quantity,
                p.code AS medicamento_code, p.name AS medicamento_name, p.unit,
                per.documento, per.apellido, per.nombre AS beneficiary_nombre,
                per.barrio, m.reason, m.user
         FROM stock_movements m
         JOIN products p      ON m.product_id     = p.id
         LEFT JOIN personas per ON m.beneficiary_id = per.id
         WHERE m.type = 'dispensa'
           AND DATE(m.created_at) BETWEEN ? AND ?
         ORDER BY m.created_at DESC"
    );
    $stmt->execute([$from, $to]);
    $rows = $stmt->fetchAll();

    $totalUnidades = array_sum(array_column($rows, 'quantity'));
    jsonResponse([
        'rows'          => $rows,
        'total_registros' => count($rows),
        'total_unidades'  => $totalUnidades,
    ]);
}

function reportMovimientos(PDO $db, string $from, string $to, string $type): void {
    $where  = "WHERE DATE(m.created_at) BETWEEN ? AND ?";
    $params = [$from, $to];
    if ($type !== '') { $where .= " AND m.type = ?"; $params[] = $type; }

    $stmt = $db->prepare(
        "SELECT m.id, m.created_at, m.type, m.quantity,
                m.previous_stock, m.new_stock, m.reason, m.reference, m.user,
                p.code AS medicamento_code, p.name AS medicamento_name,
                per.apellido, per.nombre AS beneficiary_nombre, per.documento
         FROM stock_movements m
         JOIN products p          ON m.product_id     = p.id
         LEFT JOIN personas per   ON m.beneficiary_id = per.id
         $where
         ORDER BY m.created_at DESC"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    jsonResponse(['rows' => $rows, 'total' => count($rows)]);
}

function reportStock(PDO $db): void {
    $stmt = $db->query(
        "SELECT p.code, p.name, p.unit, p.stock, p.min_stock,
                c.name AS categoria,
                CASE
                    WHEN p.stock = 0        THEN 'sin_stock'
                    WHEN p.stock <= p.min_stock THEN 'stock_bajo'
                    ELSE 'ok'
                END AS estado
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.active = 1
         ORDER BY p.name"
    );
    $rows = $stmt->fetchAll();
    $sinStock  = count(array_filter($rows, fn($r) => $r['estado'] === 'sin_stock'));
    $stockBajo = count(array_filter($rows, fn($r) => $r['estado'] === 'stock_bajo'));
    jsonResponse(['rows' => $rows, 'sin_stock' => $sinStock, 'stock_bajo' => $stockBajo]);
}

function reportStockBajo(PDO $db): void {
    $stmt = $db->query(
        "SELECT p.code, p.name, p.unit, p.stock, p.min_stock,
                c.name AS categoria
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.active = 1 AND p.stock <= p.min_stock
         ORDER BY p.stock ASC, p.name"
    );
    jsonResponse(['rows' => $stmt->fetchAll()]);
}
