<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db = getDB();
$personasTable = '`' . PEOPLE_DB . '`.`personas`';

$totalProfesionales = $db->query("SELECT COUNT(*) FROM profesionales WHERE activo = 1")->fetchColumn();
$totalInstituciones = $db->query("SELECT COUNT(*) FROM instituciones")->fetchColumn();
$turnosHoy = $db->query(
    "SELECT COUNT(*) FROM turnos_prioritarios WHERE fecha = CURDATE() AND estado != 'cancelado'"
)->fetchColumn();
$turnosPendientes = $db->query(
    "SELECT COUNT(*) FROM turnos_prioritarios WHERE estado = 'pendiente'"
)->fetchColumn();

$agendaHoy = $db->query(
    "SELECT t.id, t.hora, t.motivo, t.prioridad, t.estado,
            pr.apellidos AS profesional_apellidos, pr.nombres AS profesional_nombres,
            i.nombre AS institucion_nombre,
            p.nombre AS persona_nombres, p.apellido AS persona_apellidos
     FROM turnos_prioritarios t
     JOIN profesionales pr ON t.profesional_id = pr.id
     JOIN instituciones i ON t.institucion_id = i.id
     LEFT JOIN $personasTable p ON t.persona_id = p.id
     WHERE t.fecha = CURDATE() AND t.estado != 'cancelado'
     ORDER BY t.hora"
)->fetchAll();

$proximosTurnos = $db->query(
    "SELECT DATE(fecha) AS dia, COUNT(*) AS cantidad
     FROM turnos_prioritarios
     WHERE fecha BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 6 DAY) AND estado != 'cancelado'
     GROUP BY DATE(fecha)
     ORDER BY dia"
)->fetchAll();

jsonResponse([
    'stats' => [
        'total_profesionales' => (int)$totalProfesionales,
        'total_instituciones' => (int)$totalInstituciones,
        'turnos_hoy'          => (int)$turnosHoy,
        'turnos_pendientes'   => (int)$turnosPendientes,
    ],
    'agenda_hoy'      => $agendaHoy,
    'proximos_turnos' => $proximosTurnos,
]);
