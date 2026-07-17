<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$method = getMethod();

if ($method === 'POST') {
    $body     = getBody();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (!$username || !$password) {
        jsonError('Usuario y contraseña requeridos');
    }

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, username, password, role, permissions FROM users WHERE username = ? AND active = 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonError('Credenciales inválidas', 401);
    }

    $permissions = $user['permissions'] !== null ? json_decode($user['permissions'], true) : null;

    $payload = [
        'sub'         => $user['id'],
        'username'    => $user['username'],
        'role'        => $user['role'],
        'permissions' => $permissions,
        'exp'         => time() + JWT_EXPIRY,
    ];

    jsonResponse([
        'token' => jwtEncode($payload, JWT_SECRET),
        'user'  => ['id' => $user['id'], 'username' => $user['username'], 'role' => $user['role'], 'permissions' => $permissions],
    ]);
}

jsonError('Método no permitido', 405);
