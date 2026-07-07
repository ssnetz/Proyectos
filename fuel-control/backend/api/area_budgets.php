<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db     = getDB();
$method = getMethod();
$id     = getId();

/* ── GET: consumo por área para un período ─────────────────── */
if ($method === 'GET') {
    $year  = (int)($_GET['year']  ?? date('Y'));
    $month = isset($_GET['month']) && $_GET['month'] !== '' ? (int)$_GET['month'] : null;

    // Rango de fechas para el consumo
    if ($month) {
        $fromDt = sprintf('%04d-%02d-01 00:00:00', $year, $month);
        $toDt   = date('Y-m-t 23:59:59', mktime(0,0,0,$month,1,$year));
    } else {
        $fromDt = "$year-01-01 00:00:00";
        $toDt   = "$year-12-31 23:59:59";
    }

    $sql = "
        SELECT
            a.id, a.name, a.description,
            ab.id           AS budget_id,
            ab.budget_type,
            ab.budget_amount,
            COALESCE(SUM(f.liters),     0) AS consumed_litros,
            COALESCE(SUM(f.total_cost), 0) AS consumed_pesos,
            COUNT(DISTINCT v.id)           AS num_vehiculos,
            COUNT(DISTINCT CASE WHEN v.active = 1 THEN v.id END) AS num_activos
        FROM areas a
        LEFT JOIN area_budgets ab
               ON ab.area_id = a.id
              AND ab.period_year = :year
              AND ((:month IS NULL AND ab.period_month IS NULL)
                   OR ab.period_month = :month2)
        LEFT JOIN vehicles v ON v.area_id = a.id
        LEFT JOIN fueling f
               ON f.vehicle_id = v.id
              AND f.fueled_at BETWEEN :from AND :to
        GROUP BY a.id, a.name, a.description,
                 ab.id, ab.budget_type, ab.budget_amount
        ORDER BY a.name
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute([
        ':year'  => $year,
        ':month' => $month,
        ':month2'=> $month,
        ':from'  => $fromDt,
        ':to'    => $toDt,
    ]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

/* ── POST / PUT: crear o actualizar presupuesto ────────────── */
if ($method === 'POST' || ($method === 'PUT' && $id)) {
    requireAdmin();
    $body         = getBody();
    $area_id      = (int)($body['area_id']      ?? 0);
    $period_year  = (int)($body['period_year']  ?? date('Y'));
    $period_month = isset($body['period_month']) && $body['period_month'] !== '' ? (int)$body['period_month'] : null;
    $budget_type  = $body['budget_type']  ?? 'litros';
    $budget_amount= (float)($body['budget_amount'] ?? 0);

    if (!$area_id || $budget_amount <= 0) jsonError('area_id y budget_amount son requeridos');

    if ($method === 'POST') {
        // Upsert
        $stmt = $db->prepare('
            INSERT INTO area_budgets (area_id, period_year, period_month, budget_type, budget_amount)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE budget_type=VALUES(budget_type), budget_amount=VALUES(budget_amount)
        ');
        $stmt->execute([$area_id, $period_year, $period_month, $budget_type, $budget_amount]);
        jsonResponse(['id' => (int)$db->lastInsertId()], 201);
    } else {
        $stmt = $db->prepare('UPDATE area_budgets SET budget_type=?, budget_amount=? WHERE id=?');
        $stmt->execute([$budget_type, $budget_amount, $id]);
        jsonResponse(['ok' => true]);
    }
}

/* ── DELETE ─────────────────────────────────────────────────── */
if ($method === 'DELETE' && $id) {
    requireAdmin();
    $db->prepare('DELETE FROM area_budgets WHERE id = ?')->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Acción no válida', 400);
