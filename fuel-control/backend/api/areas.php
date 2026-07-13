<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db     = getDB();
$method = getMethod();
$id     = getId();

if ($method === 'GET') {
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM areas WHERE id = ?');
        $stmt->execute([$id]);
        $r = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$r) jsonError('Área no encontrada', 404);
        jsonResponse($r);
    }
    jsonResponse($db->query('SELECT * FROM areas ORDER BY name')->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'POST') {
    requireAdmin();
    $body = getBody();
    $name = trim($body['name'] ?? '');
    if (!$name) jsonError('El nombre es requerido');
    $stmt = $db->prepare('INSERT INTO areas (name, description) VALUES (?, ?)');
    $stmt->execute([$name, trim($body['description'] ?? '')]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT' && $id) {
    requireAdmin();
    $body = getBody();
    $name = trim($body['name'] ?? '');
    if (!$name) jsonError('El nombre es requerido');
    $stmt = $db->prepare('UPDATE areas SET name=?, description=? WHERE id=?');
    $stmt->execute([$name, trim($body['description'] ?? ''), $id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE' && $id) {
    requireAdmin();
    // Desasociar vehículos
    $db->prepare('UPDATE vehicles SET area_id = NULL WHERE area_id = ?')->execute([$id]);
    $db->prepare('DELETE FROM areas WHERE id = ?')->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Acción no válida', 400);
