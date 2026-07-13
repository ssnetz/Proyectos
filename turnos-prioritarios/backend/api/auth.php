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
    $usuario = trim($data['username'] ?? '');
    $contrasena = $data['password'] ?? '';

    if ($usuario === '' || $contrasena === '') {
        jsonError('Usuario y contraseña requeridos');
    }

    $stmt = $db->prepare("SELECT id, usuario, email, contrasena, rol, activo FROM usuarios WHERE usuario = ?");
    $stmt->execute([$usuario]);
    $user = $stmt->fetch();

    if (!$user || !$user['activo'] || !password_verify($contrasena, $user['contrasena'])) {
        jsonError('Credenciales incorrectas', 401);
    }

    $now     = time();
    $payload = [
        'sub'      => $user['id'],
        'username' => $user['usuario'],
        'role'     => $user['rol'],
        'iat'      => $now,
        'exp'      => $now + JWT_EXPIRY,
    ];

    $token = jwtEncode($payload, JWT_SECRET);

    jsonResponse([
        'token' => $token,
        'user'  => [
            'id'       => $user['id'],
            'username' => $user['usuario'],
            'email'    => $user['email'],
            'role'     => $user['rol'],
        ],
    ]);
}

function me(PDO $db): void {
    $payload = requireAuth();
    $stmt    = $db->prepare("SELECT id, usuario, email, rol, activo FROM usuarios WHERE id = ? AND activo = 1");
    $stmt->execute([$payload['sub']]);
    $user = $stmt->fetch();
    if (!$user) jsonError('Usuario no encontrado', 404);
    jsonResponse([
        'id'       => $user['id'],
        'username' => $user['usuario'],
        'email'    => $user['email'],
        'role'     => $user['rol'],
        'active'   => $user['activo'],
    ]);
}

function logout(): void {
    jsonResponse(['message' => 'Sesión cerrada']);
}
