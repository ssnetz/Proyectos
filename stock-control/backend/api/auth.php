<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$action = $_GET['action'] ?? '';

match (true) {
    $method === 'POST' && $action === 'login'  => login($db),
    $method === 'GET'  && $action === 'me'     => me($db),
    $method === 'POST' && $action === 'logout' => logout(),
    default => jsonError('Acción no válida', 400),
};

function login(PDO $db): void {
    $data = getBody();
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if ($username === '' || $password === '') {
        jsonError('Usuario y contraseña requeridos');
    }

    $stmt = $db->prepare("SELECT id, username, email, password, role, active FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !$user['active'] || !password_verify($password, $user['password'])) {
        jsonError('Credenciales incorrectas', 401);
    }

    $now     = time();
    $payload = [
        'sub'      => $user['id'],
        'username' => $user['username'],
        'role'     => $user['role'],
        'iat'      => $now,
        'exp'      => $now + JWT_EXPIRY,
    ];

    $token = jwtEncode($payload, JWT_SECRET);

    jsonResponse([
        'token' => $token,
        'user'  => [
            'id'       => $user['id'],
            'username' => $user['username'],
            'email'    => $user['email'],
            'role'     => $user['role'],
        ],
    ]);
}

function me(PDO $db): void {
    $payload = requireAuth();
    $stmt    = $db->prepare("SELECT id, username, email, role, active FROM users WHERE id = ? AND active = 1");
    $stmt->execute([$payload['sub']]);
    $user = $stmt->fetch();
    if (!$user) jsonError('Usuario no encontrado', 404);
    jsonResponse($user);
}

function logout(): void {
    jsonResponse(['message' => 'Sesión cerrada']);
}
