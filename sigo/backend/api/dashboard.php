<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db = getDB();

// Todavía no hay módulo de Obras: por ahora solo devuelve datos básicos del
// sistema para que el Dashboard tenga algo real que mostrar.
$totalUsuarios = (int)$db->query("SELECT COUNT(*) FROM users WHERE active = 1")->fetchColumn();

jsonResponse([
    'usuarios_activos' => $totalUsuarios,
]);
