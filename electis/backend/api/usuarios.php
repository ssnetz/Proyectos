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

// Normaliza lo que llega en 'permissions': null = acceso total, array = lista de módulos
function normalizePermissions(mixed $value): ?string {
    if ($value === null) return null;
    if (!is_array($value)) return null;
    return json_encode(array_values($value));
}

// Un admin no tiene municipio (ve todos); un operador requiere uno válido.
function normalizeMunicipioId(string $rol, mixed $value): ?int {
    if ($rol === 'admin') return null;
    $municipioId = !empty($value) ? (int)$value : 0;
    if (!$municipioId) jsonError('Los operadores necesitan un municipio asignado');
    return $municipioId;
}

function listUsuarios(PDO $db): void {
    $stmt = $db->query(
        "SELECT u.id, u.usuario, u.email, u.rol, u.municipio_id, m.nombre AS municipio_nombre,
                u.permissions, u.activo, u.created_at, u.updated_at
         FROM usuarios u
         LEFT JOIN municipios m ON u.municipio_id = m.id
         ORDER BY u.usuario"
    );
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        $row['permissions'] = $row['permissions'] !== null ? json_decode($row['permissions'], true) : null;
    }
    unset($row);
    jsonResponse($rows);
}

function createUsuario(PDO $db): void {
    $data = getBody();

    if (empty($data['username'])) jsonError('El usuario es requerido');
    if (empty($data['password'])) jsonError('La contraseña es requerida');

    $rol = $data['role'] ?? 'operador';
    if (!in_array($rol, ['admin', 'operador'])) jsonError('Rol inválido');

    $municipioId = normalizeMunicipioId($rol, $data['municipio_id'] ?? null);
    $permissions = normalizePermissions($data['permissions'] ?? null);
    $hash = password_hash($data['password'], PASSWORD_BCRYPT);

    try {
        $stmt = $db->prepare(
            "INSERT INTO usuarios (usuario, email, contrasena, rol, municipio_id, permissions) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['username'],
            $data['email'] ?? null,
            $hash,
            $rol,
            $municipioId,
            $permissions,
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
    $municipioId = normalizeMunicipioId($rol, $data['municipio_id'] ?? null);
    $permissions = normalizePermissions($data['permissions'] ?? null);

    if (!empty($data['password'])) {
        $hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $stmt = $db->prepare(
            "UPDATE usuarios SET usuario=?, email=?, contrasena=?, rol=?, municipio_id=?, permissions=?, activo=?, updated_at=NOW() WHERE id=?"
        );
        $stmt->execute([
            $data['username'] ?? '',
            $data['email'] ?? null,
            $hash,
            $rol,
            $municipioId,
            $permissions,
            $activo,
            $id,
        ]);
    } else {
        $stmt = $db->prepare(
            "UPDATE usuarios SET usuario=?, email=?, rol=?, municipio_id=?, permissions=?, activo=?, updated_at=NOW() WHERE id=?"
        );
        $stmt->execute([
            $data['username'] ?? '',
            $data['email'] ?? null,
            $rol,
            $municipioId,
            $permissions,
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
