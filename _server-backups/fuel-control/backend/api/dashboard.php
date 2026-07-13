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

jsonResponse([
    'summary' => [
        'total_liters'    => (float)$totalLiters,
        'total_cost'      => (float)$totalCost,
        'total_loads'     => (int)$totalLoads,
        'active_vehicles' => (int)$activeVehicles,
    ],
    'last_30_days' => $last30,
    'by_vehicle'   => $byVehicle,
    'by_fuel_type' => $byFuelType,
]);
