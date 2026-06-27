<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
$authUser = requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // List imports with optional date filter
    $from = $_GET['from'] ?? '';
    $to   = $_GET['to']   ?? '';
    $sql  = "SELECT g.*, u.username AS imported_by
             FROM gps_daily_stats g
             JOIN users u ON u.id = g.user_id
             WHERE 1=1";
    $vehicle_id = $_GET['vehicle_id'] ?? '';
    $params = [];
    if ($from)       { $sql .= ' AND g.import_date >= :from'; $params[':from'] = $from; }
    if ($to)         { $sql .= ' AND g.import_date <= :to';   $params[':to']   = $to;   }
    if ($vehicle_id) { $sql .= ' AND g.vehicle_id = :vid';    $params[':vid']  = (int)$vehicle_id; }
    $sql .= ' ORDER BY g.import_date DESC, g.vehicle_name';
    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->execute();
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $rows = $body['rows'] ?? [];
    if (empty($rows)) {
        http_response_code(400);
        echo json_encode(['error' => 'Sin datos']);
        exit;
    }

    $userId = (int)($authUser['sub'] ?? $authUser['user_id'] ?? 0);
    $inserted = 0;
    $skipped  = 0;

    // Load vehicles for plate matching
    $vStmt = $pdo->query("SELECT id, plate FROM vehicles");
    $vehicleMap = [];
    foreach ($vStmt->fetchAll(PDO::FETCH_ASSOC) as $v) {
        $vehicleMap[strtoupper(trim($v['plate']))] = $v['id'];
    }

    $pdo->beginTransaction();
    try {
        // Verificar que la tabla existe
        $pdo->query("SELECT 1 FROM gps_daily_stats LIMIT 1");
        $ins = $pdo->prepare("INSERT INTO gps_daily_stats
            (import_date, vehicle_name, plate, vehicle_id, km_recorridos,
             tiempo_marcha, tiempo_ralenti, tiempo_detenido,
             vel_max, vel_prom, total_eventos,
             ubicacion_inicio, ubicacion_fin, user_id)
            VALUES
            (:import_date, :vehicle_name, :plate, :vehicle_id, :km_recorridos,
             :tiempo_marcha, :tiempo_ralenti, :tiempo_detenido,
             :vel_max, :vel_prom, :total_eventos,
             :ubicacion_inicio, :ubicacion_fin, :user_id)");

        foreach ($rows as $idx => $row) {
            $plate = strtoupper(trim($row['plate'] ?? ''));
            $vehicleId = $vehicleMap[$plate] ?? null;

            // Saltar filas sin fecha o sin vehículo
            $importDate = trim($row['import_date'] ?? '');
            if (!$importDate || !$row['vehicle_name']) { $skipped++; continue; }

            // Normalizar km: quitar puntos de miles, reemplazar coma decimal
            $kmRaw = str_replace(['.', ','], ['', '.'], (string)($row['km_recorridos'] ?? '0'));
            $km = is_numeric($kmRaw) ? (float)$kmRaw : 0;

            $velMax  = trim((string)($row['vel_max']  ?? ''));
            $velProm = trim((string)($row['vel_prom'] ?? ''));

            $ins->execute([
                ':import_date'      => $importDate,
                ':vehicle_name'     => $row['vehicle_name'],
                ':plate'            => $plate,
                ':vehicle_id'       => $vehicleId ?: null,
                ':km_recorridos'    => $km,
                ':tiempo_marcha'    => $row['tiempo_marcha']   ?: null,
                ':tiempo_ralenti'   => $row['tiempo_ralenti']  ?: null,
                ':tiempo_detenido'  => $row['tiempo_detenido'] ?: null,
                ':vel_max'          => $velMax  !== '' ? (float)str_replace(',', '.', $velMax)  : null,
                ':vel_prom'         => $velProm !== '' ? (float)str_replace(',', '.', $velProm) : null,
                ':total_eventos'    => !empty($row['total_eventos']) ? (int)$row['total_eventos'] : null,
                ':ubicacion_inicio' => $row['ubicacion_inicio'] ?: null,
                ':ubicacion_fin'    => $row['ubicacion_fin']    ?: null,
                ':user_id'          => $userId,
            ]);
            $inserted++;
        }
        $pdo->commit();
        echo json_encode(['inserted' => $inserted, 'skipped' => $skipped]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    $pdo->prepare("DELETE FROM gps_daily_stats WHERE id = ?")->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
