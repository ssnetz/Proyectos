<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();

match($method) {
    'GET' => (requireAuth() && listLocations($db)),
    default => jsonError('Método no permitido', 405),
};

function listLocations(PDO $db): void {
    $activeOnly = ($_GET['active_only'] ?? '1') !== '0';
    $sql        = "SELECT * FROM locations WHERE 1=1";
    if ($activeOnly) $sql .= " AND active = 1";
    $sql .= " ORDER BY name";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    jsonResponse($stmt->fetchAll());
}
