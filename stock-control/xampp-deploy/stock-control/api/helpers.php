<?php
function startSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['path' => '/', 'samesite' => 'Lax', 'httponly' => true]);
        session_start();
    }
}

function setCorsHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
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
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function getMethod(): string {
    return $_SERVER['REQUEST_METHOD'];
}

function getId(): ?int {
    $id = $_GET['id'] ?? null;
    return $id !== null ? (int)$id : null;
}

function requireAuth(): array {
    startSession();
    if (empty($_SESSION['user'])) {
        jsonError('No autorizado', 401);
    }
    return $_SESSION['user'];
}

function requireAdmin(): array {
    $user = requireAuth();
    if (($user['role'] ?? '') !== 'admin') {
        jsonError('Sin permisos', 403);
    }
    return $user;
}
