<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match ($method) {
    'GET'    => (requireAuth() && ($id ? getProduct($db, $id) : listProducts($db))),
    'POST'   => createProduct($db, requireAuth()),
    'PUT'    => ($id ? updateProduct($db, $id, requireAuth()) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteProduct($db, $id, requireAuth()) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function listProducts(PDO $db): void {
    $search     = $_GET['search']      ?? '';
    $categoryId = $_GET['category_id'] ?? ($_GET['category'] ?? '');
    $lowStock   = isset($_GET['low_stock']);
    $activeOnly = ($_GET['active'] ?? '1') !== '0';

    $sql = "SELECT p.*, c.name AS category_name, s.name AS supplier_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers s  ON p.supplier_id  = s.id
            WHERE 1=1";
    $params = [];

    if ($activeOnly) {
        $sql .= " AND p.active = 1";
    }
    if ($search !== '') {
        $sql      .= " AND (p.name LIKE ? OR p.code LIKE ? OR p.therapeutic_action LIKE ?)";
        $like      = "%$search%";
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    if ($categoryId !== '') {
        $sql      .= " AND p.category_id = ?";
        $params[] = $categoryId;
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
         LEFT JOIN suppliers s  ON p.supplier_id  = s.id
         WHERE p.id = ?"
    );
    $stmt->execute([$id]);
    $product = $stmt->fetch();
    if (!$product) jsonError('Medicamento no encontrado', 404);
    jsonResponse($product);
}

function createProduct(PDO $db, array $auth): void {
    $data = getBody();
    foreach (['code', 'name'] as $field) {
        if (empty($data[$field])) jsonError("Campo requerido: $field");
    }

    $stmt = $db->prepare(
        "INSERT INTO products
         (code, name, description, therapeutic_action, category_id, supplier_id,
          purchase_price, sale_price, stock, min_stock, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    try {
        $stmt->execute([
            trim($data['code']),
            trim($data['name']),
            $data['description']       ?? null,
            $data['therapeutic_action'] ?? null,
            $data['category_id']       ?? null,
            $data['supplier_id']       ?? null,
            $data['purchase_price']    ?? 0,
            $data['sale_price']        ?? 0,
            $data['stock']             ?? 0,
            $data['min_stock']         ?? 5,
            $data['unit']              ?? 'unidad',
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe un medicamento con ese código');
        throw $e;
    }

    $newId = (int)$db->lastInsertId();
    if ((int)($data['stock'] ?? 0) > 0) {
        registerMovement($db, $newId, 'entrada', (int)$data['stock'], 0, 'Stock inicial', $auth['username'], $auth['id'] ?? $auth['sub']);
    }

    $stmt = $db->prepare(
        "SELECT p.*, c.name AS category_name, s.name AS supplier_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN suppliers s  ON p.supplier_id  = s.id
         WHERE p.id = ?"
    );
    $stmt->execute([$newId]);
    jsonResponse($stmt->fetch(), 201);
}

function updateProduct(PDO $db, int $id, array $auth): void {
    $data = getBody();
    foreach (['code', 'name'] as $field) {
        if (empty($data[$field])) jsonError("Campo requerido: $field");
    }

    $stmt = $db->prepare(
        "UPDATE products SET
            code=?, name=?, description=?, therapeutic_action=?,
            category_id=?, supplier_id=?, purchase_price=?, sale_price=?,
            min_stock=?, unit=?, updated_at=NOW()
         WHERE id=?"
    );
    try {
        $stmt->execute([
            trim($data['code']),
            trim($data['name']),
            $data['description']       ?? null,
            $data['therapeutic_action'] ?? null,
            $data['category_id']       ?? null,
            $data['supplier_id']       ?? null,
            $data['purchase_price']    ?? 0,
            $data['sale_price']        ?? 0,
            $data['min_stock']         ?? 5,
            $data['unit']              ?? 'unidad',
            $id,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe un medicamento con ese código');
        throw $e;
    }

    $stmt = $db->prepare(
        "SELECT p.*, c.name AS category_name, s.name AS supplier_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN suppliers s  ON p.supplier_id  = s.id
         WHERE p.id = ?"
    );
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

function deleteProduct(PDO $db, int $id, array $auth): void {
    $stmt = $db->prepare("UPDATE products SET active = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('Medicamento no encontrado', 404);
    jsonResponse(['message' => 'Medicamento desactivado']);
}

function registerMovement(PDO $db, int $productId, string $type, int $qty, int $prev, string $reason, string $username = '', int $userId = 0): void {
    $new = $type === 'salida' ? $prev - $qty : $prev + $qty;
    $stmt = $db->prepare(
        "INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, user, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([$productId, $type, $qty, $prev, $new, $reason, $username, $userId]);
}
