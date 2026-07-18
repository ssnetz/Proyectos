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

match($method) {
    'GET'    => ($id ? getEstablecimiento($db, $id, $municipioId) : listEstablecimientos($db, $municipioId)),
    'POST'   => createEstablecimiento($db, $municipioId),
    'PUT'    => ($id ? updateEstablecimiento($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteEstablecimiento($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function listEstablecimientos(PDO $db, int $municipioId): void {
    $stmt = $db->prepare(
        "SELECT e.*, COUNT(m.id) AS mesas_count
         FROM establecimientos e
         LEFT JOIN mesas m ON e.id = m.establecimiento_id
         WHERE e.municipio_id = ?
         GROUP BY e.id ORDER BY e.nombre"
    );
    $stmt->execute([$municipioId]);
    jsonResponse($stmt->fetchAll());
}

function getEstablecimiento(PDO $db, int $id, int $municipioId): void {
    $stmt = $db->prepare("SELECT * FROM establecimientos WHERE id = ? AND municipio_id = ?");
    $stmt->execute([$id, $municipioId]);
    $e = $stmt->fetch();
    if (!$e) jsonError('Establecimiento no encontrado', 404);
    jsonResponse($e);
}

function createEstablecimiento(PDO $db, int $municipioId): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $stmt = $db->prepare("INSERT INTO establecimientos (municipio_id, nombre, direccion, circuito) VALUES (?, ?, ?, ?)");
    $stmt->execute([$municipioId, $data['nombre'], $data['direccion'] ?? null, $data['circuito'] ?? null]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Establecimiento creado'], 201);
}

function updateEstablecimiento(PDO $db, int $id, int $municipioId): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    $stmt = $db->prepare(
        "UPDATE establecimientos SET nombre=?, direccion=?, circuito=?, activo=?, updated_at=NOW() WHERE id=? AND municipio_id=?"
    );
    $stmt->execute([$data['nombre'], $data['direccion'] ?? null, $data['circuito'] ?? null, $activo, $id, $municipioId]);
    jsonResponse(['message' => 'Establecimiento actualizado']);
}

function deleteEstablecimiento(PDO $db, int $id, int $municipioId): void {
    $check = $db->prepare("SELECT COUNT(*) FROM mesas WHERE establecimiento_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene mesas asociadas', 409);
    }
    $stmt = $db->prepare("DELETE FROM establecimientos WHERE id = ? AND municipio_id = ?");
    $stmt->execute([$id, $municipioId]);
    jsonResponse(['message' => 'Establecimiento eliminado']);
}
