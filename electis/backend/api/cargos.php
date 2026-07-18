<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

if ($method === 'GET') {
    $municipioId = requireMunicipioScope()['municipio_id'];
} else {
    $municipioId = requireMunicipioScope(requireAdmin())['municipio_id'];
}
$eleccionId = requireEleccionScope();

match($method) {
    'GET'    => ($id ? getCargo($db, $id, $municipioId, $eleccionId) : listCargos($db, $municipioId, $eleccionId)),
    'POST'   => createCargo($db, $municipioId, $eleccionId),
    'PUT'    => ($id ? updateCargo($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteCargo($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function listCargos(PDO $db, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare("SELECT * FROM cargos WHERE municipio_id = ? AND eleccion_id = ? ORDER BY orden, nombre");
    $stmt->execute([$municipioId, $eleccionId]);
    jsonResponse($stmt->fetchAll());
}

function getCargo(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare("SELECT * FROM cargos WHERE id = ? AND municipio_id = ? AND eleccion_id = ?");
    $stmt->execute([$id, $municipioId, $eleccionId]);
    $c = $stmt->fetch();
    if (!$c) jsonError('Cargo no encontrado', 404);
    jsonResponse($c);
}

function createCargo(PDO $db, int $municipioId, int $eleccionId): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    try {
        $stmt = $db->prepare("INSERT INTO cargos (municipio_id, eleccion_id, nombre, bancas, orden) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$municipioId, $eleccionId, $data['nombre'], (int)($data['bancas'] ?? 1), (int)($data['orden'] ?? 0)]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Cargo creado'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El nombre ya existe', 409);
        jsonError('Error al crear cargo: ' . $e->getMessage(), 500);
    }
}

function updateCargo(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    try {
        $stmt = $db->prepare(
            "UPDATE cargos SET nombre=?, bancas=?, orden=?, activo=?, updated_at=NOW() WHERE id=? AND municipio_id=? AND eleccion_id=?"
        );
        $stmt->execute([$data['nombre'], (int)($data['bancas'] ?? 1), (int)($data['orden'] ?? 0), $activo, $id, $municipioId, $eleccionId]);
        jsonResponse(['message' => 'Cargo actualizado']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El nombre ya existe', 409);
        jsonError('Error al actualizar cargo: ' . $e->getMessage(), 500);
    }
}

function deleteCargo(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $check = $db->prepare("SELECT COUNT(*) FROM listas WHERE cargo_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: el cargo tiene listas asociadas', 409);
    }
    $stmt = $db->prepare("DELETE FROM cargos WHERE id = ? AND municipio_id = ? AND eleccion_id = ?");
    $stmt->execute([$id, $municipioId, $eleccionId]);
    jsonResponse(['message' => 'Cargo eliminado']);
}
