<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match (true) {
    $method === 'GET'    && $id !== null => (requireAuth() && getPersona($db, $id)),
    $method === 'GET'                   => (requireAuth() && listPersonas($db)),
    $method === 'POST'                  => createPersona($db, requireAuth()),
    $method === 'PUT'   && $id !== null => updatePersona($db, $id, requireAuth()),
    $method === 'DELETE'&& $id !== null => deletePersona($db, $id, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listPersonas(PDO $db): void {
    $search     = $_GET['search']      ?? '';
    $activeOnly = ($_GET['active_only'] ?? '1') !== '0';

    $sql    = "SELECT * FROM personas WHERE 1=1";
    $params = [];

    if ($activeOnly) {
        $sql .= " AND active = 1";
    }
    if ($search !== '') {
        $sql    .= " AND (documento LIKE ? OR apellido LIKE ? OR nombre LIKE ?)";
        $like    = "%{$search}%";
        $params  = array_merge($params, [$like, $like, $like]);
    }

    $sql .= " ORDER BY apellido, nombre";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getPersona(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM personas WHERE id = ?");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Persona no encontrada', 404);
    jsonResponse($p);
}

function createPersona(PDO $db, array $auth): void {
    $data = getBody();
    foreach (['documento', 'apellido'] as $f) {
        if (empty($data[$f])) jsonError("Campo requerido: $f");
    }

    $stmt = $db->prepare(
        "INSERT INTO personas
         (tipo_documento, documento, apellido, nombre, sexo,
          calle, numeracion, departamento, piso, barrio, cuit_cuil)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    try {
        $stmt->execute([
            $data['tipo_documento'] ?? '1',
            trim($data['documento']),
            trim($data['apellido']),
            $data['nombre']       ?? null,
            $data['sexo']         ?? null,
            $data['calle']        ?? null,
            $data['numeracion']   ?? null,
            $data['departamento'] ?? null,
            $data['piso']         ?? null,
            $data['barrio']       ?? null,
            $data['cuit_cuil']    ?? null,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe una persona con ese documento');
        throw $e;
    }

    $newId = (int)$db->lastInsertId();
    $stmt  = $db->prepare("SELECT * FROM personas WHERE id = ?");
    $stmt->execute([$newId]);
    jsonResponse($stmt->fetch(), 201);
}

function updatePersona(PDO $db, int $id, array $auth): void {
    $data = getBody();
    foreach (['documento', 'apellido'] as $f) {
        if (empty($data[$f])) jsonError("Campo requerido: $f");
    }

    $stmt = $db->prepare(
        "UPDATE personas SET
            tipo_documento = ?, documento = ?, apellido = ?, nombre = ?, sexo = ?,
            calle = ?, numeracion = ?, departamento = ?, piso = ?, barrio = ?, cuit_cuil = ?,
            updated_at = NOW()
         WHERE id = ?"
    );
    try {
        $stmt->execute([
            $data['tipo_documento'] ?? '1',
            trim($data['documento']),
            trim($data['apellido']),
            $data['nombre']       ?? null,
            $data['sexo']         ?? null,
            $data['calle']        ?? null,
            $data['numeracion']   ?? null,
            $data['departamento'] ?? null,
            $data['piso']         ?? null,
            $data['barrio']       ?? null,
            $data['cuit_cuil']    ?? null,
            $id,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe una persona con ese documento');
        throw $e;
    }

    if ($stmt->rowCount() === 0) {
        $check = $db->prepare("SELECT id FROM personas WHERE id = ?");
        $check->execute([$id]);
        if (!$check->fetch()) jsonError('Persona no encontrada', 404);
    }

    $stmt = $db->prepare("SELECT * FROM personas WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

function deletePersona(PDO $db, int $id, array $auth): void {
    $stmt = $db->prepare("UPDATE personas SET active = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('Persona no encontrada', 404);
    jsonResponse(['message' => 'Persona desactivada']);
}
