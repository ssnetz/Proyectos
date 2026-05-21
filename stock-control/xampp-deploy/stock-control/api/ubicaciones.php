<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match ($method) {
    'GET'    => (requireAuth() && listUbicaciones($db)),
    'POST'   => (requireAdmin() && createUbicacion($db)),
    'PUT'    => (requireAdmin() && ($id ? updateUbicacion($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteUbicacion($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listUbicaciones(PDO $db): void {
    $activeOnly = ($_GET['active_only'] ?? '1') !== '0';
    $sql        = "SELECT * FROM locations WHERE 1=1";
    if ($activeOnly) $sql .= " AND active = 1";
    $sql .= " ORDER BY name";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    jsonResponse($stmt->fetchAll());
}

function createUbicacion(PDO $db): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("INSERT INTO locations (name, type, active) VALUES (?, ?, 1)");
    $stmt->execute([trim($data['name']), $data['type'] ?? null]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Ubicación creada'], 201);
}

function updateUbicacion(PDO $db, int $id): void {
    $data   = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $active = isset($data['active']) ? (int)(bool)$data['active'] : 1;
    $stmt   = $db->prepare("UPDATE locations SET name=?, type=?, active=? WHERE id=?");
    $stmt->execute([trim($data['name']), $data['type'] ?? null, $active, $id]);
    jsonResponse(['message' => 'Ubicación actualizada']);
}

function deleteUbicacion(PDO $db, int $id): void {
    $stmt = $db->prepare("UPDATE locations SET active = 0 WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('Ubicación no encontrada', 404);
    jsonResponse(['message' => 'Ubicación desactivada']);
}
