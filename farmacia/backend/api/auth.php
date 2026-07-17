<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

startSession();
setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$action = $_GET['action'] ?? '';

match (true) {
    $method === 'POST' && $action === 'login'  => login($db),
    $method === 'GET'  && $action === 'me'     => me(),
    $method === 'POST' && $action === 'logout' => logout(),
    default => jsonError('Acción no válida', 400),
};

function login(PDO $db): void {
    $data     = getBody();
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if ($username === '' || $password === '') {
        jsonError('Usuario y contraseña requeridos');
    }

    $stmt = $db->prepare(
        "SELECT id, username, email, password, role, permissions, active FROM users WHERE username = ?"
    );
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !$user['active'] || !password_verify($password, $user['password'])) {
        jsonError('Credenciales incorrectas', 401);
    }

    $sessionUser = [
        'sub'         => $user['id'],
        'id'          => $user['id'],
        'username'    => $user['username'],
        'email'       => $user['email'],
        'role'        => $user['role'],
        'permissions' => $user['permissions'] !== null ? json_decode($user['permissions'], true) : null,
    ];

    $_SESSION['user'] = $sessionUser;

    jsonResponse(['user' => $sessionUser]);
}

function me(): void {
    if (empty($_SESSION['user'])) {
        jsonError('No autorizado', 401);
    }
    jsonResponse($_SESSION['user']);
}

function logout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
    session_destroy();
    jsonResponse(['message' => 'Sesión cerrada']);
}
