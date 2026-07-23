<?php
// Elecciones dentro de un municipio (2023, 2027...). Cargos, listas,
// candidatos, mesas, electores, actas y fiscales son exclusivos de cada
// elección; establecimientos y partidos quedan a nivel municipio (se
// reusan de una elección a otra).

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

match($method) {
    'GET'    => ($id ? getEleccion($db, $id, $municipioId) : listElecciones($db, $municipioId)),
    'POST'   => createEleccion($db, $municipioId),
    'PUT'    => ($id ? updateEleccion($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteEleccion($db, $id, $municipioId) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function listElecciones(PDO $db, int $municipioId): void {
    $stmt = $db->prepare("SELECT * FROM elecciones WHERE municipio_id = ? ORDER BY fecha DESC, nombre DESC");
    $stmt->execute([$municipioId]);
    jsonResponse($stmt->fetchAll());
}

function getEleccion(PDO $db, int $id, int $municipioId): void {
    $stmt = $db->prepare("SELECT * FROM elecciones WHERE id = ? AND municipio_id = ?");
    $stmt->execute([$id, $municipioId]);
    $e = $stmt->fetch();
    if (!$e) jsonError('Elección no encontrada', 404);
    jsonResponse($e);
}

function createEleccion(PDO $db, int $municipioId): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $stmt = $db->prepare("INSERT INTO elecciones (municipio_id, nombre, fecha, junta_electoral_nombre) VALUES (?, ?, ?, ?)");
    $stmt->execute([
        $municipioId, $data['nombre'], $data['fecha'] ?: null,
        ($data['junta_electoral_nombre'] ?? '') ?: 'JUNTA ELECTORAL MUNICIPAL',
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Elección creada'], 201);
}

// El formulario de Elecciones (nombre/fecha/activo) y la pantalla de
// Configuración (junta_electoral_nombre) actualizan la elección desde dos
// pantallas distintas, cada una mandando solo lo suyo: si `junta_electoral_
// nombre` no viene en el body, se conserva el valor ya guardado en vez de
// pisarlo con el default (por ejemplo, al activar/desactivar una elección
// desde Elecciones no se manda ese campo).
function updateEleccion(PDO $db, int $id, int $municipioId): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    if (array_key_exists('junta_electoral_nombre', $data)) {
        $juntaElectoralNombre = $data['junta_electoral_nombre'] ?: 'JUNTA ELECTORAL MUNICIPAL';
    } else {
        $actual = $db->prepare("SELECT junta_electoral_nombre FROM elecciones WHERE id = ? AND municipio_id = ?");
        $actual->execute([$id, $municipioId]);
        $juntaElectoralNombre = $actual->fetchColumn() ?: 'JUNTA ELECTORAL MUNICIPAL';
    }

    $stmt = $db->prepare("UPDATE elecciones SET nombre=?, fecha=?, junta_electoral_nombre=?, activo=?, updated_at=NOW() WHERE id=? AND municipio_id=?");
    $stmt->execute([$data['nombre'], $data['fecha'] ?: null, $juntaElectoralNombre, $activo, $id, $municipioId]);
    jsonResponse(['message' => 'Elección actualizada']);
}

function deleteEleccion(PDO $db, int $id, int $municipioId): void {
    foreach (['cargos', 'listas', 'mesas', 'electores', 'actas', 'fiscales'] as $table) {
        $check = $db->prepare("SELECT COUNT(*) FROM $table WHERE eleccion_id = ?");
        $check->execute([$id]);
        if ($check->fetchColumn() > 0) {
            jsonError('No se puede eliminar: la elección ya tiene datos cargados', 409);
        }
    }
    $stmt = $db->prepare("DELETE FROM elecciones WHERE id = ? AND municipio_id = ?");
    $stmt->execute([$id, $municipioId]);
    jsonResponse(['message' => 'Elección eliminada']);
}
