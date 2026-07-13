<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db = getDB();

// Calcula km/L de cada vehículo: total GPS km / total litros cargados
$sql = "
    SELECT
        v.id,
        v.name,
        v.plate,
        v.km_per_liter AS actual,
        SUM(g.km_recorridos)  AS total_km,
        SUM(f.liters)         AS total_litros,
        ROUND(SUM(g.km_recorridos) / NULLIF(SUM(f.liters), 0), 2) AS km_l_calculado
    FROM vehicles v
    JOIN gps_daily_stats g ON g.vehicle_id = v.id
    JOIN fueling f          ON f.vehicle_id = v.id
    WHERE v.active = 1
    GROUP BY v.id, v.name, v.plate, v.km_per_liter
    HAVING km_l_calculado IS NOT NULL
       AND km_l_calculado > 0
       AND km_l_calculado < 60
    ORDER BY v.name
";

$stmt = $db->query($sql);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Actualizar solo los que no tienen km_per_liter o que el usuario quiera sobreescribir
    $overwrite = json_decode(file_get_contents('php://input'), true)['overwrite'] ?? false;
    $updated = 0;
    foreach ($rows as $row) {
        if ($overwrite || !$row['actual']) {
            $upd = $db->prepare("UPDATE vehicles SET km_per_liter = ? WHERE id = ?");
            $upd->execute([$row['km_l_calculado'], $row['id']]);
            $updated++;
        }
    }
    jsonResponse(['updated' => $updated, 'preview' => $rows]);
}

// GET: solo devolver preview sin actualizar
jsonResponse($rows);
