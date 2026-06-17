<?php
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Rutas de la API
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

// Servir assets estáticos del build de React
$distDir  = __DIR__ . '/../frontend/dist';
$relative = str_replace('/fuel-control', '', $requestUri);
$filePath = realpath($distDir . $relative);

if ($filePath && str_starts_with($filePath, realpath($distDir)) && is_file($filePath)) {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mime = [
        'js'   => 'application/javascript',
        'css'  => 'text/css',
        'html' => 'text/html',
        'svg'  => 'image/svg+xml',
        'png'  => 'image/png',
        'ico'  => 'image/x-icon',
        'woff2'=> 'font/woff2',
    ];
    header('Content-Type: ' . ($mime[$ext] ?? 'application/octet-stream'));
    readfile($filePath);
    exit;
}

// SPA: todas las rutas devuelven index.html
header('Content-Type: text/html; charset=utf-8');
readfile($distDir . '/index.html');
