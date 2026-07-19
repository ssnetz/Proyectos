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

$action = $_GET['action'] ?? '';

match($method) {
    'GET'    => ($id ? getMesa($db, $id, $municipioId, $eleccionId) : listMesas($db, $municipioId, $eleccionId)),
    'POST'   => createMesa($db, $municipioId, $eleccionId),
    'PUT'    => ($id
                    ? ($action === 'regenerar_pin'
                        ? regenerarPin($db, $id, $municipioId, $eleccionId)
                        : updateMesa($db, $id, $municipioId, $eleccionId))
                    : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteMesa($db, $id, $municipioId, $eleccionId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

// Genera un PIN numérico de 6 dígitos único entre mesas, para el acceso del
// fiscal desde el celular. Reintenta ante una colisión (muy improbable).
function generarPin(PDO $db): string {
    $check = $db->prepare('SELECT COUNT(*) FROM mesas WHERE pin = ?');
    for ($i = 0; $i < 20; $i++) {
        $pin = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $check->execute([$pin]);
        if ((int)$check->fetchColumn() === 0) return $pin;
    }
    jsonError('No se pudo generar un PIN único, reintentá', 500);
}

// Las mesas ya cargadas antes de esta funcionalidad no tienen PIN todavía:
// se completa solo la primera vez que se la lista/consulta.
function asegurarPin(PDO $db, array $mesa): array {
    if (empty($mesa['pin'])) {
        $mesa['pin'] = generarPin($db);
        $upd = $db->prepare('UPDATE mesas SET pin = ? WHERE id = ?');
        $upd->execute([$mesa['pin'], $mesa['id']]);
    }
    return $mesa;
}

function baseSelect(): string {
    return "SELECT m.*, e.nombre AS establecimiento_nombre,
                   (SELECT COUNT(*) FROM electores WHERE mesa_id = m.id) AS electores_count,
                   (SELECT estado FROM actas WHERE mesa_id = m.id) AS acta_estado
            FROM mesas m
            JOIN establecimientos e ON m.establecimiento_id = e.id";
}

function listMesas(PDO $db, int $municipioId, int $eleccionId): void {
    $where = ['m.municipio_id = ?', 'm.eleccion_id = ?'];
    $params = [$municipioId, $eleccionId];
    if (!empty($_GET['establecimiento_id'])) {
        $where[] = 'm.establecimiento_id = ?';
        $params[] = (int)$_GET['establecimiento_id'];
    }
    if (!empty($_GET['q'])) {
        $where[] = 'm.numero LIKE ?';
        $params[] = '%' . $_GET['q'] . '%';
    }
    $sql = baseSelect() . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY CAST(m.numero AS UNSIGNED), m.numero';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $mesas = array_map(fn($m) => asegurarPin($db, $m), $stmt->fetchAll());
    jsonResponse($mesas);
}

function getMesa(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE m.id = ? AND m.municipio_id = ? AND m.eleccion_id = ?');
    $stmt->execute([$id, $municipioId, $eleccionId]);
    $m = $stmt->fetch();
    if (!$m) jsonError('Mesa no encontrada', 404);
    jsonResponse(asegurarPin($db, $m));
}

function validateEstablecimientoMunicipio(PDO $db, int $establecimientoId, int $municipioId): void {
    $stmt = $db->prepare("SELECT municipio_id FROM establecimientos WHERE id = ?");
    $stmt->execute([$establecimientoId]);
    if ((int)$stmt->fetchColumn() !== $municipioId) jsonError('El establecimiento no pertenece a este municipio', 400);
}

function createMesa(PDO $db, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['establecimiento_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    validateEstablecimientoMunicipio($db, (int)$data['establecimiento_id'], $municipioId);

    try {
        $stmt = $db->prepare(
            "INSERT INTO mesas (municipio_id, eleccion_id, establecimiento_id, numero, electores_habilitados, pin) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $municipioId, $eleccionId, (int)$data['establecimiento_id'], $data['numero'], (int)($data['electores_habilitados'] ?? 0), generarPin($db),
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Mesa creada'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El número de mesa ya existe en ese establecimiento para esta elección', 409);
        jsonError('Error al crear mesa: ' . $e->getMessage(), 500);
    }
}

function updateMesa(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $data = getBody();
    foreach (['establecimiento_id', 'numero'] as $field) {
        if (empty($data[$field])) jsonError("El campo $field es requerido");
    }
    validateEstablecimientoMunicipio($db, (int)$data['establecimiento_id'], $municipioId);

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    try {
        $stmt = $db->prepare(
            "UPDATE mesas SET establecimiento_id=?, numero=?, electores_habilitados=?, activo=?, updated_at=NOW()
             WHERE id=? AND municipio_id=? AND eleccion_id=?"
        );
        $stmt->execute([
            (int)$data['establecimiento_id'], $data['numero'], (int)($data['electores_habilitados'] ?? 0), $activo,
            $id, $municipioId, $eleccionId,
        ]);
        jsonResponse(['message' => 'Mesa actualizada']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('El número de mesa ya existe en ese establecimiento para esta elección', 409);
        jsonError('Error al actualizar mesa: ' . $e->getMessage(), 500);
    }
}

function regenerarPin(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $check = $db->prepare('SELECT id FROM mesas WHERE id = ? AND municipio_id = ? AND eleccion_id = ?');
    $check->execute([$id, $municipioId, $eleccionId]);
    if (!$check->fetch()) jsonError('Mesa no encontrada', 404);

    $pin = generarPin($db);
    $upd = $db->prepare('UPDATE mesas SET pin = ? WHERE id = ?');
    $upd->execute([$pin, $id]);
    jsonResponse(['pin' => $pin, 'message' => 'PIN regenerado']);
}

function deleteMesa(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $check = $db->prepare("SELECT COUNT(*) FROM electores WHERE mesa_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: la mesa tiene electores asignados', 409);
    }
    $stmt = $db->prepare("DELETE FROM mesas WHERE id = ? AND municipio_id = ? AND eleccion_id = ?");
    $stmt->execute([$id, $municipioId, $eleccionId]);
    jsonResponse(['message' => 'Mesa eliminada']);
}
