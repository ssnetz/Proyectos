<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match ($method) {
    'GET'    => (requireAuth() && (isset($_GET['stock']) ? stockByLocation($db) : listUbicaciones($db))),
    'POST'   => (requireAdmin() && createUbicacion($db)),
    'PUT'    => (requireAdmin() && ($id ? updateUbicacion($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteUbicacion($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function stockByLocation(PDO $db): void {
    $productId = $_GET['product_id'] ?? null;

    $sql = "
        SELECT
            l.id   AS location_id,
            l.name AS location_name,
            l.type AS location_type,
            SUM(ps.quantity) AS net_qty
        FROM product_stock ps
        JOIN locations l ON ps.location_id = l.id
        WHERE ps.quantity > 0
    ";
    $params = [];
    if ($productId) {
        $sql .= " AND ps.product_id = ?";
        $params[] = (int)$productId;
    }
    $sql .= " GROUP BY l.id, l.name, l.type
              ORDER BY net_qty DESC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if ($productId) {
        $s = $db->prepare("SELECT stock FROM products WHERE id = ?");
        $s->execute([$productId]);
        $totalStock = (int)($s->fetchColumn() ?: 0);
    } else {
        $totalStock = (int)$db->query("SELECT COALESCE(SUM(stock),0) FROM products WHERE active = 1")->fetchColumn();
    }

    $locatedTotal = array_sum(array_column($rows, 'net_qty'));
    $unlocated    = $totalStock - $locatedTotal;

    if ($unlocated > 0) {
        $rows[] = [
            'location_id'   => null,
            'location_name' => 'Sin ubicación asignada',
            'location_type' => null,
            'net_qty'        => $unlocated,
        ];
    }

    jsonResponse($rows);
}

function listUbicaciones(PDO $db): void {
    try {
        $activeOnly = ($_GET['active_only'] ?? '1') !== '0';
        $sql        = "SELECT * FROM locations WHERE 1=1";
        if ($activeOnly) $sql .= " AND active = 1";
        $sql .= " ORDER BY name";
        $stmt = $db->prepare($sql);
        $stmt->execute();
        jsonResponse($stmt->fetchAll());
    } catch (Exception $e) {
        jsonError('Error al listar ubicaciones: ' . $e->getMessage(), 500);
    }
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
