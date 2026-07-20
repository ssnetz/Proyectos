<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAdmin();

$method = getMethod();
$db     = getDB();
$id     = getId();
$action = $_GET['action'] ?? '';

// Normaliza lo que llega en 'permissions': null = acceso total, array = lista de módulos
function normalizePermissions(mixed $value): ?string {
    if ($value === null) return null;
    if (!is_array($value)) return null;
    return json_encode(array_values($value));
}

// Genera un PIN numérico de 6 dígitos único entre usuarios, para el acceso
// restringido "Carga con Foto" desde el celular. Reintenta ante una
// colisión (muy improbable).
function generarPinUsuario(PDO $db): string {
    $check = $db->prepare('SELECT COUNT(*) FROM users WHERE pin = ?');
    for ($i = 0; $i < 20; $i++) {
        $pin = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $check->execute([$pin]);
        if ((int)$check->fetchColumn() === 0) return $pin;
    }
    jsonError('No se pudo generar un PIN único, reintentá', 500);
}

if ($method === 'GET') {
    $stmt = $db->query('SELECT id, username, role, permissions, pin, active, created_at FROM users ORDER BY username');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        $row['permissions'] = $row['permissions'] !== null ? json_decode($row['permissions'], true) : null;
    }
    unset($row);
    jsonResponse($rows);
}

if ($method === 'PUT' && $id && $action === 'regenerar_pin') {
    $pin = generarPinUsuario($db);
    $db->prepare('UPDATE users SET pin = ? WHERE id = ?')->execute([$pin, $id]);
    jsonResponse(['pin' => $pin]);
}

if ($method === 'PUT' && $id && $action === 'quitar_pin') {
    $db->prepare('UPDATE users SET pin = NULL WHERE id = ?')->execute([$id]);
    jsonResponse(['ok' => true]);
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
