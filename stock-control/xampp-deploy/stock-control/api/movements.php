<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();

match($method) {
    'GET'  => (requireAuth() && listMovements($db)),
    'POST' => createMovement($db, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listMovements(PDO $db): void {
    $productId  = $_GET['product_id']  ?? null;
    $locationId = $_GET['location_id'] ?? null;
    $type       = $_GET['type']        ?? '';
    $limit      = min((int)($_GET['limit'] ?? 50), 200);

    $sql = "SELECT m.*,
                   p.name AS product_name, p.code AS product_code,
                   lf.name AS location_name,
                   lt.name AS to_location_name
            FROM stock_movements m
            JOIN products  p  ON m.product_id  = p.id
            LEFT JOIN locations lf ON m.location_id    = lf.id
            LEFT JOIN locations lt ON m.to_location_id = lt.id
            WHERE 1=1";
    $params = [];

    if ($productId) {
        $sql .= " AND m.product_id = ?";
        $params[] = $productId;
    }
    if ($locationId) {
        $sql .= " AND (m.location_id = ? OR m.to_location_id = ?)";
        $params[] = $locationId;
        $params[] = $locationId;
    }
    if ($type !== '') {
        $sql .= " AND m.type = ?";
        $params[] = $type;
    }

    $sql .= " ORDER BY m.created_at DESC LIMIT $limit";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function createMovement(PDO $db, array $authPayload): void {
    $data     = getBody();
    $required = ['product_id', 'type', 'quantity', 'location_id'];
    foreach ($required as $f) {
        if (empty($data[$f])) jsonError("Campo requerido: $f");
    }

    $productId  = (int)$data['product_id'];
    $locationId = (int)$data['location_id'];
    $type       = $data['type'];
    $qty        = (int)$data['quantity'];

    if ($qty <= 0) jsonError('La cantidad debe ser mayor a 0');
    if (!in_array($type, ['entrada','salida','ajuste','transferencia'])) {
        jsonError('Tipo de movimiento inválido');
    }

    // Verificar que el producto existe
    $stmt = $db->prepare("SELECT id FROM products WHERE id = ? AND active = 1");
    $stmt->execute([$productId]);
    if (!$stmt->fetch()) jsonError('Producto no encontrado', 404);

    // Verificar/crear registro de stock en la ubicación origen
    $stmt = $db->prepare(
        "SELECT quantity FROM product_stock WHERE product_id = ? AND location_id = ?"
    );
    $stmt->execute([$productId, $locationId]);
    $locStock = $stmt->fetch();
    $prevStock = $locStock ? (int)$locStock['quantity'] : 0;

    if ($type === 'transferencia') {
        handleTransfer($db, $authPayload, $data, $productId, $locationId, $qty, $prevStock);
        return;
    }

    $newStock = match($type) {
        'entrada' => $prevStock + $qty,
        'salida'  => $prevStock - $qty,
        'ajuste'  => $qty,
    };

    if ($type === 'salida' && $newStock < 0) {
        jsonError("Stock insuficiente en la ubicación. Disponible: $prevStock");
    }

    $quantityStored = $type === 'ajuste' ? abs($newStock - $prevStock) : $qty;

    $db->beginTransaction();
    try {
        // Upsert stock en la ubicación
        $db->prepare(
            "INSERT INTO product_stock (product_id, location_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = ?"
        )->execute([$productId, $locationId, $newStock, $newStock]);

        // Registrar movimiento
        $db->prepare(
            "INSERT INTO stock_movements
             (product_id, location_id, type, quantity, previous_stock, new_stock,
              reason, reference, user, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            $productId, $locationId, $type, $quantityStored,
            $prevStock, $newStock,
            $data['reason']    ?? null,
            $data['reference'] ?? null,
            $authPayload['username'],
            $authPayload['sub'],
        ]);

        // Registrar lote si es entrada y se proveyó lote o fecha de vencimiento
        if ($type === 'entrada') {
            $lotNumber  = trim($data['lot_number']       ?? '');
            $expDate    = trim($data['expiration_date']  ?? '');
            if ($lotNumber !== '' || $expDate !== '') {
                registerLot(
                    $db, $productId, $locationId,
                    $lotNumber ?: null,
                    $expDate   ?: null,
                    $qty
                );
            }
        }

        // Sincronizar total en products.stock
        syncTotalStock($db, $productId);

        $db->commit();

        // Calcular nuevo total consolidado
        $total = $db->prepare(
            "SELECT COALESCE(SUM(quantity),0) FROM product_stock WHERE product_id = ?"
        );
        $total->execute([$productId]);

        jsonResponse([
            'message'        => 'Movimiento registrado',
            'new_stock'      => $newStock,
            'total_stock'    => (int)$total->fetchColumn(),
        ], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al registrar movimiento: ' . $e->getMessage(), 500);
    }
}

function handleTransfer(
    PDO $db, array $auth, array $data,
    int $productId, int $fromLocationId, int $qty, int $fromStock
): void {
    if (empty($data['to_location_id'])) jsonError('Campo requerido: to_location_id');
    $toLocationId = (int)$data['to_location_id'];
    if ($toLocationId === $fromLocationId) jsonError('El origen y destino no pueden ser iguales');

    if ($qty > $fromStock) {
        jsonError("Stock insuficiente en origen. Disponible: $fromStock");
    }

    // Stock actual en destino
    $stmt = $db->prepare(
        "SELECT quantity FROM product_stock WHERE product_id = ? AND location_id = ?"
    );
    $stmt->execute([$productId, $toLocationId]);
    $toRow    = $stmt->fetch();
    $toStock  = $toRow ? (int)$toRow['quantity'] : 0;

    $newFrom = $fromStock - $qty;
    $newTo   = $toStock   + $qty;

    $db->beginTransaction();
    try {
        // Actualizar origen
        $db->prepare(
            "INSERT INTO product_stock (product_id, location_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = ?"
        )->execute([$productId, $fromLocationId, $newFrom, $newFrom]);

        // Actualizar destino
        $db->prepare(
            "INSERT INTO product_stock (product_id, location_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = ?"
        )->execute([$productId, $toLocationId, $newTo, $newTo]);

        // Registrar movimiento único con ambas ubicaciones
        $db->prepare(
            "INSERT INTO stock_movements
             (product_id, location_id, to_location_id, type, quantity,
              previous_stock, new_stock, reason, reference, user, user_id)
             VALUES (?, ?, ?, 'transferencia', ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            $productId, $fromLocationId, $toLocationId, $qty,
            $fromStock, $newFrom,
            $data['reason']    ?? null,
            $data['reference'] ?? null,
            $auth['username'],
            $auth['sub'],
        ]);

        syncTotalStock($db, $productId);
        $db->commit();

        jsonResponse([
            'message'     => 'Transferencia registrada',
            'from_stock'  => $newFrom,
            'to_stock'    => $newTo,
        ], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error en transferencia: ' . $e->getMessage(), 500);
    }
}

function syncTotalStock(PDO $db, int $productId): void {
    $db->prepare(
        "UPDATE products p
         SET p.stock = (
             SELECT COALESCE(SUM(ps.quantity), 0)
             FROM product_stock ps WHERE ps.product_id = p.id
         )
         WHERE p.id = ?"
    )->execute([$productId]);
}

function registerLot(PDO $db, int $productId, int $locationId, ?string $lotNumber, ?string $expDate, int $qty): void {
    if ($lotNumber !== null) {
        // Si ya existe ese número de lote en esa ubicación, sumar cantidad
        $stmt = $db->prepare(
            "SELECT id FROM product_lots
             WHERE product_id = ? AND location_id = ? AND lot_number = ?"
        );
        $stmt->execute([$productId, $locationId, $lotNumber]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            $db->prepare(
                "UPDATE product_lots SET quantity = quantity + ?, expiration_date = COALESCE(?, expiration_date), updated_at = NOW()
                 WHERE id = ?"
            )->execute([$qty, $expDate, $existing]);
            return;
        }
    }
    $db->prepare(
        "INSERT INTO product_lots (product_id, location_id, lot_number, expiration_date, quantity)
         VALUES (?, ?, ?, ?, ?)"
    )->execute([$productId, $locationId, $lotNumber, $expDate ?: null, $qty]);
}
