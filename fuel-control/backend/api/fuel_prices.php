<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
$user = requireAuth();

$method = getMethod();
$db     = getDB();

if ($method === 'GET') {
    // Cargar tipos desde la tabla fuel_types
    $typesStmt = $db->query('SELECT name FROM fuel_types WHERE active = 1 ORDER BY name');
    $fuelTypes = $typesStmt->fetchAll(PDO::FETCH_COLUMN);

    // Trae el precio vigente (último) de cada tipo
    $rows = [];
    foreach ($fuelTypes as $type) {
        $stmt = $db->prepare('
            SELECT fp.*, u.username
            FROM fuel_prices fp
            JOIN users u ON u.id = fp.user_id
            WHERE fp.fuel_type = ?
            ORDER BY fp.created_at DESC
            LIMIT 1
        ');
        $stmt->execute([$type]);
        $row = $stmt->fetch();
        $rows[] = $row ?: ['fuel_type' => $type, 'price' => null, 'created_at' => null, 'username' => null];
    }
    jsonResponse($rows);
}

if ($method === 'POST') {
    $body      = getBody();
    $fuel_type = trim($body['fuel_type'] ?? '');
    $price     = isset($body['price']) ? (float)$body['price'] : 0;

    // Validar contra tipos activos en BD
    $typesStmt = $db->query('SELECT name FROM fuel_types WHERE active = 1');
    $validTypes = $typesStmt->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array($fuel_type, $validTypes)) jsonError('Tipo de combustible inválido');
    if ($price <= 0) jsonError('El precio debe ser mayor a cero');

    $stmt = $db->prepare('INSERT INTO fuel_prices (fuel_type, price, user_id) VALUES (?, ?, ?)');
    $stmt->execute([$fuel_type, $price, $user['sub']]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

// Historial de precios de un tipo
if ($method === 'GET') {
    jsonResponse([]);
}

jsonError('Método no permitido', 405);
