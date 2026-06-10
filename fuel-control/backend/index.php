<?php
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (str_starts_with($requestUri, '/fuel-control/api/')) {
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

$distDir  = __DIR__ . '/../frontend/dist';
$filePath = $distDir . str_replace('/fuel-control', '', $requestUri);

if ($requestUri !== '/fuel-control/' && file_exists($filePath) && is_file($filePath)) {
    return false;
}

header('Content-Type: text/html; charset=utf-8');
readfile($distDir . '/index.html');
