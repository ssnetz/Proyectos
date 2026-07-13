<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
handleOptions();
requireAuth();
$pdo = getDB();

$vehicle_id = intval($_GET['vehicle_id'] ?? 0);
$until_date = $_GET['until_date'] ?? date('Y-m-d'); // fecha de la carga actual

if (!$vehicle_id) {
    http_response_code(400);
    echo json_encode(['error' => 'vehicle_id requerido']);
    exit;
}

try {
    // 1. Buscar la fecha y litros de la última carga de combustible para este vehículo
    $stmt = $pdo->prepare(
        "SELECT DATE(fueled_at) AS last_date, liters AS last_liters
         FROM fueling
         WHERE vehicle_id = ?
           AND DATE(fueled_at) < ?
         ORDER BY fueled_at DESC
         LIMIT 1"
    );
    $stmt->execute([$vehicle_id, $until_date]);
    $lastFuel = $stmt->fetch(PDO::FETCH_ASSOC);

    $from_date   = $lastFuel ? $lastFuel['last_date']  : null;
    $last_liters = $lastFuel ? (float)$lastFuel['last_liters'] : null;

    // 2. Sumar km GPS entre esas fechas (desde el día DESPUÉS de la última carga hasta until_date inclusive)
    $sql = "SELECT
                SUM(km_recorridos) AS total_km,
                COUNT(*)           AS dias,
                MIN(import_date)   AS desde,
                MAX(import_date)   AS hasta,
                GROUP_CONCAT(
                    CONCAT(import_date, ': ', km_recorridos, ' km')
                    ORDER BY import_date
                    SEPARATOR ' | '
                ) AS detalle
            FROM gps_daily_stats
            WHERE vehicle_id = ?
              AND import_date <= ?";

    $params = [$vehicle_id, $until_date];

    if ($from_date) {
        $sql .= " AND import_date > ?";
        $params[] = $from_date;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'total_km'       => $result['total_km'] ? round((float)$result['total_km'], 2) : 0,
        'dias'           => (int)($result['dias'] ?? 0),
        'desde'          => $result['desde'],
        'hasta'          => $result['hasta'],
        'detalle'        => $result['detalle'],
        'ultima_carga'   => $from_date,
        'last_liters'    => $last_liters,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
