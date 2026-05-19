<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db     = getDB();
$method = getMethod();

match($method) {
    'GET' => listLots($db),
    default => jsonError('Método no permitido', 405),
};

function listLots(PDO $db): void {
    $productId  = $_GET['product_id']  ?? null;
    $locationId = $_GET['location_id'] ?? null;

    $sql = "SELECT pl.id, pl.product_id, pl.location_id,
                   pl.lot_number, pl.expiration_date, pl.quantity,
                   pl.created_at, pl.updated_at,
                   p.name AS product_name, p.code AS product_code, p.unit,
                   l.name AS location_name,
                   DATEDIFF(pl.expiration_date, CURDATE()) AS days_until_expiry
            FROM product_lots pl
            JOIN products  p ON pl.product_id  = p.id
            JOIN locations l ON pl.location_id = l.id
            WHERE pl.quantity > 0";
    $params = [];

    if ($productId) {
        $sql .= " AND pl.product_id = ?";
        $params[] = $productId;
    }
    if ($locationId) {
        $sql .= " AND pl.location_id = ?";
        $params[] = $locationId;
    }

    $sql .= " ORDER BY pl.expiration_date ASC, pl.created_at ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}
