<?php
// Endpoint: /api/movements — movimientos de stock con campos compatibles con el frontend
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();

match($method) {
    'GET'  => (requireAuth() && listMovements($db)),
    'POST' => createMovement($db, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listMovements(PDO $db): void {
    $productId = $_GET['product_id'] ?? null;
    $type      = $_GET['type']       ?? '';
    $limit     = min((int)($_GET['limit'] ?? 50), 200);

    $sql = "SELECT
                mv.id,
                mv.id_medicamento                                AS product_id,
                m.nombre_comercial                               AS product_name,
                CONCAT('MED-', LPAD(m.id_medicamento, 3, '0'))  AS product_code,
                mv.tipo                                          AS type,
                mv.cantidad                                      AS quantity,
                mv.stock_anterior                                AS previous_stock,
                mv.stock_nuevo                                   AS new_stock,
                mv.motivo                                        AS reason,
                mv.referencia                                    AS reference,
                mv.usuario                                       AS user,
                mv.created_at
            FROM movimientos_stock mv
            JOIN medicamentos m ON mv.id_medicamento = m.id_medicamento
            WHERE 1=1";
    $params = [];

    if ($productId) {
        $sql .= " AND mv.id_medicamento = ?";
        $params[] = $productId;
    }
    if ($type !== '') {
        $sql .= " AND mv.tipo = ?";
        $params[] = $type;
    }

    $sql .= " ORDER BY mv.created_at DESC LIMIT $limit";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function createMovement(PDO $db, array $authPayload): void {
    $data = getBody();
    $required = ['product_id', 'type', 'quantity'];
    foreach ($required as $f) {
        if (empty($data[$f])) jsonError("Campo requerido: $f");
    }

    $idMed  = (int)$data['product_id'];
    $tipo   = $data['type'];
    $cantidad = (int)$data['quantity'];

    if ($cantidad <= 0) jsonError('La cantidad debe ser mayor a 0');
    if (!in_array($tipo, ['entrada', 'salida', 'ajuste'])) jsonError('Tipo de movimiento inválido');

    // Verificar que el medicamento existe
    $stmt = $db->prepare("SELECT id_medicamento FROM medicamentos WHERE id_medicamento = ? AND activo = 1");
    $stmt->execute([$idMed]);
    if (!$stmt->fetch()) jsonError('Medicamento no encontrado', 404);

    // Buscar el lote apropiado para el movimiento
    if ($tipo === 'salida') {
        // Para salidas: usar el lote con más stock disponible
        $stmt = $db->prepare(
            "SELECT id_stock, cantidad_existente FROM stock_lotes
             WHERE id_medicamento = ? AND cantidad_existente > 0
             ORDER BY fecha_caducidad ASC, cantidad_existente DESC
             LIMIT 1"
        );
    } else {
        // Para entradas/ajustes: usar el lote más reciente
        $stmt = $db->prepare(
            "SELECT id_stock, cantidad_existente FROM stock_lotes
             WHERE id_medicamento = ?
             ORDER BY id_stock DESC
             LIMIT 1"
        );
    }
    $stmt->execute([$idMed]);
    $lote = $stmt->fetch();

    // Si no hay lote, crear uno automáticamente (solo para entradas)
    if (!$lote) {
        if ($tipo === 'salida') jsonError('Sin stock disponible para este medicamento');
        $stmt = $db->prepare(
            "INSERT INTO stock_lotes
             (id_medicamento, lote, fecha_caducidad, cantidad_existente, stock_minimo)
             VALUES (?, 'AUTO', '2099-12-31', 0, 5)"
        );
        $stmt->execute([$idMed]);
        $idStock  = (int)$db->lastInsertId();
        $anterior = 0;
    } else {
        $idStock  = (int)$lote['id_stock'];
        $anterior = (int)$lote['cantidad_existente'];
    }

    if ($tipo === 'salida' && $cantidad > $anterior) {
        jsonError("Stock insuficiente. Disponible: $anterior");
    }

    $nuevo = match($tipo) {
        'entrada' => $anterior + $cantidad,
        'salida'  => $anterior - $cantidad,
        'ajuste'  => $cantidad,
    };

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("UPDATE stock_lotes SET cantidad_existente = ?, updated_at = NOW() WHERE id_stock = ?");
        $stmt->execute([$nuevo, $idStock]);

        $cantGuardada = $tipo === 'ajuste' ? abs($nuevo - $anterior) : $cantidad;
        $stmt = $db->prepare(
            "INSERT INTO movimientos_stock
             (id_stock, id_medicamento, tipo, cantidad, stock_anterior, stock_nuevo,
              motivo, referencia, usuario, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $idStock, $idMed, $tipo, $cantGuardada, $anterior, $nuevo,
            $data['reason']    ?? null,
            $data['reference'] ?? null,
            $authPayload['username'],
            $authPayload['sub'],
        ]);

        $db->commit();
        jsonResponse(['message' => 'Movimiento registrado', 'new_stock' => $nuevo], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al registrar movimiento: ' . $e->getMessage(), 500);
    }
}
