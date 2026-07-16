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
