<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match ($method) {
    'GET'    => (requireAuth() && ($id
                    ? (isset($_GET['distribucion']) ? getDistribucion($db, $id) : getMedicamento($db, $id))
                    : listMedicamentos($db))),
    'POST'   => createMedicamento($db, requireAuth()),
    'PUT'    => ($id ? updateMedicamento($db, $id, requireAuth()) : jsonError('ID requerido', 400)),
    'DELETE' => ($id ? deleteMedicamento($db, $id, requireAuth()) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

// Detect if purchase_price / sale_price columns exist (cached per request)
function hasPriceCols(PDO $db): bool {
    static $has = null;
    if ($has !== null) return $has;
    try {
        $db->query("SELECT purchase_price FROM products LIMIT 0");
        $has = true;
    } catch (Exception $e) {
        $has = false;
    }
    return $has;
}

function listMedicamentos(PDO $db): void {
    $search     = $_GET['search']      ?? '';
    $categoryId = $_GET['category_id'] ?? '';
    $lowStock   = isset($_GET['low_stock']) && $_GET['low_stock'] !== '0';
    $activeOnly = ($_GET['active'] ?? '1') !== '0';

    $price = hasPriceCols($db)
        ? "p.purchase_price, p.sale_price,"
        : "0 AS purchase_price, 0 AS sale_price,";

    $sql = "SELECT p.id, p.code, p.name, p.description, p.therapeutic_action,
                   p.category_id, c.name AS category_name,
                   p.supplier_id, s.name AS supplier_name,
                   $price p.stock, p.min_stock, p.unit, p.active
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers  s ON p.supplier_id  = s.id
            WHERE 1=1";
    $params = [];

    if ($activeOnly) {
        $sql .= " AND p.active = 1";
    }
    if ($search !== '') {
        $sql .= " AND (p.name LIKE ? OR p.code LIKE ? OR p.therapeutic_action LIKE ?)";
        $like  = "%$search%";
        $params[] = $like; $params[] = $like; $params[] = $like;
    }
    if ($categoryId !== '') {
        $sql .= " AND p.category_id = ?";
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

function getMedicamento(PDO $db, int $id): void {
    $price = hasPriceCols($db) ? "p.purchase_price, p.sale_price," : "0 AS purchase_price, 0 AS sale_price,";
    $stmt = $db->prepare(
        "SELECT p.id, p.code, p.name, p.description, p.therapeutic_action,
                p.category_id, c.name AS category_name,
                p.supplier_id, s.name AS supplier_name,
                $price p.stock, p.min_stock, p.unit, p.active, p.created_at, p.updated_at
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN suppliers  s ON p.supplier_id  = s.id
         WHERE p.id = ?"
    );
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Medicamento no encontrado', 404);
    jsonResponse($p);
}

function createMedicamento(PDO $db, array $auth): void {
    $data = getBody();
    foreach (['code', 'name'] as $field) {
        if (empty($data[$field])) jsonError("Campo requerido: $field");
    }

    if (hasPriceCols($db)) {
        $stmt = $db->prepare(
            "INSERT INTO products
             (code, name, description, therapeutic_action, category_id, supplier_id,
              purchase_price, sale_price, stock, min_stock, unit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $values = [
            trim($data['code']),
            trim($data['name']),
            $data['description']        ?? null,
            $data['therapeutic_action'] ?? null,
            $data['category_id']        ?? null,
            $data['supplier_id']        ?? null,
            $data['purchase_price']     ?? 0,
            $data['sale_price']         ?? 0,
            $data['stock']              ?? 0,
            $data['min_stock']          ?? 5,
            $data['unit']               ?? 'unidad',
        ];
    } else {
        $stmt = $db->prepare(
            "INSERT INTO products
             (code, name, description, therapeutic_action, category_id, supplier_id,
              stock, min_stock, unit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $values = [
            trim($data['code']),
            trim($data['name']),
            $data['description']        ?? null,
            $data['therapeutic_action'] ?? null,
            $data['category_id']        ?? null,
            $data['supplier_id']        ?? null,
            $data['stock']              ?? 0,
            $data['min_stock']          ?? 5,
            $data['unit']               ?? 'unidad',
        ];
    }

    try {
        $stmt->execute($values);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe un medicamento con ese código');
        throw $e;
    }

    $newId = (int)$db->lastInsertId();
    if ((int)($data['stock'] ?? 0) > 0) {
        $stmt2 = $db->prepare(
            "INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, user, user_id)
             VALUES (?, 'entrada', ?, 0, ?, 'Stock inicial', ?, ?)"
        );
        $qty = (int)$data['stock'];
        $stmt2->execute([$newId, $qty, $qty, $auth['username'], $auth['id'] ?? 0]);
    }

    getMedicamento($db, $newId);
}

function updateMedicamento(PDO $db, int $id, array $auth): void {
    $data = getBody();
    foreach (['code', 'name'] as $field) {
        if (empty($data[$field])) jsonError("Campo requerido: $field");
    }

    if (hasPriceCols($db)) {
        $stmt = $db->prepare(
            "UPDATE products SET
                code=?, name=?, description=?, therapeutic_action=?,
                category_id=?, supplier_id=?, purchase_price=?, sale_price=?,
                min_stock=?, unit=?, updated_at=NOW()
             WHERE id=?"
        );
        $values = [
            trim($data['code']),
            trim($data['name']),
            $data['description']        ?? null,
            $data['therapeutic_action'] ?? null,
            $data['category_id']        ?? null,
            $data['supplier_id']        ?? null,
            $data['purchase_price']     ?? 0,
            $data['sale_price']         ?? 0,
            $data['min_stock']          ?? 5,
            $data['unit']               ?? 'unidad',
            $id,
        ];
    } else {
        $stmt = $db->prepare(
            "UPDATE products SET
                code=?, name=?, description=?, therapeutic_action=?,
                category_id=?, supplier_id=?,
                min_stock=?, unit=?, updated_at=NOW()
             WHERE id=?"
        );
        $values = [
            trim($data['code']),
            trim($data['name']),
            $data['description']        ?? null,
            $data['therapeutic_action'] ?? null,
            $data['category_id']        ?? null,
            $data['supplier_id']        ?? null,
            $data['min_stock']          ?? 5,
            $data['unit']               ?? 'unidad',
            $id,
        ];
    }

    try {
        $stmt->execute($values);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Ya existe un medicamento con ese código');
        throw $e;
    }

    if ($stmt->rowCount() === 0) {
        $check = $db->prepare("SELECT id FROM products WHERE id = ?");
        $check->execute([$id]);
        if (!$check->fetch()) jsonError('Medicamento no encontrado', 404);
    }

    getMedicamento($db, $id);
}

function getDistribucion(PDO $db, int $productId): void {
    // Stock neto por ubicación desde movimientos
    $stmt = $db->prepare("
        SELECT
            COALESCE(l.name, 'Sin ubicación') AS location_name,
            m.location_id,
            GREATEST(0, SUM(CASE
                WHEN m.type = 'entrada' THEN m.quantity
                WHEN m.type IN ('salida', 'dispensa') THEN -m.quantity
                ELSE 0
            END)) AS net_qty
        FROM stock_movements m
        LEFT JOIN locations l ON m.location_id = l.id
        WHERE m.product_id = ? AND m.location_id IS NOT NULL
        GROUP BY m.location_id, l.name
        HAVING net_qty > 0
        ORDER BY net_qty DESC
    ");
    $stmt->execute([$productId]);
    $rows = $stmt->fetchAll();

    // Stock total autoritativo
    $s = $db->prepare("SELECT stock FROM products WHERE id = ?");
    $s->execute([$productId]);
    $totalStock = (int)($s->fetchColumn() ?: 0);

    $locatedTotal = array_sum(array_column($rows, 'net_qty'));
    $unlocated    = $totalStock - $locatedTotal;

    if ($unlocated > 0) {
        $rows[] = [
            'location_name' => 'Sin ubicación asignada',
            'location_id'   => null,
            'net_qty'        => $unlocated,
        ];
    }

    jsonResponse($rows);
}

function deleteMedicamento(PDO $db, int $id, array $auth): void {
    $stmt = $db->prepare("UPDATE products SET active = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('Medicamento no encontrado', 404);
    jsonResponse(['message' => 'Medicamento desactivado']);
}
