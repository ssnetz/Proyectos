<?php
// Carga masiva de inventario: actualiza stock de múltiples productos a la vez
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();

match($method) {
    'GET'  => (requireAuth() && getInventory($db)),
    'POST' => (requireAuth() && saveInventory($db, requireAuth())),
    default => jsonError('Método no permitido', 405),
};

// Devuelve todos los productos con su stock en una ubicación dada
function getInventory(PDO $db): void {
    $locationId = isset($_GET['location_id']) ? (int)$_GET['location_id'] : 1;
    $category   = $_GET['category'] ?? '';
    $search     = $_GET['search']   ?? '';

    $sql = "SELECT p.id, p.code, p.name, p.unit, p.min_stock,
                   c.name AS category_name,
                   COALESCE(ps.quantity, 0) AS quantity
            FROM products p
            LEFT JOIN categories    c  ON p.category_id = c.id
            LEFT JOIN product_stock ps ON p.id = ps.product_id AND ps.location_id = ?
            WHERE p.active = 1";
    $params = [$locationId];

    if ($category !== '') {
        $sql .= " AND p.category_id = ?";
        $params[] = $category;
    }
    if ($search !== '') {
        $sql .= " AND (p.name LIKE ? OR p.code LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $sql .= " ORDER BY c.name, p.name";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

// Recibe { location_id, items: [{product_id, quantity}] } y aplica ajustes
function saveInventory(PDO $db, array $auth): void {
    $data       = getBody();
    $locationId = (int)($data['location_id'] ?? 0);
    $items      = $data['items'] ?? [];

    if (!$locationId) jsonError('Campo requerido: location_id');
    if (empty($items) || !is_array($items)) jsonError('Sin ítems para guardar');

    // Filtrar solo los que tienen cantidad >= 0
    $items = array_filter($items, fn($it) => isset($it['product_id']) && isset($it['quantity']) && $it['quantity'] >= 0);
    if (empty($items)) jsonError('Sin ítems válidos');

    $db->beginTransaction();
    try {
        $updated = 0;
        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $newQty    = (int)$item['quantity'];

            // Stock anterior en esa ubicación
            $stmt = $db->prepare(
                "SELECT quantity FROM product_stock WHERE product_id = ? AND location_id = ?"
            );
            $stmt->execute([$productId, $locationId]);
            $row     = $stmt->fetch();
            $prevQty = $row ? (int)$row['quantity'] : 0;

            if ($prevQty === $newQty) continue; // Sin cambio

            // Upsert en product_stock
            $db->prepare(
                "INSERT INTO product_stock (product_id, location_id, quantity)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = ?"
            )->execute([$productId, $locationId, $newQty, $newQty]);

            // Registrar ajuste
            $db->prepare(
                "INSERT INTO stock_movements
                 (product_id, location_id, type, quantity, previous_stock, new_stock,
                  reason, user, user_id)
                 VALUES (?, ?, 'ajuste', ?, ?, ?, 'Carga de inventario inicial', ?, ?)"
            )->execute([
                $productId, $locationId,
                abs($newQty - $prevQty), $prevQty, $newQty,
                $auth['username'], $auth['sub'],
            ]);

            // Sincronizar total en products.stock
            $db->prepare(
                "UPDATE products p
                 SET p.stock = (SELECT COALESCE(SUM(ps.quantity),0)
                                FROM product_stock ps WHERE ps.product_id = p.id)
                 WHERE p.id = ?"
            )->execute([$productId]);

            $updated++;
        }

        $db->commit();
        jsonResponse([
            'message' => "Inventario guardado: $updated producto(s) actualizados",
            'updated' => $updated,
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al guardar inventario: ' . $e->getMessage(), 500);
    }
}
