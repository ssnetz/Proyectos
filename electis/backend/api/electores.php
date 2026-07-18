<?php
// Padrón de electores. Dataset propio de Electis, pensado para cargarse en
// bloque desde el padrón oficial de cada municipio (la carga masiva por
// archivo queda para una siguiente etapa; por ahora se administra registro
// a registro, igual que el resto de los catálogos). Cada elección tiene su
// propio padrón: el mismo vecino puede aparecer en el de 2023 y en el de
// 2027 como registros distintos.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();
$municipioId = requireMunicipioScope()['municipio_id'];
$eleccionId = requireEleccionScope();

match($method) {
    'GET'    => ($id ? getElector($db, $id, $municipioId, $eleccionId) : listElectores($db, $municipioId, $eleccionId)),
    'POST'   => createElector($db, $municipioId, $eleccionId),
    'PUT'    => ($id ? updateElector($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT e.*, m.numero AS mesa_numero, es.nombre AS establecimiento_nombre
            FROM electores e
            LEFT JOIN mesas m ON e.mesa_id = m.id
            LEFT JOIN establecimientos es ON m.establecimiento_id = es.id";
}

function listElectores(PDO $db, int $municipioId, int $eleccionId): void {
    $where = ['e.municipio_id = ?', 'e.eleccion_id = ?'];
    $params = [$municipioId, $eleccionId];
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $where[] = '(e.documento LIKE ? OR e.apellido LIKE ? OR e.nombre LIKE ?)';
        $like = "%$q%";
        $params[] = $like; $params[] = $like; $params[] = $like;
    }
    $mesaId = !empty($_GET['mesa_id']) ? (int)$_GET['mesa_id'] : null;
    if ($mesaId) {
        $where[] = 'e.mesa_id = ?';
        $params[] = $mesaId;
    }
    $whereSql = implode(' AND ', $where);

    $limit = 50;
    $page = max(1, (int)($_GET['page'] ?? 1));
    $offset = ($page - 1) * $limit;

    $countStmt = $db->prepare("SELECT COUNT(*) FROM electores e WHERE $whereSql");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();
    $pages = max(1, (int)ceil($total / $limit));

    $sql = baseSelect() . " WHERE $whereSql ORDER BY e.apellido, e.nombre LIMIT $limit OFFSET $offset";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $mesa = null;
    if ($mesaId) {
        $mesaStmt = $db->prepare(
            "SELECT m.numero, m.electores_habilitados, es.nombre AS establecimiento_nombre
             FROM mesas m JOIN establecimientos es ON m.establecimiento_id = es.id
             WHERE m.id = ? AND m.municipio_id = ? AND m.eleccion_id = ?"
        );
        $mesaStmt->execute([$mesaId, $municipioId, $eleccionId]);
        $mesa = $mesaStmt->fetch() ?: null;

        if ($mesa) {
            // El padrón oficial trae su propio número de orden por mesa (columna
            // `orden`), que respeta el criterio real de la Justicia Electoral.
            // Reordenar por apellido/nombre en SQL no siempre reproduce ese mismo
            // criterio (acentos, apellidos compuestos, apóstrofes), así que se usa
            // `orden` como fuente de verdad y sólo se cae a apellido/nombre cuando
            // no hay orden cargado (p. ej. electores agregados a mano).
            $primeroStmt = $db->prepare(
                "SELECT apellido, nombre FROM electores WHERE mesa_id = ? AND municipio_id = ? AND eleccion_id = ?
                 ORDER BY (orden IS NULL), orden, apellido, nombre LIMIT 1"
            );
            $primeroStmt->execute([$mesaId, $municipioId, $eleccionId]);
            $mesa['primer_elector'] = $primeroStmt->fetch() ?: null;

            $ultimoStmt = $db->prepare(
                "SELECT apellido, nombre FROM electores WHERE mesa_id = ? AND municipio_id = ? AND eleccion_id = ?
                 ORDER BY (orden IS NULL), orden DESC, apellido DESC, nombre DESC LIMIT 1"
            );
            $ultimoStmt->execute([$mesaId, $municipioId, $eleccionId]);
            $mesa['ultimo_elector'] = $ultimoStmt->fetch() ?: null;
        }
    }

    jsonResponse([
        'data' => $stmt->fetchAll(),
        'meta' => [
            'total' => $total,
            'page' => $page,
            'pages' => $pages,
            'limit' => $limit,
            'mesa' => $mesa,
        ],
    ]);
}

function getElector(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE e.id = ? AND e.municipio_id = ? AND e.eleccion_id = ?');
    $stmt->execute([$id, $municipioId, $eleccionId]);
    $e = $stmt->fetch();
    if (!$e) jsonError('Elector no encontrado', 404);
    jsonResponse($e);
}

function validateMesaMunicipio(PDO $db, ?int $mesaId, int $municipioId, int $eleccionId): void {
    if (!$mesaId) return;
    $stmt = $db->prepare("SELECT municipio_id, eleccion_id FROM mesas WHERE id = ?");
    $stmt->execute([$mesaId]);
    $mesa = $stmt->fetch();
    if (!$mesa || (int)$mesa['municipio_id'] !== $municipioId || (int)$mesa['eleccion_id'] !== $eleccionId) {
        jsonError('La mesa no pertenece a esta elección', 400);
    }
}

function createElector(PDO $db, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['documento', 'apellido', 'nombre'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    $mesaId = !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null;
    validateMesaMunicipio($db, $mesaId, $municipioId, $eleccionId);

    try {
        $stmt = $db->prepare(
            "INSERT INTO electores (municipio_id, eleccion_id, orden, documento, tipo, apellido, nombre, sexo, fecha_nacimiento, domicilio, mesa_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $municipioId,
            $eleccionId,
            !empty($data['orden']) ? (int)$data['orden'] : null,
            $data['documento'],
            $data['tipo'] ?? null,
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

function updateElector(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['documento', 'apellido', 'nombre'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    $mesaId = !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null;
    validateMesaMunicipio($db, $mesaId, $municipioId, $eleccionId);

    $stmt = $db->prepare(
        "UPDATE electores SET orden=?, documento=?, tipo=?, apellido=?, nombre=?, sexo=?, fecha_nacimiento=?, domicilio=?, mesa_id=?, votado=?, updated_at=NOW()
         WHERE id=? AND municipio_id=? AND eleccion_id=?"
    );
    $stmt->execute([
        !empty($data['orden']) ? (int)$data['orden'] : null,
        $data['documento'],
        $data['tipo'] ?? null,
        $data['apellido'],
        $data['nombre'],
        $data['sexo'] ?? null,
        $data['fecha_nacimiento'] ?? null,
        $data['domicilio'] ?? null,
        $mesaId,
        isset($data['votado']) ? (int)(bool)$data['votado'] : 0,
        $id,
        $municipioId,
        $eleccionId,
    ]);
    jsonResponse(['message' => 'Elector actualizado']);
}
