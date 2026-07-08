<?php
// Personas (pacientes/beneficiarios) — los datos viven en la base del sistema
// de stock de la farmacia (stock_control.people), compartida entre módulos.
// Este endpoint expone esa tabla con nombres en español para el resto de la app.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();
$peopleTable = '`' . PEOPLE_DB . '`.`people`';

match($method) {
    'GET'    => (requireAuth() && ($id ? getPersona($db, $peopleTable, $id) : listPersonas($db, $peopleTable))),
    'POST'   => (requireAuth() && createPersona($db, $peopleTable)),
    'PUT'    => (requireAuth() && ($id ? updatePersona($db, $peopleTable, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function mapPersona(array $p): array {
    return [
        'id'              => (int)$p['id'],
        'documento'       => $p['document_number'],
        'apellidos'       => $p['last_name'],
        'nombres'         => $p['first_name'],
        'domicilio'       => $p['address'],
        'celular'         => $p['phone'],
        'created_at'      => $p['created_at'],
        'updated_at'      => $p['updated_at'],
    ];
}

function listPersonas(PDO $db, string $table): void {
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $stmt = $db->prepare(
            "SELECT * FROM $table
             WHERE document_number LIKE ? OR first_name LIKE ? OR last_name LIKE ?
             ORDER BY last_name, first_name LIMIT 50"
        );
        $like = "%$q%";
        $stmt->execute([$like, $like, $like]);
    } else {
        $stmt = $db->query("SELECT * FROM $table ORDER BY last_name, first_name LIMIT 50");
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
            "INSERT INTO $table (document_number, first_name, last_name, address, phone)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['documento'],
            $data['nombres'],
            $data['apellidos'],
            $data['domicilio'] ?? null,
            $data['celular'] ?? null,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Persona creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El documento ya existe', 409);
        jsonError('Error al crear persona: ' . $e->getMessage(), 500);
    }
}

function updatePersona(PDO $db, string $table, int $id): void {
    $data = getBody();
    if (empty($data['documento'])) jsonError('El documento es requerido');
    if (empty($data['apellidos'])) jsonError('Los apellidos son requeridos');
    if (empty($data['nombres'])) jsonError('Los nombres son requeridos');

    try {
        $stmt = $db->prepare(
            "UPDATE $table SET document_number=?, first_name=?, last_name=?, address=?, phone=?, updated_at=NOW()
             WHERE id=?"
        );
        $stmt->execute([
            $data['documento'],
            $data['nombres'],
            $data['apellidos'],
            $data['domicilio'] ?? null,
            $data['celular'] ?? null,
            $id,
        ]);
        jsonResponse(['message' => 'Persona actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El documento ya existe', 409);
        jsonError('Error al actualizar persona: ' . $e->getMessage(), 500);
    }
}
