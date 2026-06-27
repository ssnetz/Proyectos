<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
handleOptions();
$pdo = getDB();
requireAuth();

$vehicle_id = $_GET['vehicle_id'] ?? '';
$from       = $_GET['from']       ?? '';
$to         = $_GET['to']         ?? '';

// Build date filter
$dateFilter = '';
$params = [];
if ($from) { $dateFilter .= ' AND r.departure_at >= :from'; $params[':from'] = $from . ' 00:00:00'; }
if ($to)   { $dateFilter .= ' AND r.departure_at <= :to';   $params[':to']   = $to   . ' 23:59:59'; }
if ($vehicle_id) { $dateFilter .= ' AND r.vehicle_id = :vid'; $params[':vid'] = (int)$vehicle_id; }

try {
    // ---------- Routes summary ----------
    $sql = "SELECT
        r.vehicle_id,
        v.name AS vehicle_name,
        v.plate,
        COUNT(r.id)                                         AS total_routes,
        SUM(r.km_end - r.km_start)                         AS total_km,
        SUM(r.trips_to_dump * 8)                           AS total_toneladas,
        SUM(TIMESTAMPDIFF(MINUTE, r.departure_at, r.arrival_at)) AS total_minutes,
        SUM(r.fuel_liters)                                  AS total_fuel_liters,

        /* Cost per route: personal = horas × costo_hora del chofer */
        SUM(
          (TIMESTAMPDIFF(MINUTE, r.departure_at, r.arrival_at) / 60.0)
          * d.hourly_cost
        ) AS costo_personal,

        /* Cost per route: combustible = liters × precio vigente (from fueling avg or fixed) */
        SUM(r.fuel_liters * COALESCE(
          (SELECT AVG(f.price_per_liter) FROM fueling f WHERE f.vehicle_id = r.vehicle_id AND f.price_per_liter IS NOT NULL ORDER BY f.fueled_at DESC LIMIT 1),
          0
        )) AS costo_combustible,

        /* maintenance_per_km */
        SUM((r.km_end - r.km_start) * COALESCE(cc.maintenance_per_km, 0)) AS costo_mantenimiento,

        /* Fixed monthly costs prorated per km */
        SUM((r.km_end - r.km_start) * COALESCE(
          (cc.insurance_monthly + cc.depreciation_monthly) / NULLIF(
            (SELECT SUM(r2.km_end - r2.km_start)
             FROM routes r2
             WHERE r2.vehicle_id = r.vehicle_id
               AND YEAR(r2.departure_at) = YEAR(r.departure_at)
               AND MONTH(r2.departure_at) = MONTH(r.departure_at)),
          0), 0)
        ) AS costo_fijos

      FROM routes r
      JOIN vehicles v ON v.id = r.vehicle_id
      JOIN drivers  d ON d.id = r.driver_id
      LEFT JOIN (
        SELECT vehicle_id, maintenance_per_km, insurance_monthly, depreciation_monthly
        FROM cost_config cc1
        WHERE cc1.id = (SELECT MAX(id) FROM cost_config cc2 WHERE cc2.vehicle_id = cc1.vehicle_id)
      ) cc ON cc.vehicle_id = r.vehicle_id
      WHERE 1=1 $dateFilter
      GROUP BY r.vehicle_id, v.name, v.plate
      ORDER BY v.name";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Cast numeric fields
    $result = array_map(function($row) {
        $costo_combustible  = (float)$row['costo_combustible'];
        $costo_personal     = (float)$row['costo_personal'];
        $costo_mantenimiento= (float)$row['costo_mantenimiento'];
        $costo_fijos        = (float)$row['costo_fijos'];
        $costo_total        = $costo_combustible + $costo_personal + $costo_mantenimiento + $costo_fijos;
        $total_toneladas    = (float)$row['total_toneladas'];
        return [
            'vehicle_id'          => (int)$row['vehicle_id'],
            'vehicle_name'        => $row['vehicle_name'],
            'plate'               => $row['plate'],
            'total_routes'        => (int)$row['total_routes'],
            'total_km'            => (float)$row['total_km'],
            'total_toneladas'     => $total_toneladas,
            'total_horas'         => round((float)$row['total_minutes'] / 60, 2),
            'total_fuel_liters'   => (float)$row['total_fuel_liters'],
            'costo_combustible'   => round($costo_combustible, 2),
            'costo_personal'      => round($costo_personal, 2),
            'costo_mantenimiento' => round($costo_mantenimiento, 2),
            'costo_fijos'         => round($costo_fijos, 2),
            'costo_total'         => round($costo_total, 2),
            'costo_por_tonelada'  => $total_toneladas > 0 ? round($costo_total / $total_toneladas, 2) : null,
            'costo_por_km'        => (float)$row['total_km'] > 0 ? round($costo_total / (float)$row['total_km'], 2) : null,
        ];
    }, $rows);

    echo json_encode($result);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
