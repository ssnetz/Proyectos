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
$eleccionId = requireEleccionScope();

match($method) {
    'GET'    => ($id ? getLista($db, $id, $municipioId, $eleccionId) : listListas($db, $municipioId, $eleccionId)),
    'POST'   => createLista($db, $municipioId, $eleccionId),
    'PUT'    => ($id ? updateLista($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteLista($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT l.*, p.nombre AS partido_nombre, p.color AS partido_color, c.nombre AS cargo_nombre,
                   (SELECT COUNT(*) FROM candidatos WHERE lista_id = l.id) AS candidatos_count
            FROM listas l
            JOIN partidos p ON l.partido_id = p.id
            JOIN cargos c ON l.cargo_id = c.id";
}

function listListas(PDO $db, int $municipioId, int $eleccionId): void {
    $where = ['l.municipio_id = ?', 'l.eleccion_id = ?'];
    $params = [$municipioId, $eleccionId];
    if (!empty($_GET['cargo_id'])) {
        $where[] = 'l.cargo_id = ?';
        $params[] = (int)$_GET['cargo_id'];
    }
    if (!empty($_GET['partido_id'])) {
        $where[] = 'l.partido_id = ?';
        $params[] = (int)$_GET['partido_id'];
    }
    $sql = baseSelect() . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY c.orden, p.nombre, l.numero';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getLista(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE l.id = ? AND l.municipio_id = ? AND l.eleccion_id = ?');
    $stmt->execute([$id, $municipioId, $eleccionId]);
    $l = $stmt->fetch();
    if (!$l) jsonError('Lista no encontrada', 404);
    jsonResponse($l);
}

// Verifica que el partido sea del municipio actual y que el cargo sea del
// municipio Y la elección actual, para que un admin no pueda (por error o
// manipulando el request) armar una lista que mezcle datos de otro
// municipio o de otra elección.
function validatePartidoCargoMunicipio(PDO $db, int $partidoId, int $cargoId, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare("SELECT municipio_id FROM partidos WHERE id = ?");
    $stmt->execute([$partidoId]);
    if ((int)$stmt->fetchColumn() !== $municipioId) jsonError('El partido no pertenece a este municipio', 400);

    $stmt = $db->prepare("SELECT municipio_id, eleccion_id FROM cargos WHERE id = ?");
    $stmt->execute([$cargoId]);
    $cargo = $stmt->fetch();
    if (!$cargo || (int)$cargo['municipio_id'] !== $municipioId || (int)$cargo['eleccion_id'] !== $eleccionId) {
        jsonError('El cargo no pertenece a esta elección', 400);
    }
}

function createLista(PDO $db, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['partido_id', 'cargo_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    validatePartidoCargoMunicipio($db, (int)$data['partido_id'], (int)$data['cargo_id'], $municipioId, $eleccionId);

    try {
        $stmt = $db->prepare(
            "INSERT INTO listas (municipio_id, eleccion_id, partido_id, cargo_id, numero, nombre) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $municipioId, $eleccionId, (int)$data['partido_id'], (int)$data['cargo_id'], $data['numero'], $data['nombre'] ?? null,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Lista creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe una lista con ese número para ese cargo', 409);
        jsonError('Error al crear lista: ' . $e->getMessage(), 500);
    }
}

function updateLista(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['partido_id', 'cargo_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    validatePartidoCargoMunicipio($db, (int)$data['partido_id'], (int)$data['cargo_id'], $municipioId, $eleccionId);

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    try {
        $stmt = $db->prepare(
            "UPDATE listas SET partido_id=?, cargo_id=?, numero=?, nombre=?, activo=?, updated_at=NOW()
             WHERE id=? AND municipio_id=? AND eleccion_id=?"
        );
        $stmt->execute([
            (int)$data['partido_id'], (int)$data['cargo_id'], $data['numero'], $data['nombre'] ?? null, $activo,
            $id, $municipioId, $eleccionId,
        ]);
        jsonResponse(['message' => 'Lista actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe una lista con ese número para ese cargo', 409);
        jsonError('Error al actualizar lista: ' . $e->getMessage(), 500);
    }
}

function deleteLista(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $check = $db->prepare("SELECT COUNT(*) FROM candidatos WHERE lista_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: la lista tiene candidatos cargados', 409);
    }
    $stmt = $db->prepare("DELETE FROM listas WHERE id = ? AND municipio_id = ? AND eleccion_id = ?");
    $stmt->execute([$id, $municipioId, $eleccionId]);
    jsonResponse(['message' => 'Lista eliminada']);
}
