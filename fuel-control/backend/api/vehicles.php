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
    $name = trim($body['name'] ?? '');
    $plate = trim($body['plate'] ?? '');
    $type  = trim($body['type'] ?? 'vehicle');

    if (!$name || !$plate) jsonError('Nombre y patente requeridos');

    $stmt = $db->prepare('INSERT INTO vehicles (name, plate, type, active) VALUES (?, ?, ?, 1)');
    $stmt->execute([$name, $plate, $type]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'name' => $name, 'plate' => $plate, 'type' => $type], 201);
}

if ($method === 'PUT') {
    requireAdmin();
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $name   = trim($body['name'] ?? '');
    $plate  = trim($body['plate'] ?? '');
    $type   = trim($body['type'] ?? 'vehicle');
    $active = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!$name || !$plate) jsonError('Nombre y patente requeridos');

    $stmt = $db->prepare('UPDATE vehicles SET name=?, plate=?, type=?, active=? WHERE id=?');
    $stmt->execute([$name, $plate, $type, $active, $id]);
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
