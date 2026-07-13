<?php
// Personas (pacientes/beneficiarios) — los datos viven en la tabla `personas`
// ya existente en la base del sistema de stock de la farmacia
// (stock_control.personas, ~96.000 registros), compartida entre módulos.
// No se gestiona domicilio estructurado (calle/numeración/barrio) desde acá:
// solo se lee/escribe `calle` como domicilio simple para no pisar los datos
// ya cargados del padrón.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();
$personasTable = '`' . PEOPLE_DB . '`.`personas`';

match($method) {
    'GET'    => (requireAuth() && ($id ? getPersona($db, $personasTable, $id) : listPersonas($db, $personasTable))),
    'POST'   => (requireAuth() && createPersona($db, $personasTable)),
    'PUT'    => (requireAuth() && ($id ? updatePersona($db, $personasTable, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function mapPersona(array $p): array {
    $domicilio = trim(($p['calle'] ?? '') . ' ' . ($p['numeracion'] ?? ''));
    if (!empty($p['barrio'])) {
        $domicilio = $domicilio !== '' ? "$domicilio, {$p['barrio']}" : $p['barrio'];
    }
    return [
        'id'         => (int)$p['id'],
        'documento'  => $p['documento'],
        'apellidos'  => $p['apellido'],
        'nombres'    => $p['nombre'],
        'domicilio'  => $domicilio !== '' ? $domicilio : null,
        'created_at' => $p['created_at'],
        'updated_at' => $p['updated_at'],
    ];
}

function listPersonas(PDO $db, string $table): void {
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $stmt = $db->prepare(
            "SELECT * FROM $table
             WHERE active = 1 AND (documento LIKE ? OR apellido LIKE ? OR nombre LIKE ?)
             ORDER BY apellido, nombre LIMIT 50"
        );
        $like = "%$q%";
        $stmt->execute([$like, $like, $like]);
    } else {
        $stmt = $db->query("SELECT * FROM $table WHERE active = 1 ORDER BY apellido, nombre LIMIT 50");
    }
    jsonResponse(array_map('mapPersona', $stmt->fetchAll()));
}

function getPersona(PDO $db, string $table, int $id): void {
    $stmt = $db->prepare("SELECT * FROM $table WHERE id = ?");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Persona no encontrada', 404);
    jsonResponse(mapPersona($p));
}

function createPersona(PDO $db, string $table): void {
    $data = getBody();
    if (empty($data['documento'])) jsonError('El documento es requerido');
    if (empty($data['apellidos'])) jsonError('Los apellidos son requeridos');
    if (empty($data['nombres'])) jsonError('Los nombres son requeridos');

    try {
        $stmt = $db->prepare(
            "INSERT INTO $table (tipo_documento, documento, apellido, nombre, calle)
             VALUES ('1', ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['documento'],
            $data['apellidos'],
            $data['nombres'],
            $data['domicilio'] ?? null,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Persona creada'], 201);
    } catch (\PDOException $e) {
        jsonError('Error al crear persona: ' . $e->getMessage(), 500);
    }
}

function updatePersona(PDO $db, string $table, int $id): void {
    $data = getBody();
    if (empty($data['documento'])) jsonError('El documento es requerido');
    if (empty($data['apellidos'])) jsonError('Los apellidos son requeridos');
    if (empty($data['nombres'])) jsonError('Los nombres son requeridos');

    // Solo se actualizan los campos que gestiona esta app; el resto del
    // domicilio estructurado (numeracion/piso/departamento/barrio) del
    // padrón original queda intacto.
    try {
        $stmt = $db->prepare(
            "UPDATE $table SET documento=?, apellido=?, nombre=?, calle=?, updated_at=NOW()
             WHERE id=?"
        );
        $stmt->execute([
            $data['documento'],
            $data['apellidos'],
            $data['nombres'],
            $data['domicilio'] ?? null,
            $id,
        ]);
        jsonResponse(['message' => 'Persona actualizada']);
    } catch (\PDOException $e) {
        jsonError('Error al actualizar persona: ' . $e->getMessage(), 500);
    }
}
