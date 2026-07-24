<?php
// Script de un solo uso para resetear la contraseña del admin sin depender
// de copiar un hash bcrypt a mano (evita corrupción de caracteres al pegar
// por el chat). Borrar este archivo del servidor apenas se use.
header('Content-Type: text/plain; charset=utf-8');

if (($_GET['confirm'] ?? '') !== 'si') {
    echo "Agregá ?confirm=si a la URL para confirmar el reset.";
    exit;
}

try {
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/helpers.php';

    $db   = getDB();
    $hash = password_hash('sigo2026', PASSWORD_DEFAULT);

    $stmt = $db->prepare("UPDATE users SET password = ?, active = 1 WHERE username = 'admin'");
    $stmt->execute([$hash]);

    if ($stmt->rowCount() > 0) {
        echo "OK: contraseña de 'admin' reseteada a 'sigo2026'. Borrá este archivo ahora.";
    } else {
        // No existía la fila 'admin' todavía (o ya tenía ese mismo hash): la crea/verifica.
        $check = $db->prepare("SELECT id FROM users WHERE username = 'admin'");
        $check->execute();
        if ($check->fetch()) {
            echo "OK: ya existía 'admin' con esta contraseña. Borrá este archivo ahora.";
        } else {
            $ins = $db->prepare("INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')");
            $ins->execute([$hash]);
            echo "OK: usuario 'admin' creado con contraseña 'sigo2026'. Borrá este archivo ahora.";
        }
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo "ERROR: " . get_class($e) . ": " . $e->getMessage() . "\n\n";
    echo $e->getTraceAsString();
}
