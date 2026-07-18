<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$municipioId = requireMunicipioScope()['municipio_id'];

$stmt = $db->prepare("SELECT COUNT(*) FROM mesas WHERE activo = 1 AND municipio_id = ?");
$stmt->execute([$municipioId]);
$totalMesas = $stmt->fetchColumn();

$stmt = $db->prepare("SELECT COUNT(*) FROM establecimientos WHERE activo = 1 AND municipio_id = ?");
$stmt->execute([$municipioId]);
$totalEstablecimientos = $stmt->fetchColumn();

$stmt = $db->prepare("SELECT COUNT(*) FROM electores WHERE municipio_id = ?");
$stmt->execute([$municipioId]);
$totalElectores = $stmt->fetchColumn();

$stmt = $db->prepare("SELECT COUNT(*) FROM fiscales WHERE activo = 1 AND municipio_id = ?");
$stmt->execute([$municipioId]);
$totalFiscales = $stmt->fetchColumn();

$stmt = $db->prepare("SELECT COUNT(*) FROM listas WHERE activo = 1 AND municipio_id = ?");
$stmt->execute([$municipioId]);
$totalListas = $stmt->fetchColumn();

$stmt = $db->prepare("SELECT COUNT(*) FROM actas WHERE estado IN ('cargada','validada') AND municipio_id = ?");
$stmt->execute([$municipioId]);
$actasCargadas = $stmt->fetchColumn();

$stmt = $db->prepare(
    "SELECT c.id, c.nombre, l.id AS lista_id, l.numero, l.nombre AS lista_nombre,
            p.nombre AS partido_nombre, p.color AS partido_color,
            COALESCE(SUM(av.votos), 0) AS votos
     FROM cargos c
     JOIN listas l ON l.cargo_id = c.id AND l.activo = 1
     JOIN partidos p ON l.partido_id = p.id
     LEFT JOIN acta_votos av ON av.lista_id = l.id
     WHERE c.municipio_id = ?
     GROUP BY c.id, c.nombre, l.id, l.numero, l.nombre, p.nombre, p.color
     ORDER BY c.orden, votos DESC"
);
$stmt->execute([$municipioId]);
$escrutinioPorCargo = $stmt->fetchAll();

$stmt = $db->prepare(
    "SELECT m.id, m.numero, e.nombre AS establecimiento_nombre
     FROM mesas m
     JOIN establecimientos e ON m.establecimiento_id = e.id
     LEFT JOIN actas a ON a.mesa_id = m.id
     WHERE m.activo = 1 AND m.municipio_id = ? AND (a.id IS NULL OR a.estado = 'pendiente')
     ORDER BY m.numero
     LIMIT 20"
);
$stmt->execute([$municipioId]);
$mesasSinActa = $stmt->fetchAll();

jsonResponse([
    'stats' => [
        'total_mesas'            => (int)$totalMesas,
        'total_establecimientos' => (int)$totalEstablecimientos,
        'total_electores'        => (int)$totalElectores,
        'total_fiscales'         => (int)$totalFiscales,
        'total_listas'           => (int)$totalListas,
        'actas_cargadas'         => (int)$actasCargadas,
        'actas_pendientes'       => (int)$totalMesas - (int)$actasCargadas,
    ],
    'escrutinio_por_cargo' => $escrutinioPorCargo,
    'mesas_sin_acta'       => $mesasSinActa,
]);
