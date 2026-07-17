<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db = getDB();

$totalLiters = $db->query('SELECT COALESCE(SUM(liters), 0) FROM fueling')->fetchColumn();
$totalCost   = $db->query('SELECT COALESCE(SUM(total_cost), 0) FROM fueling')->fetchColumn();
$totalLoads  = $db->query('SELECT COUNT(*) FROM fueling')->fetchColumn();
$activeVehicles = $db->query('SELECT COUNT(*) FROM vehicles WHERE active = 1')->fetchColumn();

$last30 = $db->query("
    SELECT DATE(fueled_at) AS day, SUM(liters) AS liters, SUM(total_cost) AS cost
    FROM fueling
    WHERE fueled_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(fueled_at)
    ORDER BY day
")->fetchAll();

$byVehicle = $db->query("
    SELECT v.name, v.plate, SUM(f.liters) AS liters, SUM(f.total_cost) AS cost, COUNT(*) AS loads
    FROM fueling f
    JOIN vehicles v ON v.id = f.vehicle_id
    GROUP BY f.vehicle_id
    ORDER BY liters DESC
    LIMIT 10
")->fetchAll();

$byFuelType = $db->query("
    SELECT fuel_type, SUM(liters) AS liters, COUNT(*) AS loads
    FROM fueling
    GROUP BY fuel_type
")->fetchAll();

// ── Alerta comparativa automática: mes actual vs. mes anterior ────────────
function buildMonthlyAlert(PDO $db): ?array {
    $rows = monthlyAggregateRows($db, '2000-01-01 00:00:00', '2099-12-31 23:59:59', '2000-01-01', '2099-12-31', 0);
    if (count($rows) < 2) return null;

    $cur  = $rows[count($rows) - 1];
    $prev = $rows[count($rows) - 2];

    $litrosDelta = (float)$cur['total_litros'] - (float)$prev['total_litros'];
    $litrosPct   = (float)$prev['total_litros'] != 0 ? ($litrosDelta / (float)$prev['total_litros']) * 100 : null;
    $costoDelta  = (float)$cur['total_costo'] - (float)$prev['total_costo'];
    $costoPct    = (float)$prev['total_costo'] != 0 ? ($costoDelta / (float)$prev['total_costo']) * 100 : null;
    $kmCur   = $cur['total_km']  !== null ? (float)$cur['total_km']  : null;
    $kmPrev  = $prev['total_km'] !== null ? (float)$prev['total_km'] : null;
    $kmDelta = ($kmCur !== null && $kmPrev !== null) ? $kmCur - $kmPrev : null;
    $kmPct   = ($kmDelta !== null && $kmPrev != 0) ? ($kmDelta / $kmPrev) * 100 : null;
    $precioCur   = $cur['prom_precio']  !== null ? (float)$cur['prom_precio']  : null;
    $precioPrev  = $prev['prom_precio'] !== null ? (float)$prev['prom_precio'] : null;
    $precioDelta = ($precioCur !== null && $precioPrev !== null) ? $precioCur - $precioPrev : null;
    $precioPct   = ($precioDelta !== null && $precioPrev != 0) ? ($precioDelta / $precioPrev) * 100 : null;

    // Litros/costo por vehículo, solo para estos dos meses
    $stmt = $db->prepare("
        SELECT DATE_FORMAT(f.fueled_at,'%Y-%m') AS mes,
               v.id AS vehicle_id, v.name, v.plate,
               SUM(f.liters) AS total_litros, SUM(f.total_cost) AS total_costo
        FROM fueling f
        JOIN vehicles v ON v.id = f.vehicle_id
        WHERE DATE_FORMAT(f.fueled_at,'%Y-%m') IN (?, ?)
        GROUP BY mes, v.id, v.name, v.plate");
    $stmt->execute([$cur['mes'], $prev['mes']]);
    $porVeh = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $v) {
        $porVeh[$v['mes']][$v['vehicle_id']] = ['name' => $v['name'], 'plate' => $v['plate'], 'litros' => (float)$v['total_litros'], 'costo' => (float)$v['total_costo']];
    }

    // Km por vehículo, solo para estos dos meses
    $stmtKm = $db->prepare("
        SELECT DATE_FORMAT(g.import_date,'%Y-%m') AS mes,
               v.id AS vehicle_id, SUM(g.km_recorridos) AS total_km
        FROM gps_daily_stats g
        JOIN vehicles v ON v.id = g.vehicle_id
        WHERE DATE_FORMAT(g.import_date,'%Y-%m') IN (?, ?)
        GROUP BY mes, v.id");
    $stmtKm->execute([$cur['mes'], $prev['mes']]);
    $kmPorVeh = [];
    foreach ($stmtKm->fetchAll(PDO::FETCH_ASSOC) as $v) {
        $kmPorVeh[$v['mes']][$v['vehicle_id']] = (float)$v['total_km'];
    }

    $curVeh  = $porVeh[$cur['mes']]  ?? [];
    $prevVeh = $porVeh[$prev['mes']] ?? [];
    $ids = array_unique(array_merge(array_keys($curVeh), array_keys($prevVeh)));
    $topVehiculos = [];
    foreach ($ids as $vhId) {
        $curL = $curVeh[$vhId]['litros']  ?? 0.0;
        $curC = $curVeh[$vhId]['costo']   ?? 0.0;
        $antL = $prevVeh[$vhId]['litros'] ?? 0.0;
        $antC = $prevVeh[$vhId]['costo']  ?? 0.0;
        $curK = $kmPorVeh[$cur['mes']][$vhId]  ?? 0.0;
        $antK = $kmPorVeh[$prev['mes']][$vhId] ?? 0.0;
        $dLitros = $curL - $antL;
        $dCosto  = $curC - $antC;
        $dKm     = $curK - $antK;
        if (abs($dLitros) < 0.01 && abs($dCosto) < 0.01 && abs($dKm) < 0.01) continue;
        $info = $curVeh[$vhId] ?? $prevVeh[$vhId];
        $topVehiculos[] = [
            'vehicle_id'   => $vhId,
            'name'         => $info['name'],
            'plate'        => $info['plate'],
            'litros_delta' => $dLitros,
            'costo_delta'  => $dCosto,
            'km_delta'     => $dKm,
        ];
    }
    usort($topVehiculos, fn($a, $b) => abs($b['costo_delta']) <=> abs($a['costo_delta']));
    $topVehiculos = array_slice($topVehiculos, 0, 5);

    // Narrativa en español
    $MESES = ['January'=>'enero','February'=>'febrero','March'=>'marzo','April'=>'abril','May'=>'mayo','June'=>'junio',
              'July'=>'julio','August'=>'agosto','September'=>'septiembre','October'=>'octubre','November'=>'noviembre','December'=>'diciembre'];
    [$mCur, $yCur]   = explode(' ', $cur['mes_label']);
    [$mPrev, $yPrev] = explode(' ', $prev['mes_label']);
    $mesCurEs  = ($MESES[$mCur]  ?? $mCur)  . ' ' . $yCur;
    $mesPrevEs = ($MESES[$mPrev] ?? $mPrev) . ' ' . $yPrev;

    $umbral    = 3.0; // % mínimo de variación en costo para considerarlo significativo
    $direccion = $costoPct === null ? 'neutral' : ($costoPct > $umbral ? 'up' : ($costoPct < -$umbral ? 'down' : 'flat'));

    $peso = fn(float $n) => '$' . number_format($n, 0, ',', '.');
    $num  = fn(float $n, int $d = 0) => number_format($n, $d, ',', '.');

    if ($direccion === 'up' || $direccion === 'down') {
        $verbo = $direccion === 'up' ? 'aumentó' : 'disminuyó';
        $signo = $direccion === 'up' ? '+' : '';
        $narrativa = "El costo de combustible de $mesCurEs $verbo un " . $num(abs($costoPct), 1) . "% respecto a $mesPrevEs "
                   . "($signo" . $peso($costoDelta) . ", $signo" . $num($litrosDelta, 1) . " L)";
        if ($kmDelta !== null) {
            $narrativa .= " con $signo" . $num($kmDelta, 0) . " km " . ($direccion === 'up' ? 'más' : 'menos') . " recorridos";
        }
        $narrativa .= empty($topVehiculos) ? "." : " Los vehículos que más explican esta variación se detallan abajo.";
    } else {
        $narrativa = "El consumo de combustible de $mesCurEs se mantuvo estable respecto a $mesPrevEs"
                   . ($costoPct !== null ? " (" . ($costoPct >= 0 ? '+' : '') . $num($costoPct, 1) . "% en costo)." : ".");
    }

    return [
        'mes_actual'    => $mesCurEs,
        'mes_anterior'  => $mesPrevEs,
        'litros_delta'  => $litrosDelta,
        'litros_pct'    => $litrosPct,
        'costo_delta'   => $costoDelta,
        'costo_pct'     => $costoPct,
        'km_delta'      => $kmDelta,
        'km_pct'        => $kmPct,
        'precio_delta'  => $precioDelta,
        'precio_pct'    => $precioPct,
        'direccion'     => $direccion,
        'narrativa'     => $narrativa,
        'top_vehiculos' => $topVehiculos,
    ];
}

jsonResponse([
    'summary' => [
        'total_liters'    => (float)$totalLiters,
        'total_cost'      => (float)$totalCost,
        'total_loads'     => (int)$totalLoads,
        'active_vehicles' => (int)$activeVehicles,
    ],
    'last_30_days'  => $last30,
    'by_vehicle'    => $byVehicle,
    'by_fuel_type'  => $byFuelType,
    'monthly_alert' => buildMonthlyAlert($db),
]);
