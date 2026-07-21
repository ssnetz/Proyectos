<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'mundial2026');
define('DB_USER', 'mundial_user');
define('DB_PASS', '');

// Clave compartida para las acciones de carga (cargar resultado, registrar
// gol) en resultados.php, fixture.php y goleadores.php. Cambiar acá mismo,
// nunca en el repo (este archivo no se sube con el valor real, ver deploy.sh).
define('APP_PASSWORD', 'cambiar_esta_clave');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}
