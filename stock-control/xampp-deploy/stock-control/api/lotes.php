<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

startSession();
setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match (true) {
    $method === 'GET'  && $id !== null => (requireAuth() && getLote($db, $id)),
    $method === 'GET'                  => (requireAuth() && listLotes($db)),
    $method === 'POST'                 => createLote($db, requireAuth()),
    $method === 'DELETE' && $id !== null => deleteLote($db, $id, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listLotes(PDO $db): void {
    $productId    = $_GET['product_id']    ?? null;
    $expiringDays = $_GET['expiring_days'] ?? null;
    $expired      = isset($_GET['expired']) && $_GET['expired'] === '1';

    $sql = "SELECT
                pl.id, pl.lot_number, pl.expiry_date, pl.quantity, pl.created_at,
                pl.product_id, pl.location_id,
                p.name AS product_name, p.code AS product_code, p.unit,
                l.name AS location_name,
                DATEDIFF(pl.expiry_date, CURDATE()) AS days_left
            FROM product_lots pl
            JOIN products p ON pl.product_id = p.id
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE 1=1";
    $params = [];

    if ($productId) {
        $sql .= " AND pl.product_id = ?";
        $params[] = (int)$productId;
    }

    if ($expired) {
        $sql .= " AND pl.expiry_date < CURDATE()";
    } elseif ($expiringDays !== null) {
        $sql .= " AND pl.expiry_date >= CURDATE() AND pl.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)";
        $params[] = (int)$expiringDays;
    }

    $sql .= " ORDER BY pl.expiry_date ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getLote(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT pl.*, p.name AS product_name, p.code AS product_code, p.unit,
                l.name AS location_name,
                DATEDIFF(pl.expiry_date, CURDATE()) AS days_left
         FROM product_lots pl
         JOIN products p ON pl.product_id = p.id
         LEFT JOIN locations l ON pl.location_id = l.id
         WHERE pl.id = ?"
    );
    $stmt->execute([$id]);
    $lote = $stmt->fetch();
    if (!$lote) jsonError('Lote no encontrado', 404);
    jsonResponse($lote);
}

function createLote(PDO $db, array $auth): void {
    $data = getBody();
    foreach (['product_id', 'lot_number', 'expiry_date', 'quantity'] as $f) {
        if (empty($data[$f]) && $data[$f] !== '0') jsonError("Campo requerido: $f");
    }

    $productId  = (int)$data['product_id'];
    $quantity   = (int)$data['quantity'];
    $locationId = !empty($data['location_id']) ? (int)$data['location_id'] : null;

    if ($quantity <= 0) jsonError('La cantidad debe ser mayor a 0');

    // Validate product exists
    $stmt = $db->prepare("SELECT id, name, stock FROM products WHERE id = ? AND active = 1");
    $stmt->execute([$productId]);
    $product = $stmt->fetch();
    if (!$product) jsonError('Medicamento no encontrado', 404);

    $db->beginTransaction();
    try {
        // Create lot
        $stmt = $db->prepare(
            "INSERT INTO product_lots (product_id, lot_number, expiry_date, quantity, location_id)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $productId,
            trim($data['lot_number']),
            $data['expiry_date'],
            $quantity,
            $locationId,
        ]);
        $loteId = (int)$db->lastInsertId();

        // Increment product stock
        $prevStock = (int)$product['stock'];
        $newStock  = $prevStock + $quantity;
        $stmt = $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$newStock, $productId]);

        // Record stock movement
        $stmt = $db->prepare(
            "INSERT INTO stock_movements
             (product_id, location_id, type, quantity, previous_stock, new_stock,
              reason, reference, user, user_id)
             VALUES (?, ?, 'entrada', ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $productId,
            $locationId,
            $quantity,
            $prevStock,
            $newStock,
            'Ingreso de lote ' . $data['lot_number'],
            'LOTE-' . $loteId,
            $auth['username'],
            $auth['id'] ?? 0,
        ]);

        $db->commit();

        $stmt = $db->prepare(
            "SELECT pl.*, p.name AS product_name, l.name AS location_name,
                    DATEDIFF(pl.expiry_date, CURDATE()) AS days_left
             FROM product_lots pl
             JOIN products p ON pl.product_id = p.id
             LEFT JOIN locations l ON pl.location_id = l.id
             WHERE pl.id = ?"
        );
        $stmt->execute([$loteId]);
        jsonResponse($stmt->fetch(), 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al crear lote: ' . $e->getMessage(), 500);
    }
}

function deleteLote(PDO $db, int $id, array $auth): void {
    $stmt = $db->prepare(
        "SELECT pl.*, p.stock AS current_stock
         FROM product_lots pl
         JOIN products p ON pl.product_id = p.id
         WHERE pl.id = ?"
    );
    $stmt->execute([$id]);
    $lote = $stmt->fetch();
    if (!$lote) jsonError('Lote no encontrado', 404);

    $db->beginTransaction();
    try {
        // Remove lot
        $stmt = $db->prepare("DELETE FROM product_lots WHERE id = ?");
        $stmt->execute([$id]);

        // Decrease product stock by lot quantity (floor at 0)
        $prevStock = (int)$lote['current_stock'];
        $newStock  = max(0, $prevStock - (int)$lote['quantity']);
        $stmt = $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$newStock, $lote['product_id']]);

        $db->commit();
        jsonResponse(['message' => 'Lote eliminado']);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al eliminar lote: ' . $e->getMessage(), 500);
    }
}
