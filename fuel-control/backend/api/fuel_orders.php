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
    $status     = $_GET['status'] ?? null;

    if ($id) {
        $stmt = $db->prepare('
            SELECT fo.*, v.name AS vehicle_name, v.plate, u.username AS requested_by
            FROM fuel_orders fo
            JOIN vehicles v ON v.id = fo.vehicle_id
            JOIN users u ON u.id = fo.user_id
            WHERE fo.id = ?
        ');
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        if (!$r) jsonError('Orden no encontrada', 404);
        jsonResponse($r);
    }

    $where  = [];
    $params = [];

    if ($vehicle_id) { $where[] = 'fo.vehicle_id = ?'; $params[] = $vehicle_id; }
    if ($status)     { $where[] = 'fo.status = ?';     $params[] = $status; }
    if ($from)       { $where[] = 'fo.ordered_at >= ?'; $params[] = $from . ' 00:00:00'; }
    if ($to)         { $where[] = 'fo.ordered_at <= ?'; $params[] = $to   . ' 23:59:59'; }

    $whereStr = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare("
        SELECT fo.*, v.name AS vehicle_name, v.plate, u.username AS requested_by
        FROM fuel_orders fo
        JOIN vehicles v ON v.id = fo.vehicle_id
        JOIN users u ON u.id = fo.user_id
        $whereStr
        ORDER BY fo.ordered_at DESC
    ");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body            = getBody();
    $vehicle_id      = (int)($body['vehicle_id'] ?? 0);
    $fuel_type       = trim($body['fuel_type'] ?? '');
    $liters_requested = (float)($body['liters_requested'] ?? 0);
    $driver_name     = trim($body['driver_name'] ?? '');
    $notes           = trim($body['notes'] ?? '');

    if (!$vehicle_id || $liters_requested <= 0 || !$fuel_type || !$driver_name) {
        jsonError('Vehículo, tipo de combustible, litros y conductor son requeridos');
    }

    $stmt = $db->prepare('
        INSERT INTO fuel_orders (vehicle_id, user_id, fuel_type, liters_requested, driver_name, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $vehicle_id, $user['sub'], $fuel_type, $liters_requested, $driver_name,
        $notes ?: null
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    requireAdmin();
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $vehicle_id       = (int)($body['vehicle_id'] ?? 0);
    $fuel_type        = trim($body['fuel_type'] ?? '');
    $liters_requested = (float)($body['liters_requested'] ?? 0);
    $driver_name      = trim($body['driver_name'] ?? '');
    $notes            = trim($body['notes'] ?? '');
    $status           = $body['status'] ?? 'pendiente';

    if (!$vehicle_id || $liters_requested <= 0 || !$fuel_type || !$driver_name) {
        jsonError('Vehículo, tipo de combustible, litros y conductor son requeridos');
    }

    $validStatuses = ['pendiente', 'completada', 'cancelada'];
    if (!in_array($status, $validStatuses, true)) {
        jsonError('Estado inválido. Valores permitidos: ' . implode(', ', $validStatuses));
    }

    $stmt = $db->prepare('
        UPDATE fuel_orders
        SET vehicle_id = ?, fuel_type = ?, liters_requested = ?, driver_name = ?, notes = ?, status = ?
        WHERE id = ?
    ');
    $stmt->execute([
        $vehicle_id, $fuel_type, $liters_requested, $driver_name,
        $notes ?: null, $status, $id
    ]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('DELETE FROM fuel_orders WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
