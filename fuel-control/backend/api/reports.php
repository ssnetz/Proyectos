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
$fuelType = trim($_GET['fuel_type'] ?? '');

$fromDt = $from ? $from . ' 00:00:00' : '2000-01-01 00:00:00';
$toDt   = $to   ? $to   . ' 23:59:59' : '2099-12-31 23:59:59';

// Helper: agrega min_date y max_date reales al response.
// Cuando hay area_id, filtra el rango de fechas contra vehicles.area_id también.
function withMeta(PDO $db, array $rows, string $table, string $dateField, string $fromDt, string $toDt, int $areaId = 0, string $vehicleFk = 'vehicle_id', string $fuelType = ''): array {
    $join  = $areaId ? " JOIN vehicles v ON v.id = $table.$vehicleFk" : "";
    $extra = $areaId ? " AND v.area_id = ?" : "";
    $extraFuel = $fuelType ? " AND $table.fuel_type = ?" : "";
    $sql   = "SELECT DATE(MIN($table.$dateField)) AS min_date, DATE(MAX($table.$dateField)) AS max_date FROM $table$join WHERE $table.$dateField BETWEEN ? AND ?$extra$extraFuel";
    $params = [$fromDt, $toDt];
    if ($areaId) $params[] = $areaId;
    if ($fuelType) $params[] = $fuelType;
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
               v.km_per_liter,
               GROUP_CONCAT(DISTINCT f.fuel_type ORDER BY f.fuel_type SEPARATOR ', ') AS tipos_combustible,
               GROUP_CONCAT(DISTINCT NULLIF(f.ticket_number, '') ORDER BY f.fueled_at SEPARATOR ', ') AS numeros_ticket
        FROM fueling f
        JOIN vehicles v ON v.id = f.vehicle_id
        WHERE f.fueled_at BETWEEN :from AND :to" . ($areaId ? " AND v.area_id = :area_id" : "") . ($fuelType ? " AND f.fuel_type = :fuel_type" : "") . "
        GROUP BY v.id, v.name, v.plate, v.type, v.tank_capacity, v.km_per_liter
        ORDER BY total_litros DESC";
    $stmt = $db->prepare($sql);
    $params = [':from' => $fromDt, ':to' => $toDt];
    if ($areaId) $params[':area_id'] = $areaId;
    if ($fuelType) $params[':fuel_type'] = $fuelType;
    $stmt->execute($params);
    jsonResponse(withMeta($db, $stmt->fetchAll(PDO::FETCH_ASSOC), 'fueling', 'fueled_at', $fromDt, $toDt, $areaId, 'vehicle_id', $fuelType));
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
    $rows = monthlyAggregateRows($db, $fromDt, $toDt, $fromG, $toG, $areaId);

    // Desglose por tipo de combustible dentro de cada mes
    $sqlDetail = "
        SELECT DATE_FORMAT(f.fueled_at,'%Y-%m') AS mes,
               f.fuel_type                       AS fuel_type,
               SUM(f.liters)                     AS total_litros,
               SUM(f.total_cost)                 AS total_costo,
               AVG(f.price_per_liter)            AS prom_precio
        FROM fueling f" . ($areaId ? " JOIN vehicles v ON v.id = f.vehicle_id" : "") . "
        WHERE f.fueled_at BETWEEN :from AND :to" . ($areaId ? " AND v.area_id = :area_id" : "") . "
        GROUP BY mes, f.fuel_type
        ORDER BY mes, f.fuel_type";
    $stmtD = $db->prepare($sqlDetail);
    $paramsD = [':from' => $fromDt, ':to' => $toDt];
    if ($areaId) $paramsD[':area_id'] = $areaId;
    $stmtD->execute($paramsD);
    $detalles = [];
    foreach ($stmtD->fetchAll(PDO::FETCH_ASSOC) as $d) {
        $detalles[$d['mes']][] = [
            'fuel_type'    => $d['fuel_type'],
            'total_litros' => $d['total_litros'],
            'total_costo'  => $d['total_costo'],
            'prom_precio'  => $d['prom_precio'],
        ];
    }
    foreach ($rows as &$row) {
        $row['desglose_combustible'] = $detalles[$row['mes']] ?? [];
    }
    unset($row);

    jsonResponse(withMeta($db, $rows, 'fueling', 'fueled_at', $fromDt, $toDt, $areaId));
}

