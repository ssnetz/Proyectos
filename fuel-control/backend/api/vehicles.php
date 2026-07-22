<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$method = getMethod();
$db     = getDB();
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
    $id = getId();
    if ($id) {
        $stmt = $db->prepare('
            SELECT v.*, a.name AS area_name
            FROM vehicles v
            LEFT JOIN areas a ON a.id = v.area_id
            WHERE v.id = ?
        ');
        $stmt->execute([$id]);
        $v = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$v) jsonError('Vehículo no encontrado', 404);
        jsonResponse($v);
    }
    $stmt = $db->query('
        SELECT v.*, a.name AS area_name
        FROM vehicles v
        LEFT JOIN areas a ON a.id = v.area_id
        ORDER BY v.name
    ');
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'POST') {
    requireAdmin();
    $body = getBody();
    $name          = trim($body['name'] ?? '');
    $plate         = trim($body['plate'] ?? '');
    $type          = trim($body['type'] ?? 'vehicle');
    $tank_capacity = isset($body['tank_capacity']) && $body['tank_capacity'] !== '' ? (float)$body['tank_capacity'] : null;
    $km_per_liter  = isset($body['km_per_liter'])  && $body['km_per_liter']  !== '' ? (float)$body['km_per_liter']  : null;
    $area_id       = isset($body['area_id'])        && $body['area_id']       !== '' ? (int)$body['area_id']         : null;

    if (!$name || !$plate) jsonError('Nombre y patente requeridos');

    $stmt = $db->prepare('INSERT INTO vehicles (name, plate, type, tank_capacity, km_per_liter, area_id, active) VALUES (?, ?, ?, ?, ?, ?, 1)');
    $stmt->execute([$name, $plate, $type, $tank_capacity, $km_per_liter, $area_id]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

// Recalibrar a mano el nivel estimado de tanque (ver ajustarNivelTanque en
// helpers.php), para cuando la estimación se desvió de la realidad.
if ($method === 'PUT' && $action === 'set_level') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('SELECT tank_capacity FROM vehicles WHERE id = ?');
    $stmt->execute([$id]);
    $tankCapacity = (float)($stmt->fetchColumn() ?: 0);
    if (!$tankCapacity) jsonError('El vehículo no tiene capacidad de tanque configurada');

    $body  = getBody();
    $nivel = isset($body['fuel_level_liters']) ? (float)$body['fuel_level_liters'] : null;
    if ($nivel === null || $nivel < 0) jsonError('Nivel inválido');
    $nivel = min($nivel, $tankCapacity);

    $upd = $db->prepare('UPDATE vehicles SET fuel_level_liters = ?, fuel_level_updated_at = NOW() WHERE id = ?');
    $upd->execute([$nivel, $id]);
    jsonResponse(['ok' => true, 'fuel_level_liters' => $nivel]);
}

if ($method === 'PUT') {
    requireAdmin();
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $name          = trim($body['name'] ?? '');
    $plate         = trim($body['plate'] ?? '');
    $type          = trim($body['type'] ?? 'vehicle');
    $tank_capacity = isset($body['tank_capacity']) && $body['tank_capacity'] !== '' ? (float)$body['tank_capacity'] : null;
    $km_per_liter  = isset($body['km_per_liter'])  && $body['km_per_liter']  !== '' ? (float)$body['km_per_liter']  : null;
    $area_id       = isset($body['area_id'])        && $body['area_id']       !== '' ? (int)$body['area_id']         : null;
    $active        = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!$name || !$plate) jsonError('Nombre y patente requeridos');

    $stmt = $db->prepare('UPDATE vehicles SET name=?, plate=?, type=?, tank_capacity=?, km_per_liter=?, area_id=?, active=? WHERE id=?');
    $stmt->execute([$name, $plate, $type, $tank_capacity, $km_per_liter, $area_id, $active, $id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('UPDATE vehicles SET active=0 WHERE id=?');
    $stmt->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
