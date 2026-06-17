<?php
// Punto de entrada — sirve el frontend compilado
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');
