<?php
function setCorsHeaders(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json; charset=utf-8');
}

function handleOptions(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function jsonResponse(mixed $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $status = 400): void {
    jsonResponse(['error' => $message], $status);
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function getMethod(): string {
    return $_SERVER['REQUEST_METHOD'];
}

function getId(): ?int {
    $id = $_GET['id'] ?? null;
    return $id !== null ? (int)$id : null;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwtEncode(array $payload, string $secret): string {
    $header  = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url_encode(json_encode($payload));
    $sig     = base64url_encode(hash_hmac('sha256', "$header.$payload", $secret, true));
    return "$header.$payload.$sig";
}

function jwtDecode(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $sig] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', "$header.$payload", $secret, true));

    if (!hash_equals($expected, $sig)) return null;

    $data = json_decode(base64url_decode($payload), true);
    if (!$data) return null;

    if (isset($data['exp']) && $data['exp'] < time()) return null;

    return $data;
}

function getAuthHeader(): string {
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        return $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    return '';
}

function requireAuth(): array {
    $authHeader = getAuthHeader();
    if (!str_starts_with($authHeader, 'Bearer ')) {
        jsonError('No autorizado', 401);
    }
    $token   = substr($authHeader, 7);
    $payload = jwtDecode($token, JWT_SECRET);
    if (!$payload) {
        jsonError('No autorizado', 401);
    }
    return $payload;
}

function getCurrentUserId(): int {
    $payload = requireAuth();
    return (int)($payload['sub'] ?? $payload['user_id'] ?? 0);
}

function requireAdmin(): array {
    $payload = requireAuth();
    if (($payload['role'] ?? '') !== 'admin') {
        jsonError('Sin permisos', 403);
    }
    return $payload;
}

// Suma los km GPS importados entre la última carga de este vehículo
// (exclusive) y el día de $fueledAt (exclusive también: el día de la carga
// no cuenta, igual que el selector manual "GPS" de Fueling.jsx, que resta un
// día a propósito antes de mostrar los registros). Así el km autocompletado
// al guardar una carga queda igual al que el usuario elegiría a mano.
function calcularKmDesdeUltimaCarga(PDO $db, int $vehicleId, string $fueledAt): ?float {
    $untilDate = substr($fueledAt, 0, 10);

    $stmt = $db->prepare(
        'SELECT DATE(fueled_at) AS last_date FROM fueling
         WHERE vehicle_id = ? AND DATE(fueled_at) < ?
         ORDER BY fueled_at DESC LIMIT 1'
    );
    $stmt->execute([$vehicleId, $untilDate]);
    $fromDate = $stmt->fetchColumn();

    $sql = 'SELECT SUM(km_recorridos) FROM gps_daily_stats WHERE vehicle_id = ? AND import_date < ?';
    $params = [$vehicleId, $untilDate];
    if ($fromDate) { $sql .= ' AND import_date > ?'; $params[] = $fromDate; }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $total = $stmt->fetchColumn();
    return $total !== null ? round((float)$total, 2) : null;
}

// ─── Nivel estimado de tanque (sin sensores reales) ────────────────────────
//
// Se calcula solo con lo que ya existe: sube con cada carga registrada
// (ajustarNivelTanque, llamado desde fueling.php) y baja con los km GPS
// importados (ajustarNivelTanquePorKm). No hay hardware de nivel de tanque: es una
// estimación que arranca en "tanque lleno" la primera vez que se toca un
// vehículo y se va ajustando con cada movimiento real.
const TANK_LEVEL_THRESHOLD_PCT = 0.25; // 25% del tanque dispara la orden automática

// Suma o resta $deltaLiters al nivel estimado del vehículo (clamp entre 0 y
// tank_capacity) y, si corresponde, dispara la orden de carga automática.
// No hace nada si el vehículo no tiene tank_capacity cargado (no hay con qué
// calcular un %).
function ajustarNivelTanque(PDO $db, int $vehicleId, float $deltaLiters): void {
    $stmt = $db->prepare('SELECT tank_capacity, km_per_liter, fuel_level_liters FROM vehicles WHERE id = ?');
    $stmt->execute([$vehicleId]);
    $v = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$v || !$v['tank_capacity']) return;

    $tankCapacity = (float)$v['tank_capacity'];
    $nivelActual  = $v['fuel_level_liters'] !== null ? (float)$v['fuel_level_liters'] : $tankCapacity;
    $nuevoNivel   = max(0, min($tankCapacity, $nivelActual + $deltaLiters));

    $upd = $db->prepare('UPDATE vehicles SET fuel_level_liters = ?, fuel_level_updated_at = NOW() WHERE id = ?');
    $upd->execute([$nuevoNivel, $vehicleId]);

    if ($tankCapacity > 0 && ($nuevoNivel / $tankCapacity) <= TANK_LEVEL_THRESHOLD_PCT) {
        generarOrdenAutomaticaSiNoExiste($db, $vehicleId, $nuevoNivel, $tankCapacity);
    }
}

// Descuenta el consumo estimado por km recorridos (km / km_per_liter). No
// hace nada si el vehículo no tiene km_per_liter cargado.
function ajustarNivelTanquePorKm(PDO $db, int $vehicleId, float $km): void {
    $stmt = $db->prepare('SELECT km_per_liter FROM vehicles WHERE id = ?');
    $stmt->execute([$vehicleId]);
    $kmPerLiter = (float)($stmt->fetchColumn() ?: 0);
    if ($kmPerLiter <= 0) return;

    ajustarNivelTanque($db, $vehicleId, -($km / $kmPerLiter));
}

function generarOrdenAutomaticaSiNoExiste(PDO $db, int $vehicleId, float $nivelActual, float $tankCapacity): void {
    $existe = $db->prepare("SELECT id FROM fuel_orders WHERE vehicle_id = ? AND status = 'pendiente' LIMIT 1");
    $existe->execute([$vehicleId]);
    if ($existe->fetchColumn()) return; // ya hay una pendiente, no duplicar

    $fuelType = $db->prepare('SELECT fuel_type FROM fueling WHERE vehicle_id = ? ORDER BY fueled_at DESC LIMIT 1');
    $fuelType->execute([$vehicleId]);
    $tipo = $fuelType->fetchColumn() ?: 'Diesel 500';

    $adminId = (int)($db->query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")->fetchColumn() ?: 0);
    if (!$adminId) return; // no hay a quién atribuir la orden

    $pct = round(($nivelActual / $tankCapacity) * 100, 1);
    $litrosFaltantes = round($tankCapacity - $nivelActual, 2);

    $ins = $db->prepare('
        INSERT INTO fuel_orders (vehicle_id, user_id, fuel_type, liters_requested, driver_name, notes, auto_generada)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    ');
    $ins->execute([
        $vehicleId, $adminId, $tipo, $litrosFaltantes,
        'Sin asignar (orden automática)',
        "Generada automáticamente: nivel estimado del tanque {$pct}%.",
    ]);
}

// Filas agregadas por mes (litros, costo, precio prom, km) — usada por los
// reportes mensuales de fuel-control y por la alerta automática del Dashboard.
function monthlyAggregateRows(PDO $db, string $fromDt, string $toDt, string $fromG, string $toG, int $areaId): array {
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
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
