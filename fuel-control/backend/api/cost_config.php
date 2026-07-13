<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$method = getMethod();
$db     = getDB();

if ($method === 'GET') {
    // Devuelve la última configuración por vehicle_id
    $stmt = $db->query('
        SELECT cc.*
        FROM cost_config cc
        INNER JOIN (
            SELECT vehicle_id, MAX(id) AS max_id
            FROM cost_config
            GROUP BY vehicle_id
        ) latest ON cc.id = latest.max_id
        ORDER BY cc.vehicle_id
    ');
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAdmin();
    $body                 = getBody();
    $vehicle_id           = isset($body['vehicle_id']) ? (int)$body['vehicle_id'] : 0;
    $insurance_monthly    = isset($body['insurance_monthly']) ? (float)$body['insurance_monthly'] : 0;
    $depreciation_monthly = isset($body['depreciation_monthly']) ? (float)$body['depreciation_monthly'] : 0;
    $maintenance_per_km   = isset($body['maintenance_per_km']) ? (float)$body['maintenance_per_km'] : 0;

    if (!$vehicle_id) jsonError('El vehicle_id es requerido');

    $stmt = $db->prepare('
        INSERT INTO cost_config (vehicle_id, insurance_monthly, depreciation_monthly, maintenance_per_km)
        VALUES (?, ?, ?, ?)
    ');
    $stmt->execute([$vehicle_id, $insurance_monthly, $depreciation_monthly, $maintenance_per_km]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

jsonError('Método no permitido', 405);
