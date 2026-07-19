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

// ─── JWT puro en PHP sin librerías ──────────────────────────────────────────

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
    // Apache en Windows (XAMPP) suele eliminar el header Authorization.
    // Lo recuperamos desde las variables de entorno que pone el .htaccess
    // o desde apache_request_headers() como último recurso.
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

function requireAdmin(): array {
    $payload = requireAuth();
    if (($payload['role'] ?? '') !== 'admin') {
        jsonError('Sin permisos', 403);
    }
    return $payload;
}

// Determina el municipio efectivo de esta request. El frontend siempre manda
// ?municipio_id=... (aun en POST/PUT/DELETE, como query string) con el
// municipio actualmente seleccionado.
// - admin: puede pedir cualquier municipio; se usa el que mande.
// - operador: se ignora lo que mande el cliente y se usa siempre el
//   municipio_id de su propio usuario (por seguridad, no puede leer/escribir
//   otro municipio aunque manipule el parámetro).
function requireMunicipioScope(?array $payload = null): array {
    $payload = $payload ?? requireAuth();
    $role = $payload['role'] ?? 'operador';
    if ($role === 'admin') {
        $requested = $_GET['municipio_id'] ?? null;
        $municipioId = ($requested !== null && $requested !== '') ? (int)$requested : 0;
        if (!$municipioId) jsonError('Debe indicar municipio_id', 400);
    } else {
        $municipioId = (int)($payload['municipio_id'] ?? 0);
        if (!$municipioId) jsonError('Tu usuario no tiene un municipio asignado', 403);
    }
    return ['payload' => $payload, 'municipio_id' => $municipioId];
}

// Determina la elección efectiva de esta request, igual que el municipio: el
// frontend siempre manda ?eleccion_id=... con la elección seleccionada en el
// sidebar (2023, 2027...). No hace falta validar contra la base acá: todas
// las consultas ya filtran también por municipio_id, así que una elección
// que no sea de ese municipio simplemente no matchea ninguna fila.
//
// Un token de fiscal (ver auth.php?action=fiscal_login) trae su propia
// elección fija — se ignora lo que mande el cliente, igual que con
// municipio_id, para que no pueda leer/escribir otra elección.
function requireEleccionScope(): int {
    $payload = requireAuth();
    if (($payload['role'] ?? '') === 'fiscal') {
        $eleccionId = (int)($payload['eleccion_id'] ?? 0);
        if (!$eleccionId) jsonError('Token de fiscal inválido', 403);
        return $eleccionId;
    }
    $eleccionId = $_GET['eleccion_id'] ?? null;
    if ($eleccionId === null || $eleccionId === '') jsonError('Debe indicar eleccion_id', 400);
    return (int)$eleccionId;
}

// Mesa fija de un token de fiscal (null si el token no es de un fiscal).
function fiscalMesaId(): ?int {
    $payload = requireAuth();
    if (($payload['role'] ?? '') !== 'fiscal') return null;
    $mesaId = (int)($payload['mesa_id'] ?? 0);
    if (!$mesaId) jsonError('Token de fiscal inválido', 403);
    return $mesaId;
}
