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
    'GET'    => ($id ? getMesa($db, $id, $municipioId) : listMesas($db, $municipioId)),
    'POST'   => createMesa($db, $municipioId),
    'PUT'    => ($id ? updateMesa($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteMesa($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT m.*, e.nombre AS establecimiento_nombre,
                   (SELECT COUNT(*) FROM electores WHERE mesa_id = m.id) AS electores_count,
                   (SELECT estado FROM actas WHERE mesa_id = m.id) AS acta_estado
            FROM mesas m
            JOIN establecimientos e ON m.establecimiento_id = e.id";
}

function listMesas(PDO $db, int $municipioId): void {
    $where = ['m.municipio_id = ?'];
    $params = [$municipioId];
    if (!empty($_GET['establecimiento_id'])) {
        $where[] = 'm.establecimiento_id = ?';
        $params[] = (int)$_GET['establecimiento_id'];
    }
    if (!empty($_GET['q'])) {
        $where[] = 'm.numero LIKE ?';
        $params[] = '%' . $_GET['q'] . '%';
    }
    $sql = baseSelect() . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY CAST(m.numero AS UNSIGNED), m.numero';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getMesa(PDO $db, int $id, int $municipioId): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE m.id = ? AND m.municipio_id = ?');
    $stmt->execute([$id, $municipioId]);
    $m = $stmt->fetch();
    if (!$m) jsonError('Mesa no encontrada', 404);
    jsonResponse($m);
}

function validateEstablecimientoMunicipio(PDO $db, int $establecimientoId, int $municipioId): void {
    $stmt = $db->prepare("SELECT municipio_id FROM establecimientos WHERE id = ?");
    $stmt->execute([$establecimientoId]);
    if ((int)$stmt->fetchColumn() !== $municipioId) jsonError('El establecimiento no pertenece a este municipio', 400);
}

function createMesa(PDO $db, int $municipioId): void {
    $data = getBody();
    foreach (['establecimiento_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    validateEstablecimientoMunicipio($db, (int)$data['establecimiento_id'], $municipioId);

    try {
        $stmt = $db->prepare(
            "INSERT INTO mesas (municipio_id, establecimiento_id, numero, electores_habilitados) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([
            $municipioId, (int)$data['establecimiento_id'], $data['numero'], (int)($data['electores_habilitados'] ?? 0),
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Mesa creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El número de mesa ya existe en ese establecimiento', 409);
        jsonError('Error al crear mesa: ' . $e->getMessage(), 500);
    }
}

function updateMesa(PDO $db, int $id, int $municipioId): void {
    $data = getBody();
    foreach (['establecimiento_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    validateEstablecimientoMunicipio($db, (int)$data['establecimiento_id'], $municipioId);

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    try {
        $stmt = $db->prepare(
            "UPDATE mesas SET establecimiento_id=?, numero=?, electores_habilitados=?, activo=?, updated_at=NOW() WHERE id=? AND municipio_id=?"
        );
        $stmt->execute([
            (int)$data['establecimiento_id'], $data['numero'], (int)($data['electores_habilitados'] ?? 0), $activo, $id, $municipioId,
        ]);
        jsonResponse(['message' => 'Mesa actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El número de mesa ya existe en ese establecimiento', 409);
        jsonError('Error al actualizar mesa: ' . $e->getMessage(), 500);
    }
}

function deleteMesa(PDO $db, int $id, int $municipioId): void {
    $check = $db->prepare("SELECT COUNT(*) FROM electores WHERE mesa_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: la mesa tiene electores asignados', 409);
    }
    $stmt = $db->prepare("DELETE FROM mesas WHERE id = ? AND municipio_id = ?");
    $stmt->execute([$id, $municipioId]);
    jsonResponse(['message' => 'Mesa eliminada']);
}