/* ── 4b. Comparativa mensual ─────────────────────────────────── */
if ($type === 'monthly_comparison') {
    $fromG = $from ?: '2000-01-01';
    $toG   = $to   ?: '2099-12-31';
    $rows = monthlyAggregateRows($db, $fromDt, $toDt, $fromG, $toG, $areaId);

    // Calcula variación (delta y %) de cada mes respecto al mes anterior
    $prev = null;
    foreach ($rows as &$row) {
        foreach (['total_litros', 'total_costo', 'prom_precio', 'total_km'] as $field) {
            $cur  = $row[$field] !== null ? (float)$row[$field] : null;
            $ant  = ($prev && $prev[$field] !== null) ? (float)$prev[$field] : null;
            if ($prev !== null && $cur !== null && $ant !== null) {
                $row[$field . '_delta'] = $cur - $ant;
                $row[$field . '_pct']   = $ant != 0 ? (($cur - $ant) / $ant) * 100 : null;
            } else {
                $row[$field . '_delta'] = null;
                $row[$field . '_pct']   = null;
            }
        }
        $prev = $row;
    }
    unset($row);

    // Desglose por vehículo: qué vehículos explican la diferencia de cada mes
    $sqlVeh = "
        SELECT DATE_FORMAT(f.fueled_at,'%Y-%m') AS mes,
               v.id AS vehicle_id, v.name, v.plate,
               SUM(f.liters)     AS total_litros,
               SUM(f.total_cost) AS total_costo
        FROM fueling f
        JOIN vehicles v ON v.id = f.vehicle_id
        WHERE f.fueled_at BETWEEN :from AND :to" . ($areaId ? " AND v.area_id = :area_id" : "") . "
        GROUP BY mes, v.id, v.name, v.plate
        ORDER BY mes, v.name";
    $stmtV = $db->prepare($sqlVeh);
    $paramsV = [':from' => $fromDt, ':to' => $toDt];
    if ($areaId) $paramsV[':area_id'] = $areaId;
    $stmtV->execute($paramsV);
    $porMesVehiculo = [];
    foreach ($stmtV->fetchAll(PDO::FETCH_ASSOC) as $v) {
        $porMesVehiculo[$v['mes']][$v['vehicle_id']] = [
            'name'         => $v['name'],
            'plate'        => $v['plate'],
            'total_litros' => (float)$v['total_litros'],
            'total_costo'  => (float)$v['total_costo'],
            'total_km'     => 0.0,
        ];
    }

    // Km por vehículo y mes (según GPS), para completar el desglose
    $sqlVehKm = "
        SELECT DATE_FORMAT(g.import_date,'%Y-%m') AS mes,
               v.id AS vehicle_id, v.name, v.plate,
               SUM(g.km_recorridos) AS total_km
        FROM gps_daily_stats g
        JOIN vehicles v ON v.id = g.vehicle_id
        WHERE g.import_date BETWEEN :from3 AND :to3" . ($areaId ? " AND v.area_id = :area_id2" : "") . "
        GROUP BY mes, v.id, v.name, v.plate
        ORDER BY mes, v.name";
    $stmtVK = $db->prepare($sqlVehKm);
    $paramsVK = [':from3' => $fromG, ':to3' => $toG];
    if ($areaId) $paramsVK[':area_id2'] = $areaId;
    $stmtVK->execute($paramsVK);
    foreach ($stmtVK->fetchAll(PDO::FETCH_ASSOC) as $v) {
        if (!isset($porMesVehiculo[$v['mes']][$v['vehicle_id']])) {
            $porMesVehiculo[$v['mes']][$v['vehicle_id']] = [
                'name'         => $v['name'],
                'plate'        => $v['plate'],
                'total_litros' => 0.0,
                'total_costo'  => 0.0,
                'total_km'     => 0.0,
            ];
        }
        $porMesVehiculo[$v['mes']][$v['vehicle_id']]['total_km'] = (float)$v['total_km'];
    }

    $prevVeh = null;
    foreach ($rows as &$row) {
        $curVeh = $porMesVehiculo[$row['mes']] ?? [];
        $detalleVeh = [];
        if ($prevVeh !== null) {
            $ids = array_unique(array_merge(array_keys($curVeh), array_keys($prevVeh)));
            foreach ($ids as $vhId) {
                $curL  = $curVeh[$vhId]['total_litros']  ?? 0.0;
                $curC  = $curVeh[$vhId]['total_costo']   ?? 0.0;
                $curK  = $curVeh[$vhId]['total_km']      ?? 0.0;
                $antL  = $prevVeh[$vhId]['total_litros'] ?? 0.0;
                $antC  = $prevVeh[$vhId]['total_costo']  ?? 0.0;
                $antK  = $prevVeh[$vhId]['total_km']     ?? 0.0;
                $dLitros = $curL - $antL;
                $dCosto  = $curC - $antC;
                $dKm     = $curK - $antK;
                if (abs($dLitros) < 0.01 && abs($dCosto) < 0.01 && abs($dKm) < 0.01) continue;
                $info = $curVeh[$vhId] ?? $prevVeh[$vhId];
                $detalleVeh[] = [
                    'vehicle_id'    => $vhId,
                    'name'          => $info['name'],
                    'plate'         => $info['plate'],
                    'total_litros'  => $curL,
                    'total_costo'   => $curC,
                    'total_km'      => $curK,
                    'litros_delta'  => $dLitros,
                    'costo_delta'   => $dCosto,
                    'km_delta'      => $dKm,
                ];
            }
            usort($detalleVeh, fn($a, $b) => abs($b['costo_delta']) <=> abs($a['costo_delta']));
        }
        $row['detalle_vehiculos'] = $detalleVeh;
        $prevVeh = $curVeh;
    }
    unset($row);

    jsonResponse(withMeta($db, $rows, 'fueling', 'fueled_at', $fromDt, $toDt, $areaId));
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

/* ── 7. Km entre cargas (real) ───────────────────────────────── */
// Solo tramos CERRADOS (una carga y la siguiente ya registrada): km GPS
// estrictamente entre esas dos fechas (sin contar ninguno de los dos días)
// dividido los litros cargados al abrir el tramo, para tener un km/L real
// verificable. No incluye el tramo abierto actual (desde la última carga
// hasta hoy) porque todavía no hay una carga que lo confirme.
if ($type === 'km_desde_carga') {
    $sqlV = "
        SELECT id, name, plate, type, km_per_liter
        FROM vehicles
        WHERE active = 1" . ($areaId ? " AND area_id = :area_id" : "") . "
        ORDER BY name";
    $stmtV = $db->prepare($sqlV);
    $paramsV = [];
    if ($areaId) $paramsV[':area_id'] = $areaId;
    $stmtV->execute($paramsV);
    $vehicles = $stmtV->fetchAll(PDO::FETCH_ASSOC);

    if (empty($vehicles)) jsonResponse(['data' => [], 'min_date' => null, 'max_date' => null]);

    $ids = array_column($vehicles, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    $stmtF = $db->prepare("
        SELECT id, vehicle_id, fueled_at, liters
        FROM fueling
        WHERE vehicle_id IN ($placeholders)
        ORDER BY vehicle_id, fueled_at, id
    ");
    $stmtF->execute($ids);
    $fuelingsByVehicle = [];
    foreach ($stmtF->fetchAll(PDO::FETCH_ASSOC) as $f) {
        $fuelingsByVehicle[$f['vehicle_id']][] = $f;
    }

    $stmtG = $db->prepare("
        SELECT vehicle_id, import_date, km_recorridos
        FROM gps_daily_stats
        WHERE vehicle_id IN ($placeholders)
        ORDER BY import_date
    ");
    $stmtG->execute($ids);
    $gpsByVehicle = [];
    foreach ($stmtG->fetchAll(PDO::FETCH_ASSOC) as $g) {
        $gpsByVehicle[$g['vehicle_id']][] = $g;
    }

    $rows = [];
    foreach ($vehicles as $v) {
        $fuelings = $fuelingsByVehicle[$v['id']] ?? [];
        $gps      = $gpsByVehicle[$v['id']] ?? [];
        $tramos   = [];

        for ($i = 1; $i < count($fuelings); $i++) {
            $prev     = $fuelings[$i - 1];
            $next     = $fuelings[$i];
            $fromDate = substr($prev['fueled_at'], 0, 10);
            $toDate   = substr($next['fueled_at'], 0, 10);

            // Filtro opcional de fechas: contra el día en que se cerró el tramo
            if ($from && $toDate < $from) continue;
            if ($to   && $toDate > $to)   continue;

            $kmTramo = 0.0;
            $diasGps = 0;
            foreach ($gps as $g) {
                if ($g['import_date'] > $fromDate && $g['import_date'] < $toDate) {
                    $kmTramo += (float)$g['km_recorridos'];
                    $diasGps++;
                }
            }
            $litros  = (float)$prev['liters'];
            $kmLReal = $litros > 0 ? round($kmTramo / $litros, 2) : null;

            $tramos[] = [
                'desde'    => $fromDate,
                'hasta'    => $toDate,
                'litros'   => $litros,
                'km'       => round($kmTramo, 1),
                'dias_gps' => $diasGps,
                'km_l'     => $kmLReal,
            ];
        }

        if (empty($tramos)) continue; // sin tramos cerrados todavía: no hay nada verificable que mostrar

        $totalKm     = array_sum(array_column($tramos, 'km'));
        $totalLitros = array_sum(array_column($tramos, 'litros'));
        $kmPerLiter  = $v['km_per_liter'] !== null ? (float)$v['km_per_liter'] : null;
        $kmLReal     = $totalLitros > 0 ? round($totalKm / $totalLitros, 2) : null;
        $diff        = ($kmLReal !== null && $kmPerLiter) ? round($kmLReal - $kmPerLiter, 2) : null;

        $rows[] = [
            'id'            => $v['id'],
            'name'          => $v['name'],
            'plate'         => $v['plate'],
            'type'          => $v['type'],
            'km_per_liter'  => $kmPerLiter,
            'num_tramos'    => count($tramos),
            'total_km'      => round($totalKm, 1),
            'total_litros'  => round($totalLitros, 2),
            'km_l_real'     => $kmLReal,
            'diff'          => $diff,
            'tramos'        => $tramos,
        ];
    }

    // Peor diferencia primero (más por debajo del rendimiento teórico); los
    // que no tienen rendimiento teórico cargado (diff null) van al final.
    usort($rows, function ($a, $b) {
        if ($a['diff'] === null && $b['diff'] === null) return 0;
        if ($a['diff'] === null) return 1;
        if ($b['diff'] === null) return -1;
        return $a['diff'] <=> $b['diff'];
    });

    jsonResponse(['data' => $rows, 'min_date' => null, 'max_date' => null]);
}

jsonError('Tipo de reporte no válido', 400);
