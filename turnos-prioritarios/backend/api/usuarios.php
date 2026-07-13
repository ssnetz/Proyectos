<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db      = getDB();
$method  = getMethod();
$id      = getId();
$payload = requireAdmin();

match ($method) {
    'GET'    => listUsuarios($db),
    'POST'   => createUsuario($db),
    'PUT'    => $id ? updateUsuario($db, $id, $payload) : jsonError('ID requerido', 400),
    'DELETE' => $id ? deleteUsuario($db, $id, $payload) : jsonError('ID requerido', 400),
    default  => jsonError('Método no permitido', 405),
};

function listUsuarios(PDO $db): void {
    $stmt = $db->query(
        "SELECT id, usuario, email, rol, activo, created_at, updated_at FROM usuarios ORDER BY usuario"
    );
    jsonResponse($stmt->fetchAll());
}

function createUsuario(PDO $db): void {
    $data = getBody();

    if (empty($data['username'])) jsonError('El usuario es requerido');
    if (empty($data['password'])) jsonError('La contraseña es requerida');

    $rol = $data['role'] ?? 'operador';
    if (!in_array($rol, ['admin', 'operador'])) jsonError('Rol inválido');

    $hash = password_hash($data['password'], PASSWORD_BCRYPT);

    try {
        $stmt = $db->prepare(
            "INSERT INTO usuarios (usuario, email, contrasena, rol) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['username'],
            $data['email'] ?? null,
            $hash,
            $rol,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Usuario creado'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El usuario ya existe', 409);
        jsonError('Error al crear usuario: ' . $e->getMessage(), 500);
    }
}

function updateUsuario(PDO $db, int $id, array $payload): void {
    $data = getBody();
    $rol = $data['role'] ?? 'operador';
    if (!in_array($rol, ['admin', 'operador'])) jsonError('Rol inválido');

    $activo = isset($data['active']) ? (int)(bool)$data['active'] : 1;

    if (!empty($data['password'])) {
        $hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $stmt = $db->prepare(
            "UPDATE usuarios SET usuario=?, email=?, contrasena=?, rol=?, activo=?, updated_at=NOW() WHERE id=?"
        );
        $stmt->execute([
            $data['username'] ?? '',
            $data['email'] ?? null,
            $hash,
            $rol,
            $activo,
            $id,
        ]);
    } else {
        $stmt = $db->prepare(
            "UPDATE usuarios SET usuario=?, email=?, rol=?, activo=?, updated_at=NOW() WHERE id=?"
        );
        $stmt->execute([
            $data['username'] ?? '',
            $data['email'] ?? null,
            $rol,
            $activo,
            $id,
        ]);
    }

    jsonResponse(['message' => 'Usuario actualizado']);
}

function deleteUsuario(PDO $db, int $id, array $payload): void {
    if ($id === (int)$payload['sub']) {
        jsonError('No puedes eliminar tu propio usuario', 400);
    }

    // Soft delete
    $stmt = $db->prepare("UPDATE usuarios SET activo = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Usuario desactivado']);
}
