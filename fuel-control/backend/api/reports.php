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
$areaId = isset($_GET['area_id']) ? (int)$_GET['area_id'] : 0;

$fromDt = $from ? $from . ' 00:00:00' : '2000-01-01 00:00:00';
$toDt   = $to   ? $to   . ' 23:59:59' : '2099-12-31 23:59:59';

// Helper: agrega min_date y max_date reales al response.
// Cuando hay area_id, filtra el rango de fechas contra vehicles.area_id también.
function withMeta(PDO $db, array $rows, string $table, string $dateField, string $fromDt, string $toDt, int $areaId = 0, string $vehicleFk = 'vehicle_id'): array {
    $join  = $areaId ? " JOIN vehicles v ON v.id = $table.$vehicleFk" : "";
    $extra = $areaId ? " AND v.area_id = ?" : "";
    $sql   = "SELECT DATE(MIN($table.$dateField)) AS min_date, DATE(MAX($table.$dateField)) AS max_date FROM $table$join WHERE $table.$dateField BETWEEN ? AND ?$extra";
    $params = [$fromDt, $toDt];
    if ($areaId) $params[] = $areaId;
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
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
        WHERE f.fueled_at BETWEEN :from AND :to" . ($areaId ? " AND v.area_id = :area_id" : "") . "
        GROUP BY v.id, v.name, v.plate, v.type, v.tank_capacity, v.km_per_liter
        ORDER BY total_litros DESC";
    $stmt = $db->prepare($sql);
    $params = [':from' => $fromDt, ':to' => $toDt];
    if ($areaId) $params[':area_id'] = $areaId;
    $stmt->execute($params);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt, $areaId));
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
        WHERE g.import_date BETWEEN :from AND :to" . ($areaId ? " AND v.area_id = :area_id" : "") . "
        GROUP BY v.id, v.name, v.plate, v.type
        ORDER BY total_km DESC";
    $stmt = $db->prepare($sql);
    $params = [':from' => $fromG, ':to' => $toG];
    if ($areaId) $params[':area_id'] = $areaId;
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $joinA  = $areaId ? " JOIN vehicles v ON v.id = gps_daily_stats.vehicle_id" : "";
    $extraA = $areaId ? " AND v.area_id = ?" : "";
    $stmt2 = $db->prepare("SELECT MIN(import_date) AS min_date, MAX(import_date) AS max_date FROM gps_daily_stats$joinA WHERE import_date BETWEEN ? AND ?$extraA");
    $params2 = [$fromG, $toG];
    if ($areaId) $params2[] = $areaId;
    $stmt2->execute($params2);
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
        WHERE v.km_per_liter IS NOT NULL" . ($areaId ? " AND v.area_id = :area_id" : "") . "
        GROUP BY v.id, v.name, v.plate, v.type, v.km_per_liter
        HAVING total_km > 0 OR total_litros > 0
        ORDER BY km_l_real DESC";
    $stmt = $db->prepare($sql);
    $params = [':from'=>$fromDt,':to'=>$toDt,':from2'=>($from?:'2000-01-01'),':to2'=>($to?:'2099-12-31')];
    if ($areaId) $params[':area_id'] = $areaId;
    $stmt->execute($params);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt, $areaId));
}

/* ── 4. Resumen mensual ─────────────────────────────────────── */
if ($type === 'monthly_summary') {
    $fromG = $from ?: '2000-01-01';
    $toG   = $to   ?: '2099-12-31';
    $sql = "
        SELECT DATE_FORMAT(f.fueled_at,'%Y-%m') AS mes,
               DATE_FORMAT(f.fueled_at,'%M %Y') AS mes_label,
               COUNT(*)                          AS num_cargas,
               COUNT(DISTINCT f.vehicle_id)      AS vehiculos,
               SUM(f.liters)                     AS total_litros,
               SUM(f.total_cost)                 AS total_costo,
               AVG(f.price_per_liter)            AS prom_precio,
               MAX(km.total_km)                  AS total_km
        FROM fueling f" . ($areaId ? " JOIN vehicles v ON v.id = f.vehicle_id" : "") . "
        LEFT JOIN (
            SELECT DATE_FORMAT(g.import_date,'%Y-%m') AS mes_key, SUM(g.km_recorridos) AS total_km
            FROM gps_daily_stats g" . ($areaId ? " JOIN vehicles v2 ON v2.id = g.vehicle_id AND v2.area_id = :area_id2" : "") . "
            WHERE g.import_date BETWEEN :from3 AND :to3
            GROUP BY mes_key
        ) km ON km.mes_key = DATE_FORMAT(f.fueled_at,'%Y-%m')
        WHERE f.fueled_at BETWEEN :from AND :to" . ($areaId ? " AND v.area_id = :area_id" : "") . "
        GROUP BY mes, mes_label
        ORDER BY mes";
    $stmt = $db->prepare($sql);
    $params = [':from' => $fromDt, ':to' => $toDt, ':from3' => $fromG, ':to3' => $toG];
    if ($areaId) { $params[':area_id'] = $areaId; $params[':area_id2'] = $areaId; }
    $stmt->execute($params);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt, $areaId));
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
        FROM fueling f" . ($areaId ? " JOIN vehicles v ON v.id = f.vehicle_id" : "") . "
        WHERE f.fueled_at BETWEEN :from AND :to" . ($areaId ? " AND v.area_id = :area_id" : "") . "
        GROUP BY f.fuel_type
        ORDER BY total_litros DESC";
    $stmt = $db->prepare($sql);
    $params = [':from' => $fromDt, ':to' => $toDt];
    if ($areaId) $params[':area_id'] = $areaId;
    $stmt->execute($params);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt, $areaId));
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
        FROM fueling f" . ($areaId ? " JOIN vehicles v ON v.id = f.vehicle_id" : "") . "
        WHERE f.fueled_at BETWEEN :from AND :to" . ($areaId ? " AND v.area_id = :area_id" : "") . "
        GROUP BY proveedor
        ORDER BY total_litros DESC";
    $stmt = $db->prepare($sql);
    $params = [':from' => $fromDt, ':to' => $toDt];
    if ($areaId) $params[':area_id'] = $areaId;
    $stmt->execute($params);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt, $areaId));
}

jsonError('Tipo de reporte no válido', 400);
