<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

$municipioId = ($method === 'DELETE')
    ? requireMunicipioScope(requireAdmin())['municipio_id']
    : requireMunicipioScope()['municipio_id'];

match($method) {
    'GET'    => ($id ? getFiscal($db, $id, $municipioId) : listFiscales($db, $municipioId)),
    'POST'   => createFiscal($db, $municipioId),
    'PUT'    => ($id ? updateFiscal($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteFiscal($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT f.*, p.nombre AS partido_nombre, m.numero AS mesa_numero
            FROM fiscales f
            LEFT JOIN partidos p ON f.partido_id = p.id
            LEFT JOIN mesas m ON f.mesa_id = m.id";
}

function listFiscales(PDO $db, int $municipioId): void {
    $where = ['f.municipio_id = ?'];
    $params = [$municipioId];
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $where[] = '(f.documento LIKE ? OR f.apellidos LIKE ? OR f.nombres LIKE ?)';
        $like = "%$q%";
        $params[] = $like; $params[] = $like; $params[] = $like;
    }
    if (!empty($_GET['partido_id'])) {
        $where[] = 'f.partido_id = ?';
        $params[] = (int)$_GET['partido_id'];
    }
    if (!empty($_GET['mesa_id'])) {
        $where[] = 'f.mesa_id = ?';
        $params[] = (int)$_GET['mesa_id'];
    }
    $sql = baseSelect() . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY f.apellidos, f.nombres';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getFiscal(PDO $db, int $id, int $municipioId): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE f.id = ? AND f.municipio_id = ?');
    $stmt->execute([$id, $municipioId]);
    $f = $stmt->fetch();
    if (!$f) jsonError('Fiscal no encontrado', 404);
    jsonResponse($f);
}

// partido_id/mesa_id son opcionales, pero si vienen deben ser del municipio actual.
function validateOptionalRefsMunicipio(PDO $db, ?int $partidoId, ?int $mesaId, int $municipioId): void {
    if ($partidoId) {
        $stmt = $db->prepare("SELECT municipio_id FROM partidos WHERE id = ?");
        $stmt->execute([$partidoId]);
        if ((int)$stmt->fetchColumn() !== $municipioId) jsonError('El partido no pertenece a este municipio', 400);
    }
    if ($mesaId) {
        $stmt = $db->prepare("SELECT municipio_id FROM mesas WHERE id = ?");
        $stmt->execute([$mesaId]);
        if ((int)$stmt->fetchColumn() !== $municipioId) jsonError('La mesa no pertenece a este municipio', 400);
    }
}

function createFiscal(PDO $db, int $municipioId): void {
    $data = getBody();
    foreach (['apellidos', 'nombres', 'documento'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $tipo = $data['tipo'] ?? 'mesa';
    if (!in_array($tipo, ['mesa', 'general'])) jsonError('Tipo inválido');

    $partidoId = !empty($data['partido_id']) ? (int)$data['partido_id'] : null;
    $mesaId = !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null;
    validateOptionalRefsMunicipio($db, $partidoId, $mesaId, $municipioId);

    $stmt = $db->prepare(
        "INSERT INTO fiscales (municipio_id, apellidos, nombres, documento, celular, partido_id, mesa_id, tipo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $municipioId,
        $data['apellidos'],
        $data['nombres'],
        $data['documento'],
        $data['celular'] ?? null,
        $partidoId,
        $mesaId,
        $tipo,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Fiscal creado'], 201);
}

function updateFiscal(PDO $db, int $id, int $municipioId): void {
    $data = getBody();
    foreach (['apellidos', 'nombres', 'documento'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $tipo = $data['tipo'] ?? 'mesa';
    if (!in_array($tipo, ['mesa', 'general'])) jsonError('Tipo inválido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;
    $partidoId = !empty($data['partido_id']) ? (int)$data['partido_id'] : null;
    $mesaId = !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null;
    validateOptionalRefsMunicipio($db, $partidoId, $mesaId, $municipioId);

    $stmt = $db->prepare(
        "UPDATE fiscales SET apellidos=?, nombres=?, documento=?, celular=?, partido_id=?, mesa_id=?, tipo=?, activo=?, updated_at=NOW()
         WHERE id=? AND municipio_id=?"
    );
    $stmt->execute([
        $data['apellidos'],
        $data['nombres'],
        $data['documento'],
        $data['celular'] ?? null,
        $partidoId,
        $mesaId,
        $tipo,
        $activo,
        $id,
        $municipioId,
    ]);
    jsonResponse(['message' => 'Fiscal actualizado']);
}

function deleteFiscal(PDO $db, int $id, int $municipioId): void {
    $stmt = $db->prepare("DELETE FROM fiscales WHERE id = ? AND municipio_id = ?");
    $stmt->execute([$id, $municipioId]);
    jsonResponse(['message' => 'Fiscal eliminado']);
}
