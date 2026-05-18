<?php
// Endpoint: /api/stock_lotes — gestiona lotes e inventario de medicamentos
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getLote($db, $id) : listLotes($db))),
    'POST'   => (requireAdmin() && createLote($db)),
    'PUT'    => (requireAdmin() && ($id ? updateLote($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteLote($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listLotes(PDO $db): void {
    $medicamentoId = $_GET['medicamento_id'] ?? null;
    $proveedorId   = $_GET['proveedor_id']   ?? null;
    $vencidos      = isset($_GET['vencidos']);
    $bajoStock     = isset($_GET['bajo_stock']);
    $refrigerados  = isset($_GET['refrigerados']);

    $sql = "SELECT sl.*,
                   m.nombre_comercial, m.nombre_generico, m.controlado, m.refrigerado,
                   p.razon_social AS proveedor_nombre
            FROM stock_lotes sl
            JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
            LEFT JOIN proveedores p ON sl.id_proveedor = p.id_proveedor
            WHERE m.activo = 1";
    $params = [];

    if ($medicamentoId) {
        $sql .= " AND sl.id_medicamento = ?";
        $params[] = $medicamentoId;
    }
    if ($proveedorId) {
        $sql .= " AND sl.id_proveedor = ?";
        $params[] = $proveedorId;
    }
    if ($vencidos) {
        $sql .= " AND sl.fecha_caducidad < CURDATE()";
    }
    if ($bajoStock) {
        $sql .= " AND sl.cantidad_existente <= sl.stock_minimo";
    }
    if ($refrigerados) {
        $sql .= " AND m.refrigerado = 1";
    }

    $sql .= " ORDER BY sl.fecha_caducidad ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getLote(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT sl.*, m.nombre_comercial, m.nombre_generico, m.controlado, m.refrigerado,
                p.razon_social AS proveedor_nombre
         FROM stock_lotes sl
         JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
         LEFT JOIN proveedores p ON sl.id_proveedor = p.id_proveedor
         WHERE sl.id_stock = ?"
    );
    $stmt->execute([$id]);
    $lote = $stmt->fetch();
    if (!$lote) jsonError('Lote no encontrado', 404);
    jsonResponse($lote);
}

function createLote(PDO $db): void {
    $data = getBody();
    $required = ['id_medicamento', 'lote', 'fecha_caducidad'];
    foreach ($required as $field) {
        if (empty($data[$field])) jsonError("Campo requerido: $field");
    }

    $db->beginTransaction();
    try {
        $stmt = $db->prepare(
            "INSERT INTO stock_lotes
             (id_medicamento, id_proveedor, codigo_barras, lote, fecha_caducidad,
              cantidad_existente, stock_minimo, precio_costo, precio_venta,
              fecha_ultima_compra, ubicacion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            (int)$data['id_medicamento'],
            $data['id_proveedor']        ?? null,
            $data['codigo_barras']       ?? null,
            $data['lote'],
            $data['fecha_caducidad'],
            (int)($data['cantidad_existente'] ?? 0),
            (int)($data['stock_minimo']       ?? 5),
            (float)($data['precio_costo']     ?? 0),
            (float)($data['precio_venta']     ?? 0),
            $data['fecha_ultima_compra'] ?? null,
            $data['ubicacion']           ?? null,
        ]);

        $idStock = (int)$db->lastInsertId();
        $cantidad = (int)($data['cantidad_existente'] ?? 0);

        if ($cantidad > 0) {
            registrarMovimiento($db, $idStock, (int)$data['id_medicamento'], 'entrada', $cantidad, 0, 'Stock inicial de lote');
        }

        $db->commit();
        jsonResponse(['id' => $idStock, 'message' => 'Lote creado'], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al crear lote: ' . $e->getMessage(), 500);
    }
}

function updateLote(PDO $db, int $id): void {
    $data = getBody();
    $stmt = $db->prepare(
        "UPDATE stock_lotes SET
         id_proveedor=?, codigo_barras=?, lote=?, fecha_caducidad=?,
         stock_minimo=?, precio_costo=?, precio_venta=?, fecha_ultima_compra=?,
         ubicacion=?, updated_at=NOW()
         WHERE id_stock=?"
    );
    $stmt->execute([
        $data['id_proveedor']      ?? null,
        $data['codigo_barras']     ?? null,
        $data['lote'],
        $data['fecha_caducidad'],
        (int)($data['stock_minimo']    ?? 5),
        (float)($data['precio_costo'] ?? 0),
        (float)($data['precio_venta'] ?? 0),
        $data['fecha_ultima_compra'] ?? null,
        $data['ubicacion']           ?? null,
        $id,
    ]);
    jsonResponse(['message' => 'Lote actualizado']);
}

function deleteLote(PDO $db, int $id): void {
    $stmt = $db->prepare("DELETE FROM stock_lotes WHERE id_stock = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Lote eliminado']);
}

function registrarMovimiento(PDO $db, int $idStock, int $idMed, string $tipo, int $cantidad, int $anterior, string $motivo): void {
    $nuevo = $tipo === 'salida' ? $anterior - $cantidad : $anterior + $cantidad;
    $stmt = $db->prepare(
        "INSERT INTO movimientos_stock (id_stock, id_medicamento, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([$idStock, $idMed, $tipo, $cantidad, $anterior, $nuevo, $motivo]);
}
