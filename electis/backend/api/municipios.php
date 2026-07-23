<?php
// Municipios/Comunas que atiende este Electis. Solo un admin los gestiona;
// cualquier usuario autenticado puede listarlos (para el selector).

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getMunicipio($db, $id) : listMunicipios($db))),
    'POST'   => (requireAdmin() && createMunicipio($db)),
    'PUT'    => (requireAdmin() && ($id ? updateMunicipio($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteMunicipio($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listMunicipios(PDO $db): void {
    $stmt = $db->query("SELECT * FROM municipios ORDER BY nombre");
    jsonResponse($stmt->fetchAll());
}

function getMunicipio(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM municipios WHERE id = ?");
    $stmt->execute([$id]);
    $m = $stmt->fetch();
    if (!$m) jsonError('Municipio no encontrado', 404);
    jsonResponse($m);
}

function createMunicipio(PDO $db): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $stmt = $db->prepare("INSERT INTO municipios (nombre, provincia, seccion_electoral, junta_electoral_nombre) VALUES (?, ?, ?, ?)");
    $stmt->execute([
        $data['nombre'], $data['provincia'] ?? null, $data['seccion_electoral'] ?? null,
        ($data['junta_electoral_nombre'] ?? '') ?: 'JUNTA ELECTORAL MUNICIPAL',
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Municipio creado'], 201);
}

// El formulario de Municipios (nombre/provincia/sección/activo) y la pantalla
// de Configuración (junta_electoral_nombre) actualizan municipios desde dos
// pantallas distintas, cada una mandando solo lo suyo: si `junta_electoral_
// nombre` no viene en el body, se conserva el valor ya guardado en vez de
// pisarlo con el default (por ejemplo, al activar/desactivar un municipio
// desde Municipios no se manda ese campo).
function updateMunicipio(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    if (array_key_exists('junta_electoral_nombre', $data)) {
        $juntaElectoralNombre = $data['junta_electoral_nombre'] ?: 'JUNTA ELECTORAL MUNICIPAL';
    } else {
        $actual = $db->prepare("SELECT junta_electoral_nombre FROM municipios WHERE id = ?");
        $actual->execute([$id]);
        $juntaElectoralNombre = $actual->fetchColumn() ?: 'JUNTA ELECTORAL MUNICIPAL';
    }

    $stmt = $db->prepare("UPDATE municipios SET nombre=?, provincia=?, seccion_electoral=?, junta_electoral_nombre=?, activo=?, updated_at=NOW() WHERE id=?");
    $stmt->execute([
        $data['nombre'], $data['provincia'] ?? null, $data['seccion_electoral'] ?? null,
        $juntaElectoralNombre, $activo, $id,
    ]);
    jsonResponse(['message' => 'Municipio actualizado']);
}

function deleteMunicipio(PDO $db, int $id): void {
    foreach (['establecimientos', 'partidos', 'cargos', 'usuarios'] as $table) {
        $check = $db->prepare("SELECT COUNT(*) FROM $table WHERE municipio_id = ?");
        $check->execute([$id]);
        if ($check->fetchColumn() > 0) {
            jsonError('No se puede eliminar: el municipio tiene datos cargados', 409);
        }
    }
    $stmt = $db->prepare("DELETE FROM municipios WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Municipio eliminado']);
}
