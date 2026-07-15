<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getLista($db, $id) : listListas($db))),
    'POST'   => (requireAdmin() && createLista($db)),
    'PUT'    => (requireAdmin() && ($id ? updateLista($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteLista($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT l.*, p.nombre AS partido_nombre, p.color AS partido_color, c.nombre AS cargo_nombre,
                   (SELECT COUNT(*) FROM candidatos WHERE lista_id = l.id) AS candidatos_count
            FROM listas l
            JOIN partidos p ON l.partido_id = p.id
            JOIN cargos c ON l.cargo_id = c.id";
}

function listListas(PDO $db): void {
    $where = [];
    $params = [];
    if (!empty($_GET['cargo_id'])) {
        $where[] = 'l.cargo_id = ?';
        $params[] = (int)$_GET['cargo_id'];
    }
    if (!empty($_GET['partido_id'])) {
        $where[] = 'l.partido_id = ?';
        $params[] = (int)$_GET['partido_id'];
    }
    $sql = baseSelect();
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY c.orden, p.nombre, l.numero';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getLista(PDO $db, int $id): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE l.id = ?');
    $stmt->execute([$id]);
    $l = $stmt->fetch();
    if (!$l) jsonError('Lista no encontrada', 404);
    jsonResponse($l);
}

function createLista(PDO $db): void {
    $data = getBody();
    foreach (['partido_id', 'cargo_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    try {
        $stmt = $db->prepare("INSERT INTO listas (partido_id, cargo_id, numero, nombre) VALUES (?, ?, ?, ?)");
        $stmt->execute([(int)$data['partido_id'], (int)$data['cargo_id'], $data['numero'], $data['nombre'] ?? null]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Lista creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe una lista con ese número para ese cargo', 409);
        jsonError('Error al crear lista: ' . $e->getMessage(), 500);
    }
}

function updateLista(PDO $db, int $id): void {
    $data = getBody();
    foreach (['partido_id', 'cargo_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    try {
        $stmt = $db->prepare(
            "UPDATE listas SET partido_id=?, cargo_id=?, numero=?, nombre=?, activo=?, updated_at=NOW() WHERE id=?"
        );
        $stmt->execute([
            (int)$data['partido_id'], (int)$data['cargo_id'], $data['numero'], $data['nombre'] ?? null, $activo, $id,
        ]);
        jsonResponse(['message' => 'Lista actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe una lista con ese número para ese cargo', 409);
        jsonError('Error al actualizar lista: ' . $e->getMessage(), 500);
    }
}

function deleteLista(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM candidatos WHERE lista_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: la lista tiene candidatos cargados', 409);
    }
    $stmt = $db->prepare("DELETE FROM listas WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Lista eliminada']);
}
