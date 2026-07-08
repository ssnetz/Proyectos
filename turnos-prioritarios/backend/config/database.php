<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'turnos_prioritarios');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Base de datos del sistema de stock de la farmacia, donde vive la tabla
// `people` compartida (mismo servidor MySQL).
define('PEOPLE_DB', 'stock_control');

define('JWT_SECRET', 'turnos_prioritarios_secret_key_2026_cambiar_en_produccion');
define('JWT_EXPIRY', 8 * 3600); // 8 horas

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}
