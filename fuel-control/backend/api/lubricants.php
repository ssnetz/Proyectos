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
            SELECT l.*, v.name AS vehicle_name, v.plate, u.username AS loaded_by
            FROM lubricants l
            JOIN vehicles v ON v.id = l.vehicle_id
            JOIN users u ON u.id = l.user_id
            WHERE l.id = ?
        ');
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        if (!$r) jsonError('Registro no encontrado', 404);
        jsonResponse($r);
    }

    $where  = [];
    $params = [];

    if ($vehicle_id) { $where[] = 'l.vehicle_id = ?'; $params[] = $vehicle_id; }
    if ($from)       { $where[] = 'l.applied_at >= ?'; $params[] = $from . ' 00:00:00'; }
    if ($to)         { $where[] = 'l.applied_at <= ?'; $params[] = $to   . ' 23:59:59'; }

    $whereStr = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare("
        SELECT l.*, v.name AS vehicle_name, v.plate, u.username AS loaded_by
        FROM lubricants l
        JOIN vehicles v ON v.id = l.vehicle_id
        JOIN users u ON u.id = l.user_id
        $whereStr
        ORDER BY l.applied_at DESC
    ");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body         = getBody();
    $vehicle_id   = (int)($body['vehicle_id'] ?? 0);
    $type         = trim($body['type'] ?? '');
    $brand        = trim($body['brand'] ?? '');
    $quantity     = (float)($body['quantity'] ?? 0);
    $unit         = trim($body['unit'] ?? 'litros');
    $km_recorridos = isset($body['km_recorridos']) ? (float)$body['km_recorridos'] : null;
    $notes        = trim($body['notes'] ?? '');
    $applied_at   = $body['applied_at'] ?? date('Y-m-d H:i:s');

    if (!$vehicle_id || !$type || $quantity <= 0) jsonError('Vehículo, tipo y cantidad son requeridos');

    $stmt = $db->prepare('
        INSERT INTO lubricants (vehicle_id, user_id, type, brand, quantity, unit, km_recorridos, notes, applied_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $vehicle_id, $user['sub'], $type, $brand ?: null, $quantity, $unit,
        $km_recorridos, $notes ?: null, $applied_at
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $vehicle_id    = (int)($body['vehicle_id'] ?? 0);
    $type          = trim($body['type'] ?? '');
    $brand         = trim($body['brand'] ?? '');
    $quantity      = (float)($body['quantity'] ?? 0);
    $unit          = trim($body['unit'] ?? 'litros');
    $km_recorridos = isset($body['km_recorridos']) ? (float)$body['km_recorridos'] : null;
    $notes         = trim($body['notes'] ?? '');
    $applied_at    = $body['applied_at'] ?? date('Y-m-d H:i:s');

    if (!$vehicle_id || !$type || $quantity <= 0) jsonError('Vehículo, tipo y cantidad son requeridos');

    $stmt = $db->prepare('
        UPDATE lubricants SET vehicle_id=?, type=?, brand=?, quantity=?, unit=?,
        km_recorridos=?, notes=?, applied_at=?
        WHERE id=?
    ');
    $stmt->execute([
        $vehicle_id, $type, $brand ?: null, $quantity, $unit,
        $km_recorridos, $notes ?: null, $applied_at, $id
    ]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('DELETE FROM lubricants WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
