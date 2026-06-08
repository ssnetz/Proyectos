<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();

match ($method) {
    'GET'  => (requireAuth() && listMovimientos($db)),
    'POST' => createMovimiento($db, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listMovimientos(PDO $db): void {
    $productId = $_GET['product_id'] ?? null;
    $type      = $_GET['type']       ?? '';
    $from      = $_GET['from']       ?? '';
    $to        = $_GET['to']         ?? '';
    $limit     = min((int)($_GET['limit'] ?? 50), 500);

    $sql = "SELECT m.*, p.name AS product_name, p.code AS product_code
            FROM stock_movements m
            JOIN products p ON m.product_id = p.id
            WHERE 1=1";
    $params = [];

    if ($productId) {
        $sql .= " AND m.product_id = ?";
        $params[] = (int)$productId;
    }
    if ($type !== '') {
        $sql .= " AND m.type = ?";
        $params[] = $type;
    } else {
        $sql .= " AND m.type != 'dispensa'";
    }
    if ($from !== '') {
        $sql .= " AND DATE(m.created_at) >= ?";
        $params[] = $from;
    }
    if ($to !== '') {
        $sql .= " AND DATE(m.created_at) <= ?";
        $params[] = $to;
    }

    $sql .= " ORDER BY m.created_at DESC LIMIT $limit";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function createMovimiento(PDO $db, array $auth): void {
    $data = getBody();
    foreach (['product_id', 'type', 'quantity'] as $f) {
        if (empty($data[$f])) jsonError("Campo requerido: $f");
    }

    $productId = (int)$data['product_id'];
    $type      = $data['type'];
    $qty       = (int)$data['quantity'];

    if ($qty <= 0) jsonError('La cantidad debe ser mayor a 0');
    if (!in_array($type, ['entrada', 'salida', 'ajuste'])) jsonError('Tipo inválido. Use: entrada, salida, ajuste');

    $stmt = $db->prepare("SELECT stock FROM products WHERE id = ? AND active = 1");
    $stmt->execute([$productId]);
    $product = $stmt->fetch();
    if (!$product) jsonError('Medicamento no encontrado', 404);

    $prevStock = (int)$product['stock'];
    if ($type === 'salida' && $qty > $prevStock) {
        jsonError("Stock insuficiente. Disponible: $prevStock");
    }

    $newStock = match($type) {
        'entrada' => $prevStock + $qty,
        'salida'  => $prevStock - $qty,
        'ajuste'  => $qty,
    };

    $locationId   = !empty($data['location_id'])    ? (int)$data['location_id']    : null;
    $toLocationId = !empty($data['to_location_id']) ? (int)$data['to_location_id'] : null;

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$newStock, $productId]);

        // Actualizar stock por ubicación
        if ($type === 'entrada') {
            adjustProductStock($db, $productId, $locationId, $qty);
        } elseif ($type === 'salida') {
            adjustProductStock($db, $productId, $locationId, -$qty);
        }
        // ajuste: solo cambia el total (products.stock), la distribución
        // por ubicación no se toca — el remanente "sin ubicación" absorbe.

        $qtyStored = $type === 'ajuste' ? abs($newStock - $prevStock) : $qty;
        $stmt = $db->prepare(
            "INSERT INTO stock_movements
             (product_id, location_id, to_location_id, category_id, type, quantity, previous_stock, new_stock, reason, reference, user, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $productId, $locationId, $toLocationId,
            !empty($data['category_id']) ? (int)$data['category_id'] : null,
            $type, $qtyStored, $prevStock, $newStock,
            $data['reason']    ?? null,
            $data['reference'] ?? null,
            $auth['username'],
            $auth['id'] ?? 0,
        ]);

        $db->commit();
        jsonResponse(['message' => 'Movimiento registrado', 'new_stock' => $newStock], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al registrar movimiento: ' . $e->getMessage(), 500);
    }
}
