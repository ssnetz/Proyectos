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
        $stmt = $db->query('SELECT * FROM suppliers ORDER BY name');
    } else {
        $stmt = $db->query('SELECT * FROM suppliers WHERE active = 1 ORDER BY name');
    }
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAdmin();
    $body    = getBody();
    $name    = trim($body['name']    ?? '');
    $cuit    = trim($body['cuit']    ?? '') ?: null;
    $phone   = trim($body['phone']   ?? '') ?: null;
    $email   = trim($body['email']   ?? '') ?: null;
    $address = trim($body['address'] ?? '') ?: null;
    $notes   = trim($body['notes']   ?? '') ?: null;

    if (!$name) jsonError('El nombre es requerido');

    $stmt = $db->prepare('INSERT INTO suppliers (name, cuit, phone, email, address, notes, active)
                          VALUES (?, ?, ?, ?, ?, ?, 1)');
    $stmt->execute([$name, $cuit, $phone, $email, $address, $notes]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    requireAdmin();
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $name    = trim($body['name']    ?? '');
    $cuit    = trim($body['cuit']    ?? '') ?: null;
    $phone   = trim($body['phone']   ?? '') ?: null;
    $email   = trim($body['email']   ?? '') ?: null;
    $address = trim($body['address'] ?? '') ?: null;
    $notes   = trim($body['notes']   ?? '') ?: null;
    $active  = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!$name) jsonError('El nombre es requerido');

    $stmt = $db->prepare('UPDATE suppliers SET name=?, cuit=?, phone=?, email=?, address=?, notes=?, active=? WHERE id=?');
    $stmt->execute([$name, $cuit, $phone, $email, $address, $notes, $active, $id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');
    $db->prepare('UPDATE suppliers SET active=0 WHERE id=?')->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
