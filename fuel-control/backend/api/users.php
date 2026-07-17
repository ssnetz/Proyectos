<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAdmin();

$method = getMethod();
$db     = getDB();

// Normaliza lo que llega en 'permissions': null = acceso total, array = lista de módulos
function normalizePermissions(mixed $value): ?string {
    if ($value === null) return null;
    if (!is_array($value)) return null;
    return json_encode(array_values($value));
}

if ($method === 'GET') {
    $stmt = $db->query('SELECT id, username, role, permissions, active, created_at FROM users ORDER BY username');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        $row['permissions'] = $row['permissions'] !== null ? json_decode($row['permissions'], true) : null;
    }
    unset($row);
    jsonResponse($rows);
}

if ($method === 'POST') {
    $body        = getBody();
    $username    = trim($body['username'] ?? '');
    $password    = $body['password'] ?? '';
    $role        = $body['role'] ?? 'operator';
    $permissions = normalizePermissions($body['permissions'] ?? null);

    if (!$username || !$password) jsonError('Usuario y contraseña requeridos');
    if (!in_array($role, ['admin', 'operator'])) jsonError('Rol inválido');

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)');
    $stmt->execute([$username, $hash, $role, $permissions]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $id   = getId();
    $body = getBody();
    if (!$id) jsonError('ID requerido');

    $role        = $body['role'] ?? 'operator';
    $active      = isset($body['active']) ? (int)(bool)$body['active'] : 1;
    $permissions = normalizePermissions($body['permissions'] ?? null);

    if (!in_array($role, ['admin', 'operator'])) jsonError('Rol inválido');

    if (!empty($body['password'])) {
        $hash = password_hash($body['password'], PASSWORD_DEFAULT);
        $stmt = $db->prepare('UPDATE users SET role=?, permissions=?, active=?, password=? WHERE id=?');
        $stmt->execute([$role, $permissions, $active, $hash, $id]);
    } else {
        $stmt = $db->prepare('UPDATE users SET role=?, permissions=?, active=? WHERE id=?');
        $stmt->execute([$role, $permissions, $active, $id]);
    }
    jsonResponse(['ok' => true]);
}

jsonError('Método no permitido', 405);
