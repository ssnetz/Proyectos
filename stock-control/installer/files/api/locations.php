<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getLocation($db, $id) : listLocations($db))),
    'POST'   => (requireAdmin() && createLocation($db)),
    'PUT'    => (requireAdmin() && ($id ? updateLocation($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteLocation($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listLocations(PDO $db): void {
    $all = isset($_GET['all']);
    $sql = "SELECT l.*,
                   COUNT(DISTINCT ps.product_id) AS product_count,
                   COALESCE(SUM(ps.quantity), 0) AS total_units
            FROM locations l
            LEFT JOIN product_stock ps ON l.id = ps.location_id
            WHERE " . ($all ? '1=1' : 'l.active = 1') . "
            GROUP BY l.id
            ORDER BY FIELD(l.type,'farmacia','guardia','dispensario'), l.name";
    jsonResponse($db->query($sql)->fetchAll());
}

function getLocation(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM locations WHERE id = ?");
    $stmt->execute([$id]);
    $loc = $stmt->fetch();
    if (!$loc) jsonError('Ubicación no encontrada', 404);
    jsonResponse($loc);
}

function createLocation(PDO $db): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('Campo requerido: name');
    $stmt = $db->prepare("INSERT INTO locations (name, type, address) VALUES (?, ?, ?)");
    $stmt->execute([
        $data['name'],
        $data['type']    ?? 'dispensario',
        $data['address'] ?? null,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Ubicación creada'], 201);
}

function updateLocation(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('Campo requerido: name');
    $stmt = $db->prepare(
        "UPDATE locations SET name=?, type=?, address=?, active=?, updated_at=NOW() WHERE id=?"
    );
    $stmt->execute([
        $data['name'],
        $data['type']    ?? 'dispensario',
        $data['address'] ?? null,
        isset($data['active']) ? (int)$data['active'] : 1,
        $id,
    ]);
    jsonResponse(['message' => 'Ubicación actualizada']);
}

function deleteLocation(PDO $db, int $id): void {
    if ($id === 1) jsonError('No se puede eliminar la Farmacia Central', 400);
    $stmt = $db->prepare("UPDATE locations SET active = 0 WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Ubicación desactivada']);
}
