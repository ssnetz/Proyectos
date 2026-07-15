<?php
// Padrón de electores. Dataset propio de Electis, pensado para cargarse en
// bloque desde el padrón oficial (la carga masiva por archivo queda para
// una siguiente etapa; por ahora se administra registro a registro, igual
// que el resto de los catálogos).

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getElector($db, $id) : listElectores($db))),
    'POST'   => (requireAuth() && createElector($db)),
    'PUT'    => (requireAuth() && ($id ? updateElector($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT e.*, m.numero AS mesa_numero, es.nombre AS establecimiento_nombre
            FROM electores e
            LEFT JOIN mesas m ON e.mesa_id = m.id
            LEFT JOIN establecimientos es ON m.establecimiento_id = es.id";
}

function listElectores(PDO $db): void {
    $where = [];
    $params = [];
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $where[] = '(e.documento LIKE ? OR e.apellido LIKE ? OR e.nombre LIKE ?)';
        $like = "%$q%";
        $params[] = $like; $params[] = $like; $params[] = $like;
    }
    if (!empty($_GET['mesa_id'])) {
        $where[] = 'e.mesa_id = ?';
        $params[] = (int)$_GET['mesa_id'];
    }

    $sql = baseSelect();
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY e.apellido, e.nombre LIMIT 100';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getElector(PDO $db, int $id): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE e.id = ?');
    $stmt->execute([$id]);
    $e = $stmt->fetch();
    if (!$e) jsonError('Elector no encontrado', 404);
    jsonResponse($e);
}

function createElector(PDO $db): void {
    $data = getBody();
    foreach (['documento', 'apellido', 'nombre'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    try {
        $stmt = $db->prepare(
            "INSERT INTO electores (orden, documento, apellido, nombre, sexo, fecha_nacimiento, domicilio, mesa_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            !empty($data['orden']) ? (int)$data['orden'] : null,
            $data['documento'],
            $data['apellido'],
            $data['nombre'],
            $data['sexo'] ?? null,
            $data['fecha_nacimiento'] ?? null,
            $data['domicilio'] ?? null,
            !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Elector creado'], 201);
    } catch (\PDOException $e) {
        jsonError('Error al crear elector: ' . $e->getMessage(), 500);
    }
}

function updateElector(PDO $db, int $id): void {
    $data = getBody();
    foreach (['documento', 'apellido', 'nombre'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $stmt = $db->prepare(
        "UPDATE electores SET orden=?, documento=?, apellido=?, nombre=?, sexo=?, fecha_nacimiento=?, domicilio=?, mesa_id=?, votado=?, updated_at=NOW()
         WHERE id=?"
    );
    $stmt->execute([
        !empty($data['orden']) ? (int)$data['orden'] : null,
        $data['documento'],
        $data['apellido'],
        $data['nombre'],
        $data['sexo'] ?? null,
        $data['fecha_nacimiento'] ?? null,
        $data['domicilio'] ?? null,
        !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null,
        isset($data['votado']) ? (int)(bool)$data['votado'] : 0,
        $id,
    ]);
    jsonResponse(['message' => 'Elector actualizado']);
}
