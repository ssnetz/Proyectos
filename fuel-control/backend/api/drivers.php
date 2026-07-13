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
        $stmt = $db->query('SELECT * FROM drivers ORDER BY name');
    } else {
        $stmt = $db->query('SELECT * FROM drivers WHERE active = 1 ORDER BY name');
    }
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAdmin();
    $body         = getBody();
    $name         = trim($body['name'] ?? '');
    $dni          = trim($body['dni'] ?? '');
    $phone        = trim($body['phone'] ?? '') ?: null;
    $license_type = trim($body['license_type'] ?? '') ?: null;
    $hire_date    = trim($body['hire_date'] ?? '') ?: null;
    $hourly_cost  = isset($body['hourly_cost']) ? (float)$body['hourly_cost'] : 0;
    $active       = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!$name) jsonError('El nombre es requerido');
    if (!$dni)  jsonError('El DNI es requerido');

    $stmt = $db->prepare('
        INSERT INTO drivers (name, dni, phone, license_type, hire_date, hourly_cost, active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$name, $dni, $phone, $license_type, $hire_date, $hourly_cost, $active]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    requireAdmin();
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $name         = trim($body['name'] ?? '');
    $dni          = trim($body['dni'] ?? '');
    $phone        = trim($body['phone'] ?? '') ?: null;
    $license_type = trim($body['license_type'] ?? '') ?: null;
    $hire_date    = trim($body['hire_date'] ?? '') ?: null;
    $hourly_cost  = isset($body['hourly_cost']) ? (float)$body['hourly_cost'] : 0;
    $active       = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!$name) jsonError('El nombre es requerido');
    if (!$dni)  jsonError('El DNI es requerido');

    $stmt = $db->prepare('
        UPDATE drivers SET name=?, dni=?, phone=?, license_type=?, hire_date=?, hourly_cost=?, active=?
        WHERE id=?
    ');
    $stmt->execute([$name, $dni, $phone, $license_type, $hire_date, $hourly_cost, $active, $id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = getId();
    if (!$id) jsonError('ID requerido');

    $stmt = $db->prepare('UPDATE drivers SET active=0 WHERE id=?');
    $stmt->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
