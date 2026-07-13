<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
$user = requireAuth();

$method = getMethod();
$db     = getDB();

if ($method === 'GET') {
    $where  = [];
    $params = [];

    if (!empty($_GET['vehicle_id'])) {
        $where[]  = 'r.vehicle_id = ?';
        $params[] = (int)$_GET['vehicle_id'];
    }
    if (!empty($_GET['driver_id'])) {
        $where[]  = 'r.driver_id = ?';
        $params[] = (int)$_GET['driver_id'];
    }
    if (!empty($_GET['zone_id'])) {
        $where[]  = 'r.zone_id = ?';
        $params[] = (int)$_GET['zone_id'];
    }
    if (!empty($_GET['from'])) {
        $where[]  = 'r.departure_at >= ?';
        $params[] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $where[]  = 'r.departure_at <= ?';
        $params[] = $_GET['to'];
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "
        SELECT
            r.*,
            v.name        AS vehicle_name,
            v.plate       AS vehicle_plate,
            d.name        AS driver_name,
            d.dni         AS driver_dni,
            z.name        AS zone_name,
            u.username    AS user_username,
            ROUND(r.km_end - r.km_start, 1)                                       AS km_recorridos,
            ROUND(TIMESTAMPDIFF(SECOND, r.departure_at, r.arrival_at) / 3600.0, 2) AS horas,
            r.trips_to_dump * 8                                                    AS toneladas
        FROM routes r
        JOIN vehicles v ON v.id = r.vehicle_id
        JOIN drivers  d ON d.id = r.driver_id
        JOIN zones    z ON z.id = r.zone_id
        JOIN users    u ON u.id = r.user_id
        $whereClause
        ORDER BY r.departure_at DESC
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body         = getBody();
    $vehicle_id   = isset($body['vehicle_id'])   ? (int)$body['vehicle_id']      : 0;
    $driver_id    = isset($body['driver_id'])    ? (int)$body['driver_id']       : 0;
    $zone_id      = isset($body['zone_id'])      ? (int)$body['zone_id']         : 0;
    $departure_at = trim($body['departure_at']   ?? '');
    $arrival_at   = trim($body['arrival_at']     ?? '');
    $km_start     = isset($body['km_start'])     ? (float)$body['km_start']      : null;
    $km_end       = isset($body['km_end'])       ? (float)$body['km_end']        : null;
    $fuel_liters  = isset($body['fuel_liters'])  ? (float)$body['fuel_liters']   : null;
    $trips_to_dump = isset($body['trips_to_dump']) ? (int)$body['trips_to_dump'] : 0;
    $notes        = trim($body['notes']          ?? '') ?: null;

    if (!$vehicle_id)   jsonError('El vehicle_id es requerido');
    if (!$driver_id)    jsonError('El driver_id es requerido');
    if (!$zone_id)      jsonError('El zone_id es requerido');
    if (!$departure_at) jsonError('La fecha de salida es requerida');
    if (!$arrival_at)   jsonError('La fecha de llegada es requerida');
    if ($km_start === null) jsonError('El km_start es requerido');
    if ($km_end   === null) jsonError('El km_end es requerido');
    if ($km_end < $km_start) jsonError('km_end debe ser mayor o igual a km_start');

    $stmt = $db->prepare('
        INSERT INTO routes
            (vehicle_id, driver_id, zone_id, user_id, departure_at, arrival_at,
             km_start, km_end, fuel_liters, trips_to_dump, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $vehicle_id, $driver_id, $zone_id, $user['sub'],
        $departure_at, $arrival_at,
        $km_start, $km_end, $fuel_liters, $trips_to_dump, $notes,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    requireAdmin();
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $vehicle_id    = isset($body['vehicle_id'])    ? (int)$body['vehicle_id']      : 0;
    $driver_id     = isset($body['driver_id'])     ? (int)$body['driver_id']       : 0;
    $zone_id       = isset($body['zone_id'])       ? (int)$body['zone_id']         : 0;
    $departure_at  = trim($body['departure_at']    ?? '');
    $arrival_at    = trim($body['arrival_at']      ?? '');
    $km_start      = isset($body['km_start'])      ? (float)$body['km_start']      : null;
    $km_end        = isset($body['km_end'])        ? (float)$body['km_end']        : null;
    $fuel_liters   = isset($body['fuel_liters'])   ? (float)$body['fuel_liters']   : null;
    $trips_to_dump = isset($body['trips_to_dump']) ? (int)$body['trips_to_dump']   : 0;
    $notes         = trim($body['notes']           ?? '') ?: null;

    if (!$vehicle_id)   jsonError('El vehicle_id es requerido');
    if (!$driver_id)    jsonError('El driver_id es requerido');
    if (!$zone_id)      jsonError('El zone_id es requerido');
    if (!$departure_at) jsonError('La fecha de salida es requerida');
    if (!$arrival_at)   jsonError('La fecha de llegada es requerida');
    if ($km_start === null) jsonError('El km_start es requerido');
    if ($km_end   === null) jsonError('El km_end es requerido');
    if ($km_end < $km_start) jsonError('km_end debe ser mayor o igual a km_start');

    $stmt = $db->prepare('
        UPDATE routes SET
            vehicle_id=?, driver_id=?, zone_id=?, departure_at=?, arrival_at=?,
            km_start=?, km_end=?, fuel_liters=?, trips_to_dump=?, notes=?
        WHERE id=?
    ');
    $stmt->execute([
        $vehicle_id, $driver_id, $zone_id, $departure_at, $arrival_at,
        $km_start, $km_end, $fuel_liters, $trips_to_dump, $notes,
        $id,
    ]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('DELETE FROM routes WHERE id=?');
    $stmt->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
