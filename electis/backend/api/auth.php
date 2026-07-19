<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$action = $_GET['action'] ?? '';

match (true) {
    $method === 'POST' && $action === 'login'        => login($db),
    $method === 'GET'  && $action === 'me'           => me($db),
    $method === 'POST' && $action === 'logout'        => logout(),
    $method === 'POST' && $action === 'fiscal_login' => fiscalLogin($db),
    $method === 'GET'  && $action === 'fiscal_me'    => fiscalMe($db),
    default => jsonError('Acción no válida', 400),
};

function login(PDO $db): void {
    $data = getBody();
    $usuario = trim($data['username'] ?? '');
    $contrasena = $data['password'] ?? '';

    if ($usuario === '' || $contrasena === '') {
        jsonError('Usuario y contraseña requeridos');
    }

    $stmt = $db->prepare(
        "SELECT u.id, u.usuario, u.email, u.contrasena, u.rol, u.municipio_id, u.permissions, u.activo,
                m.nombre AS municipio_nombre
         FROM usuarios u
         LEFT JOIN municipios m ON u.municipio_id = m.id
         WHERE u.usuario = ?"
    );
    $stmt->execute([$usuario]);
    $user = $stmt->fetch();

    if (!$user || !$user['activo'] || !password_verify($contrasena, $user['contrasena'])) {
        jsonError('Credenciales incorrectas', 401);
    }

    $permissions = $user['permissions'] !== null ? json_decode($user['permissions'], true) : null;

    $now     = time();
    $payload = [
        'sub'          => $user['id'],
        'username'     => $user['usuario'],
        'role'         => $user['rol'],
        'municipio_id' => $user['municipio_id'] !== null ? (int)$user['municipio_id'] : null,
        'permissions'  => $permissions,
        'iat'          => $now,
        'exp'          => $now + JWT_EXPIRY,
    ];

    $token = jwtEncode($payload, JWT_SECRET);

    jsonResponse([
        'token' => $token,
        'user'  => [
            'id'               => $user['id'],
            'username'         => $user['usuario'],
            'email'            => $user['email'],
            'role'             => $user['rol'],
            'municipio_id'     => $user['municipio_id'] !== null ? (int)$user['municipio_id'] : null,
            'municipio_nombre' => $user['municipio_nombre'],
            'permissions'      => $permissions,
        ],
    ]);
}

function me(PDO $db): void {
    $payload = requireAuth();
    $stmt    = $db->prepare(
        "SELECT u.id, u.usuario, u.email, u.rol, u.municipio_id, u.permissions, u.activo,
                m.nombre AS municipio_nombre
         FROM usuarios u
         LEFT JOIN municipios m ON u.municipio_id = m.id
         WHERE u.id = ? AND u.activo = 1"
    );
    $stmt->execute([$payload['sub']]);
    $user = $stmt->fetch();
    if (!$user) jsonError('Usuario no encontrado', 404);
    jsonResponse([
        'id'               => $user['id'],
        'username'         => $user['usuario'],
        'email'            => $user['email'],
        'role'             => $user['rol'],
        'municipio_id'     => $user['municipio_id'] !== null ? (int)$user['municipio_id'] : null,
        'municipio_nombre' => $user['municipio_nombre'],
        'permissions'      => $user['permissions'] !== null ? json_decode($user['permissions'], true) : null,
        'active'           => $user['activo'],
    ]);
}

function logout(): void {
    jsonResponse(['message' => 'Sesión cerrada']);
}

// Login del fiscal desde el celular: solo un PIN de 6 dígitos, atado a una
// mesa fija (no a una persona — si reemplazan al fiscal a la tarde, el PIN
// sigue siendo el mismo). El token resultante queda restringido a esa mesa
// en el backend (ver fiscalMesaId() en helpers.php), sin importar qué mande
// después el cliente.
function fiscalLogin(PDO $db): void {
    $pin = trim((string)(getBody()['pin'] ?? ''));
    if ($pin === '') jsonError('Debe indicar el PIN', 400);

    $stmt = $db->prepare(
        "SELECT m.id, m.numero, m.municipio_id, m.eleccion_id, es.nombre AS establecimiento_nombre
         FROM mesas m
         JOIN establecimientos es ON m.establecimiento_id = es.id
         WHERE m.pin = ?"
    );
    $stmt->execute([$pin]);
    $mesa = $stmt->fetch();
    if (!$mesa) jsonError('PIN inválido', 401);

    $now = time();
    $payload = [
        'role'         => 'fiscal',
        'mesa_id'      => (int)$mesa['id'],
        'municipio_id' => (int)$mesa['municipio_id'],
        'eleccion_id'  => (int)$mesa['eleccion_id'],
        'iat'          => $now,
        'exp'          => $now + JWT_EXPIRY,
    ];

    jsonResponse([
        'token' => jwtEncode($payload, JWT_SECRET),
        'mesa'  => [
            'id'                     => (int)$mesa['id'],
            'numero'                 => $mesa['numero'],
            'establecimiento_nombre' => $mesa['establecimiento_nombre'],
        ],
    ]);
}

function fiscalMe(PDO $db): void {
    $payload = requireAuth();
    if (($payload['role'] ?? '') !== 'fiscal') jsonError('No autorizado', 401);

    $stmt = $db->prepare(
        "SELECT m.id, m.numero, es.nombre AS establecimiento_nombre
         FROM mesas m JOIN establecimientos es ON m.establecimiento_id = es.id
         WHERE m.id = ?"
    );
    $stmt->execute([$payload['mesa_id']]);
    $mesa = $stmt->fetch();
    if (!$mesa) jsonError('Mesa no encontrada', 404);
    jsonResponse(['mesa' => $mesa]);
}
