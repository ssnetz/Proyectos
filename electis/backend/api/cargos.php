<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getCargo($db, $id) : listCargos($db))),
    'POST'   => (requireAdmin() && createCargo($db)),
    'PUT'    => (requireAdmin() && ($id ? updateCargo($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteCargo($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listCargos(PDO $db): void {
    $stmt = $db->query("SELECT * FROM cargos ORDER BY orden, nombre");
    jsonResponse($stmt->fetchAll());
}

function getCargo(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM cargos WHERE id = ?");
    $stmt->execute([$id]);
    $c = $stmt->fetch();
    if (!$c) jsonError('Cargo no encontrado', 404);
    jsonResponse($c);
}

function createCargo(PDO $db): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    try {
        $stmt = $db->prepare("INSERT INTO cargos (nombre, bancas, orden) VALUES (?, ?, ?)");
        $stmt->execute([$data['nombre'], (int)($data['bancas'] ?? 1), (int)($data['orden'] ?? 0)]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Cargo creado'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El nombre ya existe', 409);
        jsonError('Error al crear cargo: ' . $e->getMessage(), 500);
    }
}

function updateCargo(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    try {
        $stmt = $db->prepare("UPDATE cargos SET nombre=?, bancas=?, orden=?, activo=?, updated_at=NOW() WHERE id=?");
        $stmt->execute([$data['nombre'], (int)($data['bancas'] ?? 1), (int)($data['orden'] ?? 0), $activo, $id]);
        jsonResponse(['message' => 'Cargo actualizado']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El nombre ya existe', 409);
        jsonError('Error al actualizar cargo: ' . $e->getMessage(), 500);
    }
}

function deleteCargo(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM listas WHERE cargo_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: el cargo tiene listas asociadas', 409);
    }
    $stmt = $db->prepare("DELETE FROM cargos WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Cargo eliminado']);
}
