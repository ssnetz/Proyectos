<?php
require_once '../config/database.php';
requireAuth();

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

    $userId = getCurrentUserId();
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

        foreach ($rows as $row) {
            $plate = strtoupper(trim($row['plate'] ?? ''));
            $vehicleId = $vehicleMap[$plate] ?? null;

            $ins->execute([
                ':import_date'      => $row['import_date'],
                ':vehicle_name'     => $row['vehicle_name'],
                ':plate'            => $plate,
                ':vehicle_id'       => $vehicleId,
                ':km_recorridos'    => (float)str_replace(',', '.', $row['km_recorridos'] ?? 0),
                ':tiempo_marcha'    => $row['tiempo_marcha']    ?? null,
                ':tiempo_ralenti'   => $row['tiempo_ralenti']   ?? null,
                ':tiempo_detenido'  => $row['tiempo_detenido']  ?? null,
                ':vel_max'          => $row['vel_max']  !== '' ? (float)str_replace(',', '.', $row['vel_max']  ?? '') : null,
                ':vel_prom'         => $row['vel_prom'] !== '' ? (float)str_replace(',', '.', $row['vel_prom'] ?? '') : null,
                ':total_eventos'    => $row['total_eventos'] ? (int)$row['total_eventos'] : null,
                ':ubicacion_inicio' => $row['ubicacion_inicio'] ?? null,
                ':ubicacion_fin'    => $row['ubicacion_fin']    ?? null,
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
