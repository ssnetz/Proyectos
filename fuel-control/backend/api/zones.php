<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$method = getMethod();
$db     = getDB();

if ($method === 'GET') {
    $all = isset($_GET['all']) && $_GET['all'] == '1';
    if ($all) {
        $stmt = $db->query('SELECT * FROM zones ORDER BY name');
    } else {
        $stmt = $db->query('SELECT * FROM zones WHERE active = 1 ORDER BY name');
    }
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAdmin();
    $body   = getBody();
    $name   = trim($body['name'] ?? '');
    $active = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!$name) jsonError('El nombre es requerido');

    $stmt = $db->prepare('INSERT INTO zones (name, active) VALUES (?, ?)');
    $stmt->execute([$name, $active]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'name' => $name, 'active' => $active], 201);
}

if ($method === 'PUT') {
    requireAdmin();
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $name   = trim($body['name'] ?? '');
    $active = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!$name) jsonError('El nombre es requerido');

    $stmt = $db->prepare('UPDATE zones SET name=?, active=? WHERE id=?');
    $stmt->execute([$name, $active, $id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('UPDATE zones SET active=0 WHERE id=?');
    $stmt->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
