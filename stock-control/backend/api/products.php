<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => $id ? getProduct($db, $id) : listProducts($db),
    'POST'   => createProduct($db),
    'PUT'    => $id ? updateProduct($db, $id) : jsonError('ID requerido', 400),
    'DELETE' => $id ? deleteProduct($db, $id) : jsonError('ID requerido', 400),
    default  => jsonError('Método no permitido', 405),
};

function listProducts(PDO $db): void {
    $search = $_GET['search'] ?? '';
    $category = $_GET['category'] ?? '';
    $lowStock = isset($_GET['low_stock']);

    $sql = "SELECT p.*, c.name AS category_name, s.name AS supplier_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.active = 1";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (p.name LIKE ? OR p.code LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    if ($category !== '') {
        $sql .= " AND p.category_id = ?";
        $params[] = $category;
    }
    if ($lowStock) {
        $sql .= " AND p.stock <= p.min_stock";
    }

    $sql .= " ORDER BY p.name";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getProduct(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT p.*, c.name AS category_name, s.name AS supplier_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         WHERE p.id = ?"
    );
    $stmt->execute([$id]);
    $product = $stmt->fetch();
    if (!$product) jsonError('Producto no encontrado', 404);
    jsonResponse($product);
}

function createProduct(PDO $db): void {
    $data = getBody();
    $required = ['code', 'name', 'sale_price'];
    foreach ($required as $field) {
        if (empty($data[$field])) jsonError("Campo requerido: $field");
    }

    $stmt = $db->prepare(
        "INSERT INTO products (code, name, description, category_id, supplier_id,
         purchase_price, sale_price, stock, min_stock, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $data['code'],
        $data['name'],
        $data['description'] ?? null,
        $data['category_id'] ?? null,
        $data['supplier_id'] ?? null,
        $data['purchase_price'] ?? 0,
        $data['sale_price'],
        $data['stock'] ?? 0,
        $data['min_stock'] ?? 5,
        $data['unit'] ?? 'unidad',
    ]);

    $id = (int)$db->lastInsertId();
    if (($data['stock'] ?? 0) > 0) {
        registerMovement($db, $id, 'entrada', (int)$data['stock'], 0, 'Stock inicial');
    }

    jsonResponse(['id' => $id, 'message' => 'Producto creado'], 201);
}

function updateProduct(PDO $db, int $id): void {
    $data = getBody();
    $stmt = $db->prepare(
        "UPDATE products SET code=?, name=?, description=?, category_id=?, supplier_id=?,
         purchase_price=?, sale_price=?, min_stock=?, unit=?, updated_at=NOW()
         WHERE id=?"
    );
    $stmt->execute([
        $data['code'],
        $data['name'],
        $data['description'] ?? null,
        $data['category_id'] ?? null,
        $data['supplier_id'] ?? null,
        $data['purchase_price'] ?? 0,
        $data['sale_price'],
        $data['min_stock'] ?? 5,
        $data['unit'] ?? 'unidad',
        $id,
    ]);
    jsonResponse(['message' => 'Producto actualizado']);
}

function deleteProduct(PDO $db, int $id): void {
    $stmt = $db->prepare("UPDATE products SET active = 0 WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Producto eliminado']);
}

function registerMovement(PDO $db, int $productId, string $type, int $qty, int $prev, string $reason): void {
    $new = $type === 'salida' ? $prev - $qty : $prev + $qty;
    $stmt = $db->prepare(
        "INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([$productId, $type, $qty, $prev, $new, $reason]);
}
