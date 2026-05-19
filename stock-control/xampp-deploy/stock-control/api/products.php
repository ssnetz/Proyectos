<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getProduct($db, $id) : listProducts($db))),
    'POST'   => (requireAdmin() && createProduct($db)),
    'PUT'    => (requireAdmin() && ($id ? updateProduct($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteProduct($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listProducts(PDO $db): void {
    $search     = $_GET['search']      ?? '';
    $category   = $_GET['category']    ?? '';
    $locationId = isset($_GET['location_id']) ? (int)$_GET['location_id'] : null;
    $lowStock   = isset($_GET['low_stock']);

    if ($locationId) {
        // Stock específico de una ubicación
        $sql = "SELECT p.*, p.therapeutic_action, c.name AS category_name, s.name AS supplier_name,
                       COALESCE(ps.quantity, 0) AS stock_total,
                       COALESCE(ps.min_stock, p.min_stock) AS location_min_stock
                FROM products p
                LEFT JOIN categories    c  ON p.category_id  = c.id
                LEFT JOIN suppliers     s  ON p.supplier_id  = s.id
                LEFT JOIN product_stock ps ON p.id = ps.product_id AND ps.location_id = ?
                WHERE p.active = 1";
        $params = [$locationId];
    } else {
        // Stock consolidado (suma de todas las ubicaciones)
        $sql = "SELECT p.*, c.name AS category_name, s.name AS supplier_name,
                       COALESCE(SUM(ps.quantity), 0) AS stock_total,
                       p.min_stock AS location_min_stock
                FROM products p
                LEFT JOIN categories    c  ON p.category_id  = c.id
                LEFT JOIN suppliers     s  ON p.supplier_id  = s.id
                LEFT JOIN product_stock ps ON p.id = ps.product_id
                WHERE p.active = 1";
        $params = [];
    }

    if ($search !== '') {
        $sql .= " AND (p.name LIKE ? OR p.code LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    if ($category !== '') {
        $sql .= " AND p.category_id = ?";
        $params[] = $category;
    }

    if ($locationId) {
        if ($lowStock) {
            $sql .= " AND COALESCE(ps.quantity, 0) <= COALESCE(ps.min_stock, p.min_stock)";
        }
        $sql .= " ORDER BY p.name";
    } else {
        $sql .= " GROUP BY p.id, p.code, p.name, p.description, p.therapeutic_action, p.category_id, p.supplier_id,
                           p.purchase_price, p.sale_price, p.stock, p.min_stock, p.unit,
                           p.active, p.created_at, p.updated_at, c.name, s.name";
        if ($lowStock) {
            $sql .= " HAVING COALESCE(SUM(ps.quantity), 0) <= p.min_stock";
        }
        $sql .= " ORDER BY p.name";
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    // Agregar detalle por ubicación a cada producto
    if (!$locationId && !empty($products)) {
        $ids = implode(',', array_column($products, 'id'));
        $detail = $db->query(
            "SELECT ps.product_id, ps.quantity, ps.min_stock AS loc_min_stock,
                    l.id AS location_id, l.name AS location_name, l.type AS location_type
             FROM product_stock ps
             JOIN locations l ON ps.location_id = l.id
             WHERE ps.product_id IN ($ids) AND l.active = 1
             ORDER BY FIELD(l.type,'farmacia','guardia','dispensario'), l.name"
        )->fetchAll();

        $byProduct = [];
        foreach ($detail as $row) {
            $byProduct[$row['product_id']][] = [
                'location_id'   => (int)$row['location_id'],
                'location_name' => $row['location_name'],
                'location_type' => $row['location_type'],
                'quantity'      => (int)$row['quantity'],
                'min_stock'     => (int)$row['loc_min_stock'],
            ];
        }
        foreach ($products as &$p) {
            $p['stock_locations'] = $byProduct[$p['id']] ?? [];
            $p['stock_total']     = (int)$p['stock_total'];
        }
        unset($p);
    }

    jsonResponse($products);
}

function getProduct(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT p.*, c.name AS category_name, s.name AS supplier_name,
                COALESCE(SUM(ps.quantity), 0) AS stock_total
         FROM products p
         LEFT JOIN categories    c  ON p.category_id  = c.id
         LEFT JOIN suppliers     s  ON p.supplier_id  = s.id
         LEFT JOIN product_stock ps ON p.id = ps.product_id
         WHERE p.id = ?
         GROUP BY p.id"
    );
    $stmt->execute([$id]);
    $product = $stmt->fetch();
    if (!$product) jsonError('Producto no encontrado', 404);

    // Detalle por ubicación
    $stmt2 = $db->prepare(
        "SELECT ps.quantity, ps.min_stock AS loc_min_stock,
                l.id AS location_id, l.name AS location_name, l.type AS location_type
         FROM product_stock ps
         JOIN locations l ON ps.location_id = l.id
         WHERE ps.product_id = ? AND l.active = 1
         ORDER BY FIELD(l.type,'farmacia','guardia','dispensario'), l.name"
    );
    $stmt2->execute([$id]);
    $product['stock_locations'] = $stmt2->fetchAll();
    $product['stock_total']     = (int)$product['stock_total'];

    jsonResponse($product);
}

function createProduct(PDO $db): void {
    $data     = getBody();
    $required = ['code', 'name'];
    foreach ($required as $field) {
        if (empty($data[$field])) jsonError("Campo requerido: $field");
    }

    $initialStock = (int)($data['stock'] ?? 0);

    $stmt = $db->prepare(
        "INSERT INTO products (code, name, description, therapeutic_action, category_id, supplier_id,
         purchase_price, sale_price, stock, min_stock, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $data['code'],
        $data['name'],
        $data['description']        ?? null,
        $data['therapeutic_action'] ?? null,
        $data['category_id']        ?? null,
        $data['supplier_id']        ?? null,
        $data['purchase_price']     ?? 0,
        $data['sale_price']         ?? 0,
        $initialStock,
        $data['min_stock']          ?? 5,
        $data['unit']               ?? 'unidad',
    ]);

    $productId  = (int)$db->lastInsertId();
    $locationId = (int)($data['location_id'] ?? 1); // Farmacia por defecto

    // Crear registro de stock en la ubicación elegida
    $db->prepare(
        "INSERT INTO product_stock (product_id, location_id, quantity, min_stock)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)"
    )->execute([$productId, $locationId, $initialStock, $data['min_stock'] ?? 5]);

    if ($initialStock > 0) {
        $db->prepare(
            "INSERT INTO stock_movements
             (product_id, location_id, type, quantity, previous_stock, new_stock, reason, user)
             VALUES (?, ?, 'entrada', ?, 0, ?, 'Stock inicial', 'sistema')"
        )->execute([$productId, $locationId, $initialStock, $initialStock]);
    }

    jsonResponse(['id' => $productId, 'message' => 'Producto creado'], 201);
}

function updateProduct(PDO $db, int $id): void {
    $data = getBody();
    $stmt = $db->prepare(
        "UPDATE products SET code=?, name=?, description=?, therapeutic_action=?, category_id=?, supplier_id=?,
         purchase_price=?, sale_price=?, min_stock=?, unit=?, updated_at=NOW()
         WHERE id=?"
    );
    $stmt->execute([
        $data['code'],
        $data['name'],
        $data['description']        ?? null,
        $data['therapeutic_action'] ?? null,
        $data['category_id']        ?? null,
        $data['supplier_id']        ?? null,
        $data['purchase_price']     ?? 0,
        $data['sale_price']         ?? 0,
        $data['min_stock']          ?? 5,
        $data['unit']               ?? 'unidad',
        $id,
    ]);
    jsonResponse(['message' => 'Producto actualizado']);
}

function deleteProduct(PDO $db, int $id): void {
    $db->prepare("UPDATE products SET active = 0 WHERE id = ?")->execute([$id]);
    jsonResponse(['message' => 'Producto eliminado']);
}

// Sincroniza products.stock con la suma de product_stock (usado por movements)
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
