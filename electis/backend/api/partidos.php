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
    'GET'    => ($id ? getPartido($db, $id, $municipioId) : listPartidos($db, $municipioId)),
    'POST'   => createPartido($db, $municipioId),
    'PUT'    => ($id ? updatePartido($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deletePartido($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function listPartidos(PDO $db, int $municipioId): void {
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $stmt = $db->prepare("SELECT * FROM partidos WHERE municipio_id = ? AND (nombre LIKE ? OR sigla LIKE ?) ORDER BY nombre");
        $like = "%$q%";
        $stmt->execute([$municipioId, $like, $like]);
    } else {
        $stmt = $db->prepare("SELECT * FROM partidos WHERE municipio_id = ? ORDER BY nombre");
        $stmt->execute([$municipioId]);
    }
    jsonResponse($stmt->fetchAll());
}

function getPartido(PDO $db, int $id, int $municipioId): void {
    $stmt = $db->prepare("SELECT * FROM partidos WHERE id = ? AND municipio_id = ?");
    $stmt->execute([$id, $municipioId]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Partido no encontrado', 404);
    jsonResponse($p);
}

function createPartido(PDO $db, int $municipioId): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $stmt = $db->prepare("INSERT INTO partidos (municipio_id, nombre, sigla, color) VALUES (?, ?, ?, ?)");
    $stmt->execute([$municipioId, $data['nombre'], $data['sigla'] ?? null, $data['color'] ?? null]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Partido creado'], 201);
}

function updatePartido(PDO $db, int $id, int $municipioId): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    $stmt = $db->prepare("UPDATE partidos SET nombre=?, sigla=?, color=?, activo=?, updated_at=NOW() WHERE id=? AND municipio_id=?");
    $stmt->execute([$data['nombre'], $data['sigla'] ?? null, $data['color'] ?? null, $activo, $id, $municipioId]);
    jsonResponse(['message' => 'Partido actualizado']);
}

function deletePartido(PDO $db, int $id, int $municipioId): void {
    $check = $db->prepare("SELECT COUNT(*) FROM listas WHERE partido_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: el partido tiene listas asociadas', 409);
    }
    $stmt = $db->prepare("DELETE FROM partidos WHERE id = ? AND municipio_id = ?");
    $stmt->execute([$id, $municipioId]);
    jsonResponse(['message' => 'Partido eliminado']);
}
