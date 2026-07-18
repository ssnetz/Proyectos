<?php
// Padrón de electores. Dataset propio de Electis, pensado para cargarse en
// bloque desde el padrón oficial de cada municipio (la carga masiva por
// archivo queda para una siguiente etapa; por ahora se administra registro
// a registro, igual que el resto de los catálogos).

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();
$municipioId = requireMunicipioScope()['municipio_id'];

match($method) {
    'GET'    => ($id ? getElector($db, $id, $municipioId) : listElectores($db, $municipioId)),
    'POST'   => createElector($db, $municipioId),
    'PUT'    => ($id ? updateElector($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT e.*, m.numero AS mesa_numero, es.nombre AS establecimiento_nombre
            FROM electores e
            LEFT JOIN mesas m ON e.mesa_id = m.id
            LEFT JOIN establecimientos es ON m.establecimiento_id = es.id";
}

function listElectores(PDO $db, int $municipioId): void {
    $where = ['e.municipio_id = ?'];
    $params = [$municipioId];
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

    $sql = baseSelect() . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY e.apellido, e.nombre LIMIT 100';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getElector(PDO $db, int $id, int $municipioId): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE e.id = ? AND e.municipio_id = ?');
    $stmt->execute([$id, $municipioId]);
    $e = $stmt->fetch();
    if (!$e) jsonError('Elector no encontrado', 404);
    jsonResponse($e);
}

function validateMesaMunicipio(PDO $db, ?int $mesaId, int $municipioId): void {
    if (!$mesaId) return;
    $stmt = $db->prepare("SELECT municipio_id FROM mesas WHERE id = ?");
    $stmt->execute([$mesaId]);
    if ((int)$stmt->fetchColumn() !== $municipioId) jsonError('La mesa no pertenece a este municipio', 400);
}

function createElector(PDO $db, int $municipioId): void {
    $data = getBody();
    foreach (['documento', 'apellido', 'nombre'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    $mesaId = !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null;
    validateMesaMunicipio($db, $mesaId, $municipioId);

    try {
        $stmt = $db->prepare(
            "INSERT INTO electores (municipio_id, orden, documento, apellido, nombre, sexo, fecha_nacimiento, domicilio, mesa_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $municipioId,
            !empty($data['orden']) ? (int)$data['orden'] : null,
            $data['documento'],
            $data['apellido'],
            $data['nombre'],
            $data['sexo'] ?? null,
            $data['fecha_nacimiento'] ?? null,
            $data['domicilio'] ?? null,
            $mesaId,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Elector creado'], 201);
    } catch (\PDOException $e) {
        jsonError('Error al crear elector: ' . $e->getMessage(), 500);
    }
}

function updateElector(PDO $db, int $id, int $municipioId): void {
    $data = getBody();
    foreach (['documento', 'apellido', 'nombre'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    $mesaId = !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null;
    validateMesaMunicipio($db, $mesaId, $municipioId);

    $stmt = $db->prepare(
        "UPDATE electores SET orden=?, documento=?, apellido=?, nombre=?, sexo=?, fecha_nacimiento=?, domicilio=?, mesa_id=?, votado=?, updated_at=NOW()
         WHERE id=? AND municipio_id=?"
    );
    $stmt->execute([
        !empty($data['orden']) ? (int)$data['orden'] : null,
        $data['documento'],
        $data['apellido'],
        $data['nombre'],
        $data['sexo'] ?? null,
        $data['fecha_nacimiento'] ?? null,
        $data['domicilio'] ?? null,
        $mesaId,
        isset($data['votado']) ? (int)(bool)$data['votado'] : 0,
        $id,
        $municipioId,
    ]);
    jsonResponse(['message' => 'Elector actualizado']);
}
