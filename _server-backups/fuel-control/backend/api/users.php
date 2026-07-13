<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAdmin();

$method = getMethod();
$db     = getDB();

if ($method === 'GET') {
    $stmt = $db->query('SELECT id, username, role, active, created_at FROM users ORDER BY username');
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body     = getBody();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';
    $role     = $body['role'] ?? 'operator';

    if (!$username || !$password) jsonError('Usuario y contraseña requeridos');
    if (!in_array($role, ['admin', 'operator'])) jsonError('Rol inválido');

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    $stmt->execute([$username, $hash, $role]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $role   = $body['role'] ?? 'operator';
    $active = isset($body['active']) ? (int)(bool)$body['active'] : 1;

    if (!in_array($role, ['admin', 'operator'])) jsonError('Rol inválido');

    if (!empty($body['password'])) {
        $hash = password_hash($body['password'], PASSWORD_DEFAULT);
        $stmt = $db->prepare('UPDATE users SET role=?, active=?, password=? WHERE id=?');
        $stmt->execute([$role, $active, $hash, $id]);
    } else {
        $stmt = $db->prepare('UPDATE users SET role=?, active=? WHERE id=?');
        $stmt->execute([$role, $active, $id]);
    }
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
