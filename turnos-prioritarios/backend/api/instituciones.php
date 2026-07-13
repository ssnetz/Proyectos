<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getInstitucion($db, $id) : listInstituciones($db))),
    'POST'   => (requireAdmin() && createInstitucion($db)),
    'PUT'    => (requireAdmin() && ($id ? updateInstitucion($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteInstitucion($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listInstituciones(PDO $db): void {
    $stmt = $db->query(
        "SELECT i.*, COUNT(t.id) AS turnos_count
         FROM instituciones i
         LEFT JOIN turnos_prioritarios t ON i.id = t.institucion_id
         GROUP BY i.id ORDER BY i.nombre"
    );
    jsonResponse($stmt->fetchAll());
}

function getInstitucion(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM instituciones WHERE id = ?");
    $stmt->execute([$id]);
    $i = $stmt->fetch();
    if (!$i) jsonError('Institución no encontrada', 404);
    jsonResponse($i);
}

function createInstitucion(PDO $db): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    try {
        $stmt = $db->prepare("INSERT INTO instituciones (nombre, descripcion) VALUES (?, ?)");
        $stmt->execute([$data['nombre'], $data['descripcion'] ?? null]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Institución creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El nombre ya existe', 409);
        jsonError('Error al crear institución: ' . $e->getMessage(), 500);
    }
}

function updateInstitucion(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    try {
        $stmt = $db->prepare("UPDATE instituciones SET nombre=?, descripcion=?, updated_at=NOW() WHERE id=?");
        $stmt->execute([$data['nombre'], $data['descripcion'] ?? null, $id]);
        jsonResponse(['message' => 'Institución actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El nombre ya existe', 409);
        jsonError('Error al actualizar institución: ' . $e->getMessage(), 500);
    }
}

function deleteInstitucion(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM turnos_prioritarios WHERE institucion_id = ? AND estado IN ('pendiente','confirmado')");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene turnos pendientes o confirmados', 409);
    }
    $stmt = $db->prepare("DELETE FROM instituciones WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Institución eliminada']);
}
