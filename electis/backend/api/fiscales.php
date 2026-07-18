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
$eleccionId = requireEleccionScope();

match($method) {
    'GET'    => ($id ? getFiscal($db, $id, $municipioId, $eleccionId) : listFiscales($db, $municipioId, $eleccionId)),
    'POST'   => createFiscal($db, $municipioId, $eleccionId),
    'PUT'    => ($id ? updateFiscal($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteFiscal($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT f.*, p.nombre AS partido_nombre, m.numero AS mesa_numero
            FROM fiscales f
            LEFT JOIN partidos p ON f.partido_id = p.id
            LEFT JOIN mesas m ON f.mesa_id = m.id";
}

function listFiscales(PDO $db, int $municipioId, int $eleccionId): void {
    $where = ['f.municipio_id = ?', 'f.eleccion_id = ?'];
    $params = [$municipioId, $eleccionId];
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

function getFiscal(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE f.id = ? AND f.municipio_id = ? AND f.eleccion_id = ?');
    $stmt->execute([$id, $municipioId, $eleccionId]);
    $f = $stmt->fetch();
    if (!$f) jsonError('Fiscal no encontrado', 404);
    jsonResponse($f);
}

// partido_id es opcional, pero si viene debe ser del municipio actual
// (los partidos son compartidos entre elecciones). mesa_id es opcional,
// pero si viene debe ser del municipio Y la elección actual (las mesas sí
// son exclusivas de cada elección).
function validateOptionalRefsMunicipio(PDO $db, ?int $partidoId, ?int $mesaId, int $municipioId, int $eleccionId): void {
    if ($partidoId) {
        $stmt = $db->prepare("SELECT municipio_id FROM partidos WHERE id = ?");
        $stmt->execute([$partidoId]);
        if ((int)$stmt->fetchColumn() !== $municipioId) jsonError('El partido no pertenece a este municipio', 400);
    }
    if ($mesaId) {
        $stmt = $db->prepare("SELECT municipio_id, eleccion_id FROM mesas WHERE id = ?");
        $stmt->execute([$mesaId]);
        $mesa = $stmt->fetch();
        if (!$mesa || (int)$mesa['municipio_id'] !== $municipioId || (int)$mesa['eleccion_id'] !== $eleccionId) {
            jsonError('La mesa no pertenece a esta elección', 400);
        }
    }
}

function createFiscal(PDO $db, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['apellidos', 'nombres', 'documento'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $tipo = $data['tipo'] ?? 'mesa';
    if (!in_array($tipo, ['mesa', 'general'])) jsonError('Tipo inválido');

    $partidoId = !empty($data['partido_id']) ? (int)$data['partido_id'] : null;
    $mesaId = !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null;
    validateOptionalRefsMunicipio($db, $partidoId, $mesaId, $municipioId, $eleccionId);

    $stmt = $db->prepare(
        "INSERT INTO fiscales (municipio_id, eleccion_id, apellidos, nombres, documento, celular, partido_id, mesa_id, tipo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $municipioId,
        $eleccionId,
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

function updateFiscal(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['apellidos', 'nombres', 'documento'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }

    $tipo = $data['tipo'] ?? 'mesa';
    if (!in_array($tipo, ['mesa', 'general'])) jsonError('Tipo inválido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;
    $partidoId = !empty($data['partido_id']) ? (int)$data['partido_id'] : null;
    $mesaId = !empty($data['mesa_id']) ? (int)$data['mesa_id'] : null;
    validateOptionalRefsMunicipio($db, $partidoId, $mesaId, $municipioId, $eleccionId);

    $stmt = $db->prepare(
        "UPDATE fiscales SET apellidos=?, nombres=?, documento=?, celular=?, partido_id=?, mesa_id=?, tipo=?, activo=?, updated_at=NOW()
         WHERE id=? AND municipio_id=? AND eleccion_id=?"
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
        $eleccionId,
    ]);
    jsonResponse(['message' => 'Fiscal actualizado']);
}

function deleteFiscal(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare("DELETE FROM fiscales WHERE id = ? AND municipio_id = ? AND eleccion_id = ?");
    $stmt->execute([$id, $municipioId, $eleccionId]);
    jsonResponse(['message' => 'Fiscal eliminado']);
}
