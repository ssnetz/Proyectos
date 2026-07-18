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
    'GET'    => ($id ? getCandidato($db, $id, $municipioId, $eleccionId) : listCandidatos($db, $municipioId, $eleccionId)),
    'POST'   => createCandidato($db, $municipioId, $eleccionId),
    'PUT'    => ($id ? updateCandidato($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteCandidato($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT ca.*, l.numero AS lista_numero, l.nombre AS lista_nombre,
                   p.nombre AS partido_nombre, c.nombre AS cargo_nombre
            FROM candidatos ca
            JOIN listas l ON ca.lista_id = l.id
            JOIN partidos p ON l.partido_id = p.id
            JOIN cargos c ON l.cargo_id = c.id";
}

function listCandidatos(PDO $db, int $municipioId, int $eleccionId): void {
    $where = ['l.municipio_id = ?', 'l.eleccion_id = ?'];
    $params = [$municipioId, $eleccionId];
    if (!empty($_GET['lista_id'])) {
        $where[] = 'ca.lista_id = ?';
        $params[] = (int)$_GET['lista_id'];
    }
    $sql = baseSelect() . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY l.numero, ca.orden';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getCandidato(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE ca.id = ? AND l.municipio_id = ? AND l.eleccion_id = ?');
    $stmt->execute([$id, $municipioId, $eleccionId]);
    $c = $stmt->fetch();
    if (!$c) jsonError('Candidato no encontrado', 404);
    jsonResponse($c);
}

// La lista indicada debe ser del municipio y la elección en curso, para no
// colgar candidatos de una lista de otro municipio o de otra elección.
function validateListaMunicipio(PDO $db, int $listaId, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare("SELECT municipio_id, eleccion_id FROM listas WHERE id = ?");
    $stmt->execute([$listaId]);
    $lista = $stmt->fetch();
    if (!$lista || (int)$lista['municipio_id'] !== $municipioId || (int)$lista['eleccion_id'] !== $eleccionId) {
        jsonError('La lista no pertenece a esta elección', 400);
    }
}

function createCandidato(PDO $db, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['lista_id', 'orden', 'apellidos', 'nombres'] as $field) {
        if (empty($data[$field]) && $data[$field] !== '0') jsonError("El campo $field es requerido");
    }
    validateListaMunicipio($db, (int)$data['lista_id'], $municipioId, $eleccionId);

    $stmt = $db->prepare(
        "INSERT INTO candidatos (lista_id, orden, apellidos, nombres, documento, titular) VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        (int)$data['lista_id'],
        (int)$data['orden'],
        $data['apellidos'],
        $data['nombres'],
        $data['documento'] ?? null,
        isset($data['titular']) ? (int)(bool)$data['titular'] : 1,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Candidato creado'], 201);
}

function updateCandidato(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['lista_id', 'orden', 'apellidos', 'nombres'] as $field) {
        if (empty($data[$field]) && $data[$field] !== '0') jsonError("El campo $field es requerido");
    }
    validateListaMunicipio($db, (int)$data['lista_id'], $municipioId, $eleccionId);

    $stmt = $db->prepare(
        "UPDATE candidatos ca
         JOIN listas l ON ca.lista_id = l.id
         SET ca.lista_id=?, ca.orden=?, ca.apellidos=?, ca.nombres=?, ca.documento=?, ca.titular=?, ca.updated_at=NOW()
         WHERE ca.id=? AND l.municipio_id=? AND l.eleccion_id=?"
    );
    $stmt->execute([
        (int)$data['lista_id'],
        (int)$data['orden'],
        $data['apellidos'],
        $data['nombres'],
        $data['documento'] ?? null,
        isset($data['titular']) ? (int)(bool)$data['titular'] : 1,
        $id,
        $municipioId,
        $eleccionId,
    ]);
    jsonResponse(['message' => 'Candidato actualizado']);
}

function deleteCandidato(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare(
        "DELETE ca FROM candidatos ca JOIN listas l ON ca.lista_id = l.id
         WHERE ca.id = ? AND l.municipio_id = ? AND l.eleccion_id = ?"
    );
    $stmt->execute([$id, $municipioId, $eleccionId]);
    jsonResponse(['message' => 'Candidato eliminado']);
}
