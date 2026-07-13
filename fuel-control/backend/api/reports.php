<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db     = getDB();
$type   = $_GET['type']       ?? '';
$from   = $_GET['from']       ?? '';
$to     = $_GET['to']         ?? '';
$vid    = isset($_GET['vehicle_id']) ? (int)$_GET['vehicle_id'] : 0;

$fromDt = $from ? $from . ' 00:00:00' : '2000-01-01 00:00:00';
$toDt   = $to   ? $to   . ' 23:59:59' : '2099-12-31 23:59:59';

// Helper: agrega min_date y max_date reales al response
function withMeta(PDO $db, array $rows, string $table, string $dateField, string $fromDt, string $toDt): array {
    $stmt = $db->prepare("SELECT DATE(MIN($dateField)) AS min_date, DATE(MAX($dateField)) AS max_date FROM $table WHERE $dateField BETWEEN ? AND ?");
    $stmt->execute([$fromDt, $toDt]);
    $meta = $stmt->fetch(PDO::FETCH_ASSOC);
    return ['data' => $rows, 'min_date' => $meta['min_date'], 'max_date' => $meta['max_date']];
}

/* ── 1. Cargas por vehículo ─────────────────────────────────── */
if ($type === 'fuel_by_vehicle') {
    $sql = "
        SELECT v.id, v.name, v.plate, v.type,
               COUNT(*)             AS num_cargas,
               SUM(f.liters)        AS total_litros,
               SUM(f.total_cost)    AS total_costo,
               AVG(f.liters)        AS prom_litros,
               AVG(f.price_per_liter) AS prom_precio,
               v.tank_capacity,
               v.km_per_liter
        FROM fueling f
        JOIN vehicles v ON v.id = f.vehicle_id
        WHERE f.fueled_at BETWEEN :from AND :to
        GROUP BY v.id, v.name, v.plate, v.type, v.tank_capacity, v.km_per_liter
        ORDER BY total_litros DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute([':from' => $fromDt, ':to' => $toDt]);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt));
}

/* ── 2. Ranking de kilometraje (GPS) ───────────────────────── */
if ($type === 'km_ranking') {
    $fromG = $from ?: '2000-01-01';
    $toG   = $to   ?: '2099-12-31';
    $sql = "
        SELECT v.id, v.name, v.plate, v.type,
               SUM(g.km_recorridos)  AS total_km,
               COUNT(g.id)           AS dias_con_gps,
               AVG(g.km_recorridos)  AS prom_km_dia,
               MAX(g.km_recorridos)  AS max_km_dia,
               AVG(g.vel_prom)       AS vel_prom,
               MAX(g.vel_max)        AS vel_max
        FROM gps_daily_stats g
        JOIN vehicles v ON v.id = g.vehicle_id
        WHERE g.import_date BETWEEN :from AND :to
        GROUP BY v.id, v.name, v.plate, v.type
        ORDER BY total_km DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute([':from' => $fromG, ':to' => $toG]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $stmt2 = $db->prepare("SELECT MIN(import_date) AS min_date, MAX(import_date) AS max_date FROM gps_daily_stats WHERE import_date BETWEEN ? AND ?");
    $stmt2->execute([$fromG, $toG]);
    $meta = $stmt2->fetch(PDO::FETCH_ASSOC);
    jsonResponse(['data' => $rows, 'min_date' => $meta['min_date'], 'max_date' => $meta['max_date']]);
}

/* ── 3. Eficiencia real (km/L) ─────────────────────────────── */
if ($type === 'efficiency') {
    $sql = "
        SELECT v.id, v.name, v.plate, v.type,
               v.km_per_liter                              AS km_l_teorico,
               SUM(g.km_recorridos)                        AS total_km,
               SUM(f.liters)                               AS total_litros,
               ROUND(SUM(g.km_recorridos)/NULLIF(SUM(f.liters),0),2) AS km_l_real,
               SUM(f.total_cost)                           AS total_costo,
               ROUND(SUM(f.total_cost)/NULLIF(SUM(g.km_recorridos),0),0) AS costo_x_km
        FROM vehicles v
        LEFT JOIN fueling f ON f.vehicle_id = v.id
                            AND f.fueled_at BETWEEN :from AND :to
        LEFT JOIN gps_daily_stats g ON g.vehicle_id = v.id
                            AND g.import_date BETWEEN :from2 AND :to2
        WHERE v.km_per_liter IS NOT NULL
        GROUP BY v.id, v.name, v.plate, v.type, v.km_per_liter
        HAVING total_km > 0 OR total_litros > 0
        ORDER BY km_l_real DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute([':from'=>$fromDt,':to'=>$toDt,':from2'=>($from?:'2000-01-01'),':to2'=>($to?:'2099-12-31')]);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt));
}

/* ── 4. Resumen mensual ─────────────────────────────────────── */
if ($type === 'monthly_summary') {
    $sql = "
        SELECT DATE_FORMAT(f.fueled_at,'%Y-%m') AS mes,
               DATE_FORMAT(f.fueled_at,'%M %Y') AS mes_label,
               COUNT(*)                          AS num_cargas,
               COUNT(DISTINCT f.vehicle_id)      AS vehiculos,
               SUM(f.liters)                     AS total_litros,
               SUM(f.total_cost)                 AS total_costo,
               AVG(f.price_per_liter)            AS prom_precio
        FROM fueling f
        WHERE f.fueled_at BETWEEN :from AND :to
        GROUP BY mes, mes_label
        ORDER BY mes";
    $stmt = $db->prepare($sql);
    $stmt->execute([':from' => $fromDt, ':to' => $toDt]);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt));
}

/* ── 5. Consumo por tipo de combustible ─────────────────────── */
if ($type === 'by_fuel_type') {
    $sql = "
        SELECT f.fuel_type,
               COUNT(*)                     AS num_cargas,
               COUNT(DISTINCT f.vehicle_id) AS vehiculos,
               SUM(f.liters)               AS total_litros,
               SUM(f.total_cost)           AS total_costo,
               AVG(f.price_per_liter)      AS prom_precio
        FROM fueling f
        WHERE f.fueled_at BETWEEN :from AND :to
        GROUP BY f.fuel_type
        ORDER BY total_litros DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute([':from' => $fromDt, ':to' => $toDt]);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt));
}

/* ── 6. Cargas por proveedor/estación ───────────────────────── */
if ($type === 'by_supplier') {
    $sql = "
        SELECT COALESCE(NULLIF(f.station,''), 'Sin especificar') AS proveedor,
               COUNT(*)                     AS num_cargas,
               COUNT(DISTINCT f.vehicle_id) AS vehiculos,
               SUM(f.liters)               AS total_litros,
               SUM(f.total_cost)           AS total_costo,
               AVG(f.price_per_liter)      AS prom_precio
        FROM fueling f
        WHERE f.fueled_at BETWEEN :from AND :to
        GROUP BY proveedor
        ORDER BY total_litros DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute([':from' => $fromDt, ':to' => $toDt]);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt));
}

jsonError('Tipo de reporte no válido', 400);
