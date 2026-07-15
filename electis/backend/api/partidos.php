<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getPartido($db, $id) : listPartidos($db))),
    'POST'   => (requireAdmin() && createPartido($db)),
    'PUT'    => (requireAdmin() && ($id ? updatePartido($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deletePartido($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listPartidos(PDO $db): void {
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $stmt = $db->prepare("SELECT * FROM partidos WHERE nombre LIKE ? OR sigla LIKE ? ORDER BY nombre");
        $like = "%$q%";
        $stmt->execute([$like, $like]);
    } else {
        $stmt = $db->query("SELECT * FROM partidos ORDER BY nombre");
    }
    jsonResponse($stmt->fetchAll());
}

function getPartido(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM partidos WHERE id = ?");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Partido no encontrado', 404);
    jsonResponse($p);
}

function createPartido(PDO $db): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $stmt = $db->prepare("INSERT INTO partidos (nombre, sigla, color) VALUES (?, ?, ?)");
    $stmt->execute([$data['nombre'], $data['sigla'] ?? null, $data['color'] ?? null]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Partido creado'], 201);
}

function updatePartido(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    $stmt = $db->prepare("UPDATE partidos SET nombre=?, sigla=?, color=?, activo=?, updated_at=NOW() WHERE id=?");
    $stmt->execute([$data['nombre'], $data['sigla'] ?? null, $data['color'] ?? null, $activo, $id]);
    jsonResponse(['message' => 'Partido actualizado']);
}

function deletePartido(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM listas WHERE partido_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: el partido tiene listas asociadas', 409);
    }
    $stmt = $db->prepare("DELETE FROM partidos WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Partido eliminado']);
}
