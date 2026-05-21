<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match(true) {
    $method === 'GET'    && $id !== null => (requireAuth() && getBeneficiario($db, $id)),
    $method === 'GET'                   => (requireAuth() && listBeneficiarios($db)),
    $method === 'POST'                  => createBeneficiario($db, requireAuth()),
    $method === 'PUT'   && $id !== null => updateBeneficiario($db, $id, requireAuth()),
    $method === 'DELETE'&& $id !== null => deleteBeneficiario($db, $id, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listBeneficiarios(PDO $db): void {
    $search     = $_GET['search'] ?? '';
    $activeOnly = ($_GET['active_only'] ?? '1') !== '0';

    $sql    = "SELECT * FROM beneficiarios WHERE 1=1";
    $params = [];

    if ($activeOnly) {
        $sql .= " AND active = 1";
    }
    if ($search !== '') {
        $sql   .= " AND (dni LIKE ? OR apellido LIKE ? OR nombre LIKE ?)";
        $like   = "%{$search}%";
        $params = array_merge($params, [$like, $like, $like]);
    }

    $sql .= " ORDER BY apellido, nombre";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getBeneficiario(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM beneficiarios WHERE id = ?");
    $stmt->execute([$id]);
    $b = $stmt->fetch();
    if (!$b) jsonError('Beneficiario no encontrado', 404);
    jsonResponse($b);
}

function createBeneficiario(PDO $db, array $auth): void {
    $data = getBody();
    foreach (['dni', 'apellido', 'nombre'] as $f) {
        if (empty($data[$f])) jsonError("Campo requerido: $f");
    }

    $stmt = $db->prepare(
        "INSERT INTO beneficiarios
         (dni, apellido, nombre, fecha_nacimiento, telefono, direccion, obra_social, numero_afiliado, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    try {
        $stmt->execute([
            trim($data['dni']),
            trim($data['apellido']),
            trim($data['nombre']),
            $data['fecha_nacimiento'] ?: null,
            $data['telefono']        ?? null,
            $data['direccion']       ?? null,
            $data['obra_social']     ?? null,
            $data['numero_afiliado'] ?? null,
            $data['observaciones']   ?? null,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe un beneficiario con ese DNI');
        throw $e;
    }

    $newId = (int)$db->lastInsertId();
    $stmt  = $db->prepare("SELECT * FROM beneficiarios WHERE id = ?");
    $stmt->execute([$newId]);
    jsonResponse($stmt->fetch(), 201);
}

function updateBeneficiario(PDO $db, int $id, array $auth): void {
    $data = getBody();
    foreach (['dni', 'apellido', 'nombre'] as $f) {
        if (empty($data[$f])) jsonError("Campo requerido: $f");
    }

    $stmt = $db->prepare(
        "UPDATE beneficiarios SET
            dni = ?, apellido = ?, nombre = ?, fecha_nacimiento = ?,
            telefono = ?, direccion = ?, obra_social = ?, numero_afiliado = ?,
            observaciones = ?, updated_at = NOW()
         WHERE id = ?"
    );
    try {
        $stmt->execute([
            trim($data['dni']),
            trim($data['apellido']),
            trim($data['nombre']),
            $data['fecha_nacimiento'] ?: null,
            $data['telefono']        ?? null,
            $data['direccion']       ?? null,
            $data['obra_social']     ?? null,
            $data['numero_afiliado'] ?? null,
            $data['observaciones']   ?? null,
            $id,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe un beneficiario con ese DNI');
        throw $e;
    }

    if ($stmt->rowCount() === 0) {
        $check = $db->prepare("SELECT id FROM beneficiarios WHERE id = ?");
        $check->execute([$id]);
        if (!$check->fetch()) jsonError('Beneficiario no encontrado', 404);
    }

    $stmt = $db->prepare("SELECT * FROM beneficiarios WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

function deleteBeneficiario(PDO $db, int $id, array $auth): void {
    $stmt = $db->prepare("UPDATE beneficiarios SET active = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('Beneficiario no encontrado', 404);
    jsonResponse(['message' => 'Beneficiario desactivado']);
}
