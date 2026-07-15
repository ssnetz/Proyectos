<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getFiscal($db, $id) : listFiscales($db))),
    'POST'   => (requireAuth() && createFiscal($db)),
    'PUT'    => (requireAuth() && ($id ? updateFiscal($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteFiscal($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT f.*, p.nombre AS partido_nombre, m.numero AS mesa_numero
            FROM fiscales f
            LEFT JOIN partidos p ON f.partido_id = p.id
            LEFT JOIN mesas m ON f.mesa_id = m.id";
}

function listFiscales(PDO $db): void {
    $where = [];
    $params = [];
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $where[] = '(f.documento LIKE ? OR f.apellidos LIKE ? OR f.nombres LIKE ?)';
        $like = "%$q%";
        $params[] = $like; $params[] = $like; $params[] = $like;
    }
    if (!empty($_GET['partido_id'])) {
        $where[] = 'f.partido_id = ?';
        $params[] = (int)$_GET['partido_id'];
    }
    if (!empty($_GET['mesa_id'])) {
        $where[] = 'f.mesa_id = ?';
        $params[] = (int)$_GET['mesa_id'];
    }
    $sql = baseSelect();
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY f.apellidos, f.nombres';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getFiscal(PDO $db, int $id): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE f.id = ?');
    $stmt->execute([$id]);
    $f = $stmt->fetch();
    if (!$f) jsonError('Fiscal no encontrado', 404);
    jsonResponse($f);
}

function createFiscal(PDO $db): void {
    $data = getBody();
    foreach (['apellidos', 'nombres', 'documento'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $tipo = $data['tipo'] ?? 'mesa';
    if (!in_array($tipo, ['mesa', 'general'])) jsonError('Tipo inválido');

    $stmt = $db->prepare(
        "INSERT INTO fiscales (apellidos, nombres, documento, celular, partido_id, mesa_id, tipo)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $data['apellidos'],
        $data['nombres'],
        $data['documento'],
        $data['celular'] ?? null,
        !empty($data['partido_id']) ? (int)$data['partido_id'] : null,
        !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null,
        $tipo,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Fiscal creado'], 201);
}

function updateFiscal(PDO $db, int $id): void {
    $data = getBody();
    foreach (['apellidos', 'nombres', 'documento'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $tipo = $data['tipo'] ?? 'mesa';
    if (!in_array($tipo, ['mesa', 'general'])) jsonError('Tipo inválido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    $stmt = $db->prepare(
        "UPDATE fiscales SET apellidos=?, nombres=?, documento=?, celular=?, partido_id=?, mesa_id=?, tipo=?, activo=?, updated_at=NOW()
         WHERE id=?"
    );
    $stmt->execute([
        $data['apellidos'],
        $data['nombres'],
        $data['documento'],
        $data['celular'] ?? null,
        !empty($data['partido_id']) ? (int)$data['partido_id'] : null,
        !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null,
        $tipo,
        $activo,
        $id,
    ]);
    jsonResponse(['message' => 'Fiscal actualizado']);
}

function deleteFiscal(PDO $db, int $id): void {
    $stmt = $db->prepare("DELETE FROM fiscales WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Fiscal eliminado']);
}
