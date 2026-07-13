<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'fuel_control');
define('DB_USER', 'fuel_user');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

define('JWT_SECRET', 'cambiar_en_produccion');
define('JWT_EXPIRY', 8 * 3600);
define('QR_SECRET', 'cambiar_en_produccion');

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
