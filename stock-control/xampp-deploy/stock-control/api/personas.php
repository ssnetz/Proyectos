<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match ($method) {
    'GET'    => (requireAuth() && ($id ? getPersona($db, $id) : listPersonas($db))),
    'POST'   => createPersona($db, requireAuth()),
    'PUT'    => $id ? updatePersona($db, $id, requireAuth()) : jsonError('ID requerido', 400),
    'DELETE' => $id ? deletePersona($db, $id, requireAdmin()) : jsonError('ID requerido', 400),
    default  => jsonError('Método no permitido', 405),
};

function listPersonas(PDO $db): void {
    $search = trim($_GET['search'] ?? '');
    $limit  = min((int)($_GET['limit'] ?? 50), 200);
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $offset = ($page - 1) * $limit;

    $where  = "WHERE active = 1";
    $params = [];

    if ($search !== '') {
        $like = "%$search%";
        $where .= " AND (documento LIKE ? OR apellido LIKE ? OR nombre LIKE ? OR CONCAT(apellido,' ',nombre) LIKE ?)";
        $params = [$like, $like, $like, $like];
    }

    $countStmt = $db->prepare("SELECT COUNT(*) FROM personas $where");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare(
        "SELECT id, tipo_documento, documento, apellido, nombre, sexo,
                calle, numeracion, departamento, piso, barrio, cuit_cuil, active
         FROM personas $where
         ORDER BY apellido, nombre
         LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);

    jsonResponse([
        'data'  => $stmt->fetchAll(),
        'total' => $total,
        'page'  => $page,
        'limit' => $limit,
        'pages' => $limit > 0 ? (int)ceil($total / $limit) : 1,
    ]);
}

function getPersona(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT id, tipo_documento, documento, apellido, nombre, sexo,
                calle, numeracion, departamento, piso, barrio, cuit_cuil, active
         FROM personas WHERE id = ?"
    );
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Persona no encontrada', 404);
    jsonResponse($p);
}

function createPersona(PDO $db, array $auth): void {
    $data = getBody();
    if (empty($data['documento'])) jsonError('El documento es requerido');
    if (empty($data['apellido']))  jsonError('El apellido es requerido');

    try {
        $stmt = $db->prepare(
            "INSERT INTO personas
             (tipo_documento, documento, apellido, nombre, sexo, calle, numeracion,
              departamento, piso, barrio, cuit_cuil)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['tipo_documento'] ?? '1',
            trim($data['documento']),
            strtoupper(trim($data['apellido'])),
            strtoupper(trim($data['nombre'] ?? '')),
            $data['sexo']          ?? null,
            strtoupper(trim($data['calle']         ?? '')),
            $data['numeracion']    ?? null,
            $data['departamento']  ?? null,
            $data['piso']          ?? null,
            strtoupper(trim($data['barrio']        ?? '')),
            $data['cuit_cuil']     ?? null,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Persona creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El documento ya existe', 409);
        jsonError('Error al crear: ' . $e->getMessage(), 500);
    }
}

function updatePersona(PDO $db, int $id, array $auth): void {
    $data = getBody();
    if (empty($data['documento'])) jsonError('El documento es requerido');
    if (empty($data['apellido']))  jsonError('El apellido es requerido');

    try {
        $stmt = $db->prepare(
            "UPDATE personas SET
               tipo_documento=?, documento=?, apellido=?, nombre=?, sexo=?,
               calle=?, numeracion=?, departamento=?, piso=?, barrio=?, cuit_cuil=?,
               updated_at=NOW()
             WHERE id=?"
        );
        $stmt->execute([
            $data['tipo_documento'] ?? '1',
            trim($data['documento']),
            strtoupper(trim($data['apellido'])),
            strtoupper(trim($data['nombre'] ?? '')),
            $data['sexo']         ?? null,
            strtoupper(trim($data['calle']        ?? '')),
            $data['numeracion']   ?? null,
            $data['departamento'] ?? null,
            $data['piso']         ?? null,
            strtoupper(trim($data['barrio']       ?? '')),
            $data['cuit_cuil']    ?? null,
            $id,
        ]);
        jsonResponse(['message' => 'Persona actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El documento ya existe', 409);
        jsonError('Error al actualizar: ' . $e->getMessage(), 500);
    }
}

function deletePersona(PDO $db, int $id, array $auth): void {
    $stmt = $db->prepare("UPDATE personas SET active = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Persona desactivada']);
}
