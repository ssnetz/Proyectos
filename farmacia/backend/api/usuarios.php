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
        "SELECT id, username, email, role, active, created_at, updated_at FROM users ORDER BY username"
    );
    jsonResponse($stmt->fetchAll());
}

function createUsuario(PDO $db): void {
    $data = getBody();
    if (empty($data['username'])) jsonError('El username es requerido');
    if (empty($data['password'])) jsonError('La contraseña es requerida');

    $role = $data['role'] ?? 'operador';
    if (!in_array($role, ['admin', 'operador'])) jsonError('Rol inválido');

    $hash = password_hash($data['password'], PASSWORD_BCRYPT);

    try {
        $stmt = $db->prepare(
            "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$data['username'], $data['email'] ?? null, $hash, $role]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Usuario creado'], 201);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El username ya existe', 409);
        jsonError('Error al crear usuario: ' . $e->getMessage(), 500);
    }
}

function updateUsuario(PDO $db, int $id, array $payload): void {
    $data   = getBody();
    $role   = $data['role'] ?? 'operador';
    if (!in_array($role, ['admin', 'operador'])) jsonError('Rol inválido');
    $active = isset($data['active']) ? (int)(bool)$data['active'] : 1;

    if (!empty($data['password'])) {
        $hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $stmt = $db->prepare(
            "UPDATE users SET username=?, email=?, password=?, role=?, active=?, updated_at=NOW() WHERE id=?"
        );
        $stmt->execute([$data['username'] ?? '', $data['email'] ?? null, $hash, $role, $active, $id]);
    } else {
        $stmt = $db->prepare(
            "UPDATE users SET username=?, email=?, role=?, active=?, updated_at=NOW() WHERE id=?"
        );
        $stmt->execute([$data['username'] ?? '', $data['email'] ?? null, $role, $active, $id]);
    }

    jsonResponse(['message' => 'Usuario actualizado']);
}

function deleteUsuario(PDO $db, int $id, array $payload): void {
    if ($id === (int)($payload['id'] ?? $payload['sub'] ?? 0)) {
        jsonError('No puedes eliminar tu propio usuario', 400);
    }
    $stmt = $db->prepare("UPDATE users SET active = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Usuario desactivado']);
}
