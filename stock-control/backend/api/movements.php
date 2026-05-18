<?php
// Endpoint: /api/movements — registra y consulta movimientos de stock por lote
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();

match($method) {
    'GET'  => (requireAuth() && listMovimientos($db)),
    'POST' => createMovimiento($db, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listMovimientos(PDO $db): void {
    $medicamentoId = $_GET['medicamento_id'] ?? null;
    $stockId       = $_GET['stock_id']       ?? null;
    $tipo          = $_GET['type']            ?? '';
    $limit         = min((int)($_GET['limit'] ?? 50), 200);

    $sql = "SELECT mv.*, m.nombre_comercial, m.nombre_generico, sl.lote, sl.ubicacion
            FROM movimientos_stock mv
            JOIN medicamentos m  ON mv.id_medicamento = m.id_medicamento
            JOIN stock_lotes  sl ON mv.id_stock = sl.id_stock
            WHERE 1=1";
    $params = [];

    if ($medicamentoId) {
        $sql .= " AND mv.id_medicamento = ?";
        $params[] = $medicamentoId;
    }
    if ($stockId) {
        $sql .= " AND mv.id_stock = ?";
        $params[] = $stockId;
    }
    if ($tipo !== '') {
        $sql .= " AND mv.tipo = ?";
        $params[] = $tipo;
    }

    $sql .= " ORDER BY mv.created_at DESC LIMIT $limit";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function createMovimiento(PDO $db, array $authPayload): void {
    $data = getBody();
    $required = ['stock_id', 'tipo', 'cantidad'];
    foreach ($required as $f) {
        if (empty($data[$f])) jsonError("Campo requerido: $f");
    }

    $idStock = (int)$data['stock_id'];
    $tipo    = $data['tipo'];
    $cantidad = (int)$data['cantidad'];

    if ($cantidad <= 0) jsonError('La cantidad debe ser mayor a 0');
    if (!in_array($tipo, ['entrada', 'salida', 'ajuste'])) jsonError('Tipo de movimiento inválido');

    $stmt = $db->prepare(
        "SELECT sl.cantidad_existente, sl.id_medicamento
         FROM stock_lotes sl
         JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
         WHERE sl.id_stock = ? AND m.activo = 1"
    );
    $stmt->execute([$idStock]);
    $lote = $stmt->fetch();
    if (!$lote) jsonError('Lote no encontrado', 404);

    $anterior     = (int)$lote['cantidad_existente'];
    $idMedicamento = (int)$lote['id_medicamento'];

    if ($tipo === 'salida' && $cantidad > $anterior) {
        jsonError("Stock insuficiente en el lote. Disponible: $anterior");
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

        $cantidadAlmacenada = $tipo === 'ajuste' ? abs($nuevo - $anterior) : $cantidad;
        $stmt = $db->prepare(
            "INSERT INTO movimientos_stock
             (id_stock, id_medicamento, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia, usuario, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $idStock, $idMedicamento, $tipo, $cantidadAlmacenada,
            $anterior, $nuevo,
            $data['motivo']     ?? null,
            $data['referencia'] ?? null,
            $authPayload['username'],
            $authPayload['sub'],
        ]);

        $db->commit();
        jsonResponse(['message' => 'Movimiento registrado', 'stock_nuevo' => $nuevo], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al registrar movimiento: ' . $e->getMessage(), 500);
    }
}
