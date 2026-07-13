<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
$user = requireAuth();

$method = getMethod();
$db     = getDB();

if ($method === 'GET') {
    $all  = isset($_GET['all']);
    $where = $all ? '' : 'WHERE active = 1';
    $stmt = $db->query("SELECT * FROM lubricant_types $where ORDER BY name");
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAdmin();
    $body = getBody();
    $name = trim($body['name'] ?? '');
    if (!$name) jsonError('Nombre requerido');

    $stmt = $db->prepare('INSERT INTO lubricant_types (name) VALUES (?)');
    $stmt->execute([$name]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'name' => $name, 'active' => 1], 201);
}

if ($method === 'PUT') {
    requireAdmin();
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $name   = trim($body['name'] ?? '');
    $active = isset($body['active']) ? (int)(bool)$body['active'] : 1;
    if (!$name) jsonError('Nombre requerido');

    $stmt = $db->prepare('UPDATE lubricant_types SET name=?, active=? WHERE id=?');
    $stmt->execute([$name, $active, $id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('UPDATE lubricant_types SET active=0 WHERE id=?');
    $stmt->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
