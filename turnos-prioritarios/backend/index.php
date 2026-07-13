<?php
// Entry point del servidor PHP — sirve archivos estáticos del build de React
// y enruta las peticiones /api/* a los handlers correspondientes.

$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Rutas de la API
if (str_starts_with($requestUri, '/api/')) {
    $endpoint = basename($requestUri, '.php');
    $file = __DIR__ . "/api/{$endpoint}.php";
    if (file_exists($file)) {
        require $file;
    } else {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Endpoint no encontrado']);
    }
    exit;
}

// Sirve el build de React
$distDir = __DIR__ . '/../frontend/dist';
$filePath = $distDir . $requestUri;

if ($requestUri !== '/' && file_exists($filePath) && is_file($filePath)) {
    return false; // Deja que el servidor integrado lo sirva
}

// Todas las demás rutas → index.html (SPA routing)
header('Content-Type: text/html; charset=utf-8');
readfile($distDir . '/index.html');
