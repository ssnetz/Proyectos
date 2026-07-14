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

function calcularEdad(?string $fechaNacimiento): ?int {
    if (!$fechaNacimiento) return null;
    try {
        $nacimiento = new DateTime($fechaNacimiento);
        return $nacimiento->diff(new DateTime())->y;
    } catch (\Exception $e) {
        return null;
    }
}

function mapPersona(array $p): array {
    $domicilio = trim(($p['calle'] ?? '') . ' ' . ($p['numeracion'] ?? ''));
    if (!empty($p['barrio'])) {
        $domicilio = $domicilio !== '' ? "$domicilio, {$p['barrio']}" : $p['barrio'];
    }
    return [
        'id'                => (int)$p['id'],
        'documento'         => $p['documento'],
        'apellidos'         => $p['apellido'],
        'nombres'           => $p['nombre'],
        'domicilio'         => $domicilio !== '' ? $domicilio : null,
        'fecha_nacimiento'  => $p['fecha_nacimiento'] ?? null,
        'edad'              => calcularEdad($p['fecha_nacimiento'] ?? null),
        'email'             => $p['email'] ?? null,
        'celular'           => $p['celular'] ?? null,
        'created_at'        => $p['created_at'],
        'updated_at'        => $p['updated_at'],
    ];
}

function validarDatosContacto(array $data): void {
    if (empty($data['fecha_nacimiento'])) jsonError('La fecha de nacimiento es requerida');
    if (empty($data['celular'])) jsonError('El celular/teléfono es requerido');
    if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) jsonError('El email no es válido');
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
    validarDatosContacto($data);

    try {
        $stmt = $db->prepare(
            "INSERT INTO $table (tipo_documento, documento, apellido, nombre, calle, fecha_nacimiento, email, celular)
             VALUES ('1', ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['documento'],
            $data['apellidos'],
            $data['nombres'],
            $data['domicilio'] ?? null,
            $data['fecha_nacimiento'],
            $data['email'] ?? null,
            $data['celular'],
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Persona creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe una persona con ese documento');
        jsonError('Error al crear persona: ' . $e->getMessage(), 500);
    }
}

function updatePersona(PDO $db, string $table, int $id): void {
    $data = getBody();
    if (empty($data['documento'])) jsonError('El documento es requerido');
    if (empty($data['apellidos'])) jsonError('Los apellidos son requeridos');
    if (empty($data['nombres'])) jsonError('Los nombres son requeridos');
    validarDatosContacto($data);

    // Solo se actualizan los campos que gestiona esta app; el resto del
    // domicilio estructurado (numeracion/piso/departamento/barrio) del
    // padrón original queda intacto.
    try {
        $stmt = $db->prepare(
            "UPDATE $table SET documento=?, apellido=?, nombre=?, calle=?,
                fecha_nacimiento=?, email=?, celular=?, updated_at=NOW()
             WHERE id=?"
        );
        $stmt->execute([
            $data['documento'],
            $data['apellidos'],
            $data['nombres'],
            $data['domicilio'] ?? null,
            $data['fecha_nacimiento'],
            $data['email'] ?? null,
            $data['celular'],
            $id,
        ]);
        jsonResponse(['message' => 'Persona actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe una persona con ese documento');
        jsonError('Error al actualizar persona: ' . $e->getMessage(), 500);
    }
}
