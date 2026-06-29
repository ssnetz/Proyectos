<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$method = getMethod();
$db     = getDB();

if ($method === 'GET') {
    $id = getId();
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM vehicles WHERE id = ?');
        $stmt->execute([$id]);
        $v = $stmt->fetch();
        if (!$v) jsonError('Vehículo no encontrado', 404);
        jsonResponse($v);
    }
    $stmt = $db->query('SELECT * FROM vehicles ORDER BY name');
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAdmin();
    $body = getBody();
    $name          = trim($body['name'] ?? '');
    $plate         = trim($body['plate'] ?? '');
    $type          = trim($body['type'] ?? 'vehicle');
    $tank_capacity = isset($body['tank_capacity']) && $body['tank_capacity'] !== '' ? (float)$body['tank_capacity'] : null;
    $km_per_liter  = isset($body['km_per_liter'])  && $body['km_per_liter']  !== '' ? (float)$body['km_per_liter']  : null;

    if (!$name || !$plate) jsonError('Nombre y patente requeridos');

    $stmt = $db->prepare('INSERT INTO vehicles (name, plate, type, tank_capacity, km_per_liter, active) VALUES (?, ?, ?, ?, ?, 1)');
    $stmt->execute([$name, $plate, $type, $tank_capacity, $km_per_liter]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
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
    $active        = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!$name || !$plate) jsonError('Nombre y patente requeridos');

    $stmt = $db->prepare('UPDATE vehicles SET name=?, plate=?, type=?, tank_capacity=?, km_per_liter=?, active=? WHERE id=?');
    $stmt->execute([$name, $plate, $type, $tank_capacity, $km_per_liter, $active, $id]);
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
