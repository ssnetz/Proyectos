<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();

match($method) {
    'GET'  => (requireAuth() && listLots($db)),
    'POST' => createLot($db, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listLots(PDO $db): void {
    $productId  = $_GET['product_id']  ?? null;
    $locationId = $_GET['location_id'] ?? null;

    $sql = "SELECT pl.id, pl.product_id, pl.location_id,
                   pl.lot_number, pl.expiration_date, pl.quantity,
                   pl.created_at, pl.updated_at,
                   p.name AS product_name, p.code AS product_code, p.unit,
                   l.name AS location_name,
                   DATEDIFF(pl.expiration_date, CURDATE()) AS days_until_expiry
            FROM product_lots pl
            JOIN products  p ON pl.product_id  = p.id
            JOIN locations l ON pl.location_id = l.id
            WHERE pl.quantity > 0";
    $params = [];

    if ($productId) {
        $sql .= " AND pl.product_id = ?";
        $params[] = $productId;
    }
    if ($locationId) {
        $sql .= " AND pl.location_id = ?";
        $params[] = $locationId;
    }

    $sql .= " ORDER BY pl.expiration_date ASC, pl.created_at ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function createLot(PDO $db, array $auth): void {
    $data = getBody();

    if (empty($data['product_id']))  jsonError('Campo requerido: product_id');
    if (empty($data['location_id'])) jsonError('Campo requerido: location_id');
    if (empty($data['quantity']) || (int)$data['quantity'] <= 0) jsonError('La cantidad debe ser mayor a 0');

    $productId  = (int)$data['product_id'];
    $locationId = (int)$data['location_id'];
    $qty        = (int)$data['quantity'];
    $lotNumber  = trim($data['lot_number']      ?? '') ?: null;
    $expDate    = trim($data['expiration_date'] ?? '') ?: null;

    $stmt = $db->prepare("SELECT id FROM products WHERE id = ? AND active = 1");
    $stmt->execute([$productId]);
    if (!$stmt->fetch()) jsonError('Producto no encontrado', 404);

    $stmt = $db->prepare("SELECT quantity FROM product_stock WHERE product_id = ? AND location_id = ?");
    $stmt->execute([$productId, $locationId]);
    $row      = $stmt->fetch();
    $prevStock = $row ? (int)$row['quantity'] : 0;
    $newStock  = $prevStock + $qty;

    $db->beginTransaction();
    try {
        // Upsert stock en la dependencia
        $db->prepare(
            "INSERT INTO product_stock (product_id, location_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = ?"
        )->execute([$productId, $locationId, $newStock, $newStock]);

        // Registrar movimiento de entrada
        $db->prepare(
            "INSERT INTO stock_movements
             (product_id, location_id, type, quantity, previous_stock, new_stock,
              reason, user, user_id, lot_number, expiration_date)
             VALUES (?, ?, 'entrada', ?, ?, ?, 'Carga de lote', ?, ?, ?, ?)"
        )->execute([
            $productId, $locationId, $qty, $prevStock, $newStock,
            $auth['username'], $auth['sub'],
            $lotNumber, $expDate,
        ]);

        // Registrar / actualizar lote
        if ($lotNumber !== null) {
            $stmt = $db->prepare(
                "SELECT id FROM product_lots WHERE product_id = ? AND location_id = ? AND lot_number = ?"
            );
            $stmt->execute([$productId, $locationId, $lotNumber]);
            $existing = $stmt->fetchColumn();
            if ($existing) {
                $db->prepare(
                    "UPDATE product_lots
                     SET quantity = quantity + ?,
                         expiration_date = COALESCE(?, expiration_date),
                         updated_at = NOW()
                     WHERE id = ?"
                )->execute([$qty, $expDate, $existing]);
            } else {
                $db->prepare(
                    "INSERT INTO product_lots (product_id, location_id, lot_number, expiration_date, quantity)
                     VALUES (?, ?, ?, ?, ?)"
                )->execute([$productId, $locationId, $lotNumber, $expDate, $qty]);
            }
        } else {
            $db->prepare(
                "INSERT INTO product_lots (product_id, location_id, lot_number, expiration_date, quantity)
                 VALUES (?, ?, NULL, ?, ?)"
            )->execute([$productId, $locationId, $expDate, $qty]);
        }

        // Sincronizar total
        $db->prepare(
            "UPDATE products SET stock = (
                SELECT COALESCE(SUM(quantity),0) FROM product_stock WHERE product_id = ?
             ) WHERE id = ?"
        )->execute([$productId, $productId]);

        $db->commit();
        jsonResponse(['message' => 'Lote registrado', 'new_stock' => $newStock], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al registrar lote: ' . $e->getMessage(), 500);
    }
}
