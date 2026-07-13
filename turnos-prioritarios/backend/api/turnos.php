<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();
$peopleTable = '`' . PEOPLE_DB . '`.`people`';

match($method) {
    'GET'    => (requireAuth() && ($id ? getTurno($db, $peopleTable, $id) : listTurnos($db, $peopleTable))),
    'POST'   => (requireAuth() && createTurno($db, $peopleTable)),
    'PUT'    => (requireAuth() && ($id ? updateTurno($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAuth() && ($id ? cancelTurno($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(string $peopleTable): string {
    return "SELECT t.*, pr.apellidos AS profesional_apellidos, pr.nombres AS profesional_nombres,
                   pr.especialidad AS profesional_especialidad,
                   i.nombre AS institucion_nombre,
                   p.document_number AS persona_documento, p.first_name AS persona_nombres, p.last_name AS persona_apellidos
            FROM turnos_prioritarios t
            JOIN profesionales pr ON t.profesional_id = pr.id
            JOIN instituciones i ON t.institucion_id = i.id
            LEFT JOIN $peopleTable p ON t.persona_id = p.id";
}

function listTurnos(PDO $db, string $peopleTable): void {
    $where  = [];
    $params = [];

    if (!empty($_GET['fecha'])) {
        $where[] = 't.fecha = ?';
        $params[] = $_GET['fecha'];
    }
    if (!empty($_GET['desde'])) {
        $where[] = 't.fecha >= ?';
        $params[] = $_GET['desde'];
    }
    if (!empty($_GET['hasta'])) {
        $where[] = 't.fecha <= ?';
        $params[] = $_GET['hasta'];
    }
    if (!empty($_GET['estado'])) {
        $where[] = 't.estado = ?';
        $params[] = $_GET['estado'];
    }
    if (!empty($_GET['profesional_id'])) {
        $where[] = 't.profesional_id = ?';
        $params[] = (int)$_GET['profesional_id'];
    }
    if (!empty($_GET['institucion_id'])) {
        $where[] = 't.institucion_id = ?';
        $params[] = (int)$_GET['institucion_id'];
    }
    if (!empty($_GET['persona_id'])) {
        $where[] = 't.persona_id = ?';
        $params[] = (int)$_GET['persona_id'];
    }

    $sql = baseSelect($peopleTable);
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY t.fecha, t.hora';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getTurno(PDO $db, string $peopleTable, int $id): void {
    $stmt = $db->prepare(baseSelect($peopleTable) . ' WHERE t.id = ?');
    $stmt->execute([$id]);
    $t = $stmt->fetch();
    if (!$t) jsonError('Turno no encontrado', 404);
    jsonResponse($t);
}

function validatePersona(PDO $db, string $peopleTable, int $personaId): void {
    $stmt = $db->prepare("SELECT id FROM $peopleTable WHERE id = ?");
    $stmt->execute([$personaId]);
    if (!$stmt->fetch()) jsonError('Persona no encontrada', 404);
}

function createTurno(PDO $db, string $peopleTable): void {
    $data = getBody();

    foreach (['persona_id', 'profesional_id', 'institucion_id', 'fecha', 'hora'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    validatePersona($db, $peopleTable, (int)$data['persona_id']);

    $prioridad = $data['prioridad'] ?? 'media';
    if (!in_array($prioridad, ['alta', 'media', 'baja'])) jsonError('Prioridad inválida');

    $stmt = $db->prepare(
        "INSERT INTO turnos_prioritarios (persona_id, profesional_id, institucion_id, fecha, hora, motivo, prioridad, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    try {
        $stmt->execute([
            (int)$data['persona_id'],
            (int)$data['profesional_id'],
            (int)$data['institucion_id'],
            $data['fecha'],
            $data['hora'],
            $data['motivo'] ?? null,
            $prioridad,
            $data['observaciones'] ?? null,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Turno otorgado'], 201);
    } catch (\PDOException $e) {
        jsonError('Error al crear turno: ' . $e->getMessage(), 500);
    }
}

function updateTurno(PDO $db, int $id): void {
    $data = getBody();

    foreach (['profesional_id', 'institucion_id', 'fecha', 'hora'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $prioridad = $data['prioridad'] ?? 'media';
    if (!in_array($prioridad, ['alta', 'media', 'baja'])) jsonError('Prioridad inválida');

    $estado = $data['estado'] ?? 'pendiente';
    if (!in_array($estado, ['pendiente', 'confirmado', 'atendido', 'cancelado'])) jsonError('Estado inválido');

    $stmt = $db->prepare(
        "UPDATE turnos_prioritarios
         SET profesional_id=?, institucion_id=?, fecha=?, hora=?, motivo=?, prioridad=?, estado=?, observaciones=?, updated_at=NOW()
         WHERE id=?"
    );
    $stmt->execute([
        (int)$data['profesional_id'],
        (int)$data['institucion_id'],
        $data['fecha'],
        $data['hora'],
        $data['motivo'] ?? null,
        $prioridad,
        $estado,
        $data['observaciones'] ?? null,
        $id,
    ]);
    jsonResponse(['message' => 'Turno actualizado']);
}

function cancelTurno(PDO $db, int $id): void {
    $stmt = $db->prepare("UPDATE turnos_prioritarios SET estado='cancelado', updated_at=NOW() WHERE id=?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Turno cancelado']);
}
