<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getMesa($db, $id) : listMesas($db))),
    'POST'   => (requireAdmin() && createMesa($db)),
    'PUT'    => (requireAdmin() && ($id ? updateMesa($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteMesa($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT m.*, e.nombre AS establecimiento_nombre,
                   (SELECT COUNT(*) FROM electores WHERE mesa_id = m.id) AS electores_count,
                   (SELECT estado FROM actas WHERE mesa_id = m.id) AS acta_estado
            FROM mesas m
            JOIN establecimientos e ON m.establecimiento_id = e.id";
}

function listMesas(PDO $db): void {
    $where = [];
    $params = [];
    if (!empty($_GET['establecimiento_id'])) {
        $where[] = 'm.establecimiento_id = ?';
        $params[] = (int)$_GET['establecimiento_id'];
    }
    if (!empty($_GET['q'])) {
        $where[] = 'm.numero LIKE ?';
        $params[] = '%' . $_GET['q'] . '%';
    }
    $sql = baseSelect();
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY m.numero';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getMesa(PDO $db, int $id): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE m.id = ?');
    $stmt->execute([$id]);
    $m = $stmt->fetch();
    if (!$m) jsonError('Mesa no encontrada', 404);
    jsonResponse($m);
}

function createMesa(PDO $db): void {
    $data = getBody();
    foreach (['establecimiento_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    try {
        $stmt = $db->prepare(
            "INSERT INTO mesas (establecimiento_id, numero, electores_habilitados) VALUES (?, ?, ?)"
        );
        $stmt->execute([
            (int)$data['establecimiento_id'], $data['numero'], (int)($data['electores_habilitados'] ?? 0),
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Mesa creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El número de mesa ya existe', 409);
        jsonError('Error al crear mesa: ' . $e->getMessage(), 500);
    }
}

function updateMesa(PDO $db, int $id): void {
    $data = getBody();
    foreach (['establecimiento_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    try {
        $stmt = $db->prepare(
            "UPDATE mesas SET establecimiento_id=?, numero=?, electores_habilitados=?, activo=?, updated_at=NOW() WHERE id=?"
        );
        $stmt->execute([
            (int)$data['establecimiento_id'], $data['numero'], (int)($data['electores_habilitados'] ?? 0), $activo, $id,
        ]);
        jsonResponse(['message' => 'Mesa actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El número de mesa ya existe', 409);
        jsonError('Error al actualizar mesa: ' . $e->getMessage(), 500);
    }
}

function deleteMesa(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM electores WHERE mesa_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: la mesa tiene electores asignados', 409);
    }
    $stmt = $db->prepare("DELETE FROM mesas WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Mesa eliminada']);
}
