<?php
// Punto de entrada — sirve el frontend compilado
$distDir = __DIR__ . '/frontend/dist';
header('Content-Type: text/html; charset=utf-8');
readfile($distDir . '/index.html');
