<?php
// Datos para imprimir el padrón de una mesa en hoja oficio (con la
// constancia de emisión de voto troquelada). Devuelve, en una sola
// respuesta, los datos de encabezado (mesa, establecimiento, municipio,
// elección) y el listado completo de electores de esa mesa en el orden
// oficial (no paginado: una mesa entra siempre en un solo llamado).

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();

if ($method !== 'GET') jsonError('Método no permitido', 405);

$municipioId = requireMunicipioScope()['municipio_id'];
$eleccionId = requireEleccionScope();

$mesaId = !empty($_GET['mesa_id']) ? (int)$_GET['mesa_id'] : 0;
if (!$mesaId) jsonError('Debe indicar mesa_id', 400);

$mesaStmt = $db->prepare(
    "SELECT m.id, m.numero, es.nombre AS establecimiento_nombre, es.circuito
     FROM mesas m
     JOIN establecimientos es ON m.establecimiento_id = es.id
     WHERE m.id = ? AND m.municipio_id = ? AND m.eleccion_id = ?"
);
$mesaStmt->execute([$mesaId, $municipioId, $eleccionId]);
$mesa = $mesaStmt->fetch();
if (!$mesa) jsonError('Mesa no encontrada', 404);

$municipioStmt = $db->prepare("SELECT nombre, provincia, seccion_electoral, junta_electoral_nombre FROM municipios WHERE id = ?");
$municipioStmt->execute([$municipioId]);
$municipio = $municipioStmt->fetch();

$eleccionStmt = $db->prepare("SELECT nombre, fecha FROM elecciones WHERE id = ?");
$eleccionStmt->execute([$eleccionId]);
$eleccion = $eleccionStmt->fetch();

$electoresStmt = $db->prepare(
    "SELECT orden, documento, tipo, apellido, nombre, domicilio, fecha_nacimiento, habilitado, observaciones
     FROM electores
     WHERE mesa_id = ? AND municipio_id = ? AND eleccion_id = ?
     ORDER BY (orden IS NULL), orden, apellido, nombre"
);
$electoresStmt->execute([$mesaId, $municipioId, $eleccionId]);

jsonResponse([
    'mesa' => $mesa,
    'municipio' => $municipio,
    'eleccion' => $eleccion,
    'electores' => $electoresStmt->fetchAll(),
]);
