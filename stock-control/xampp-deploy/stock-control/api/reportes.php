<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db   = getDB();
$type = $_GET['type'] ?? '';

match ($type) {
    'stock'       => reportStock($db),
    'vencimientos'=> reportVencimientos($db),
    'dispensas'   => reportDispensas($db),
    'movimientos' => reportMovimientos($db),
    default       => jsonError('Tipo de reporte inválido. Use: stock, vencimientos, dispensas, movimientos'),
};

function hasPriceCols(PDO $db): bool {
    static $has = null;
    if ($has !== null) return $has;
    try { $db->query("SELECT purchase_price FROM products LIMIT 0"); $has = true; }
    catch (Exception $e) { $has = false; }
    return $has;
}

function reportStock(PDO $db): void {
    $price = hasPriceCols($db) ? "p.purchase_price, p.sale_price, (p.stock * p.purchase_price) AS stock_value,"
                              : "0 AS purchase_price, 0 AS sale_price, 0 AS stock_value,";
    $stmt = $db->prepare(
        "SELECT p.id, p.code, p.name, p.therapeutic_action, p.stock, p.min_stock, p.unit,
                $price
                c.name AS category_name, s.name AS supplier_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN suppliers  s ON p.supplier_id  = s.id
         WHERE p.active = 1
         ORDER BY c.name, p.name"
    );
    $stmt->execute();
    jsonResponse($stmt->fetchAll());
}

function reportVencimientos(PDO $db): void {
    $days = (int)($_GET['days'] ?? 30);

    $stmt = $db->prepare(
        "SELECT pl.id, pl.lot_number, pl.expiration_date AS expiry_date, pl.quantity,
                p.name AS product_name, p.code AS product_code, p.unit,
                l.name AS location_name,
                DATEDIFF(pl.expiration_date, CURDATE()) AS days_left
         FROM product_lots pl
         JOIN products p ON pl.product_id = p.id
         LEFT JOIN locations l ON pl.location_id = l.id
         WHERE pl.expiration_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
           AND pl.quantity > 0
         ORDER BY pl.expiration_date ASC"
    );
    $stmt->execute([$days]);
    jsonResponse($stmt->fetchAll());
}

function reportDispensas(PDO $db): void {
    $from = $_GET['from'] ?? date('Y-m-01');
    $to   = $_GET['to']   ?? date('Y-m-d');

    // List of dispensas
    $stmt = $db->prepare(
        "SELECT
             sm.reference,
             sm.beneficiary_id,
             p.tipo_documento, p.documento, p.apellido, p.nombre,
             MIN(sm.created_at)  AS fecha,
             COUNT(sm.id)        AS total_items,
             SUM(sm.quantity)    AS total_unidades,
             sm.user             AS operador,
             l.name              AS location_name,
             MIN(sm.reason)      AS observaciones
         FROM stock_movements sm
         JOIN personas p ON sm.beneficiary_id = p.id
         LEFT JOIN locations l ON sm.location_id = l.id
         WHERE sm.type = 'dispensa'
           AND DATE(sm.created_at) BETWEEN ? AND ?
         GROUP BY sm.reference, sm.beneficiary_id, sm.user, sm.location_id
         ORDER BY MIN(sm.created_at) DESC"
    );
    $stmt->execute([$from, $to]);
    $dispensas = $stmt->fetchAll();

    // Attach items to each dispensa
    foreach ($dispensas as &$d) {
        $s = $db->prepare(
            "SELECT sm.product_id, sm.quantity AS cantidad,
                    pr.name AS product_name, pr.code AS product_code, pr.unit
             FROM stock_movements sm
             JOIN products pr ON sm.product_id = pr.id
             WHERE sm.reference = ? AND sm.type = 'dispensa'
             ORDER BY sm.id"
        );
        $s->execute([$d['reference']]);
        $d['items'] = $s->fetchAll();
    }
    unset($d);

    jsonResponse($dispensas);
}

function reportMovimientos(PDO $db): void {
    $from      = $_GET['from']       ?? date('Y-m-01');
    $to        = $_GET['to']         ?? date('Y-m-d');
    $productId = $_GET['product_id'] ?? null;

    $sql = "SELECT m.id, m.type, m.quantity, m.previous_stock, m.new_stock,
                   m.reason, m.reference, m.user, m.created_at,
                   p.name AS product_name, p.code AS product_code, p.unit
            FROM stock_movements m
            JOIN products p ON m.product_id = p.id
            WHERE DATE(m.created_at) BETWEEN ? AND ?";
    $params = [$from, $to];

    if ($productId) {
        $sql .= " AND m.product_id = ?";
        $params[] = (int)$productId;
    }

    $sql .= " ORDER BY m.created_at DESC LIMIT 2000";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}
