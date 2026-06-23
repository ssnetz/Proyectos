<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
$user = requireAuth();

$method = getMethod();
$db     = getDB();

if ($method === 'GET') {
    $id         = getId();
    $vehicle_id = isset($_GET['vehicle_id']) ? (int)$_GET['vehicle_id'] : null;
    $from       = $_GET['from'] ?? null;
    $to         = $_GET['to'] ?? null;

    if ($id) {
        $stmt = $db->prepare('
            SELECT f.*, v.name AS vehicle_name, v.plate, u.username AS loaded_by
            FROM fueling f
            JOIN vehicles v ON v.id = f.vehicle_id
            JOIN users u ON u.id = f.user_id
            WHERE f.id = ?
        ');
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        if (!$r) jsonError('Registro no encontrado', 404);
        jsonResponse($r);
    }

    $where  = [];
    $params = [];

    if ($vehicle_id) { $where[] = 'f.vehicle_id = ?'; $params[] = $vehicle_id; }
    if ($from)       { $where[] = 'f.fueled_at >= ?'; $params[] = $from . ' 00:00:00'; }
    if ($to)         { $where[] = 'f.fueled_at <= ?'; $params[] = $to   . ' 23:59:59'; }

    $whereStr = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare("
        SELECT f.*, v.name AS vehicle_name, v.plate, u.username AS loaded_by
        FROM fueling f
        JOIN vehicles v ON v.id = f.vehicle_id
        JOIN users u ON u.id = f.user_id
        $whereStr
        ORDER BY f.fueled_at DESC
    ");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body       = getBody();
    $vehicle_id   = (int)($body['vehicle_id'] ?? 0);
    $liters       = (float)($body['liters'] ?? 0);
    $km_recorridos = isset($body['km_recorridos']) ? (float)$body['km_recorridos'] : null;
    $price_per_l  = isset($body['price_per_liter']) ? (float)$body['price_per_liter'] : null;
    $fuel_type    = trim($body['fuel_type'] ?? 'Diesel 500');
    $station    = trim($body['station'] ?? '');
    $notes      = trim($body['notes'] ?? '');
    $fueled_at  = $body['fueled_at'] ?? date('Y-m-d H:i:s');

    if (!$vehicle_id || $liters <= 0) jsonError('Vehículo y litros son requeridos');

    $total_cost = ($price_per_l && $liters) ? round($price_per_l * $liters, 2) : null;

    $stmt = $db->prepare('
        INSERT INTO fueling (vehicle_id, user_id, liters, km_recorridos, price_per_liter, total_cost, fuel_type, station, notes, fueled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $vehicle_id, $user['sub'], $liters, $km_recorridos, $price_per_l, $total_cost,
        $fuel_type, $station, $notes, $fueled_at
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $vehicle_id    = (int)($body['vehicle_id'] ?? 0);
    $liters        = (float)($body['liters'] ?? 0);
    $km_recorridos = isset($body['km_recorridos']) ? (float)$body['km_recorridos'] : null;
    $price_per_l   = isset($body['price_per_liter']) ? (float)$body['price_per_liter'] : null;
    $fuel_type     = trim($body['fuel_type'] ?? 'Diesel 500');
    $station       = trim($body['station'] ?? '');
    $notes         = trim($body['notes'] ?? '');
    $fueled_at     = $body['fueled_at'] ?? date('Y-m-d H:i:s');
    $total_cost    = ($price_per_l && $liters) ? round($price_per_l * $liters, 2) : null;

    if (!$vehicle_id || $liters <= 0) jsonError('Vehículo y litros son requeridos');

    $stmt = $db->prepare('
        UPDATE fueling SET vehicle_id=?, liters=?, km_recorridos=?, price_per_liter=?,
        total_cost=?, fuel_type=?, station=?, notes=?, fueled_at=?
        WHERE id=?
    ');
    $stmt->execute([$vehicle_id, $liters, $km_recorridos, $price_per_l, $total_cost,
        $fuel_type, $station, $notes, $fueled_at, $id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('DELETE FROM fueling WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
