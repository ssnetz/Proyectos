<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match(true) {
    $method === 'GET'  && $id !== null => (requireAuth() && getDispensa($db, $id)),
    $method === 'GET'                  => (requireAuth() && listDispensas($db)),
    $method === 'POST'                 => createDispensa($db, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listDispensas(PDO $db): void {
    $beneficiarioId = $_GET['beneficiario_id'] ?? null;
    $limit          = min((int)($_GET['limit'] ?? 100), 500);

    $sql = "SELECT d.id, d.fecha, d.observaciones, d.user, d.created_at,
                   b.id AS beneficiario_id, b.dni, b.apellido, b.nombre,
                   b.obra_social, b.numero_afiliado,
                   COUNT(di.id) AS total_items,
                   SUM(di.cantidad) AS total_unidades
            FROM dispensas d
            JOIN beneficiarios b ON d.beneficiario_id = b.id
            LEFT JOIN dispensa_items di ON di.dispensa_id = d.id
            WHERE 1=1";
    $params = [];

    if ($beneficiarioId) {
        $sql    .= " AND d.beneficiario_id = ?";
        $params[] = (int)$beneficiarioId;
    }

    $sql .= " GROUP BY d.id ORDER BY d.created_at DESC LIMIT $limit";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getDispensa(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT d.*, b.dni, b.apellido, b.nombre, b.obra_social, b.numero_afiliado
         FROM dispensas d
         JOIN beneficiarios b ON d.beneficiario_id = b.id
         WHERE d.id = ?"
    );
    $stmt->execute([$id]);
    $dispensa = $stmt->fetch();
    if (!$dispensa) jsonError('Dispensa no encontrada', 404);

    $stmt = $db->prepare(
        "SELECT di.*, p.name AS product_name, p.code AS product_code, p.unit
         FROM dispensa_items di
         JOIN products p ON di.product_id = p.id
         WHERE di.dispensa_id = ?
         ORDER BY di.id"
    );
    $stmt->execute([$id]);
    $dispensa['items'] = $stmt->fetchAll();

    jsonResponse($dispensa);
}

function createDispensa(PDO $db, array $auth): void {
    $data = getBody();

    if (empty($data['beneficiario_id'])) jsonError('Campo requerido: beneficiario_id');
    if (empty($data['fecha']))           jsonError('Campo requerido: fecha');
    if (empty($data['items']) || !is_array($data['items'])) jsonError('Debe incluir al menos un medicamento');
    if (count($data['items']) === 0)     jsonError('Debe incluir al menos un medicamento');

    $beneficiarioId = (int)$data['beneficiario_id'];
    $fecha          = $data['fecha'];

    $stmt = $db->prepare("SELECT id, apellido, nombre FROM beneficiarios WHERE id = ? AND active = 1");
    $stmt->execute([$beneficiarioId]);
    $beneficiario = $stmt->fetch();
    if (!$beneficiario) jsonError('Beneficiario no encontrado', 404);

    // Validate and load stock for each item
    $itemsData = [];
    $seen      = [];
    foreach ($data['items'] as $item) {
        $productId = (int)($item['product_id'] ?? 0);
        $cantidad  = (int)($item['cantidad']   ?? 0);

        if ($productId === 0) jsonError('product_id inválido en un ítem');
        if ($cantidad <= 0)   jsonError('La cantidad debe ser mayor a 0');
        if (isset($seen[$productId])) jsonError('Producto duplicado en la dispensa');
        $seen[$productId] = true;

        $stmt = $db->prepare("SELECT id, name, stock FROM products WHERE id = ? AND active = 1");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) jsonError("Producto ID $productId no encontrado");
        if ($product['stock'] < $cantidad) {
            jsonError("Stock insuficiente para {$product['name']}. Disponible: {$product['stock']}");
        }

        $itemsData[] = [
            'product_id'  => $productId,
            'product_name'=> $product['name'],
            'cantidad'    => $cantidad,
            'stock_previo'=> (int)$product['stock'],
            'stock_nuevo' => (int)$product['stock'] - $cantidad,
        ];
    }

    $db->beginTransaction();
    try {
        // Insert dispensa header
        $stmt = $db->prepare(
            "INSERT INTO dispensas (beneficiario_id, fecha, observaciones, user_id, user)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $beneficiarioId,
            $fecha,
            $data['observaciones'] ?? null,
            $auth['sub'],
            $auth['username'],
        ]);
        $dispensaId = (int)$db->lastInsertId();

        $refLabel = "Dispensa #{$dispensaId} — {$beneficiario['apellido']} {$beneficiario['nombre']}";

        foreach ($itemsData as $item) {
            // Insert dispensa item
            $stmt = $db->prepare(
                "INSERT INTO dispensa_items (dispensa_id, product_id, cantidad, stock_previo, stock_nuevo)
                 VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $dispensaId,
                $item['product_id'],
                $item['cantidad'],
                $item['stock_previo'],
                $item['stock_nuevo'],
            ]);

            // Reduce product stock
            $stmt = $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$item['stock_nuevo'], $item['product_id']]);

            // Record in stock_movements
            $stmt = $db->prepare(
                "INSERT INTO stock_movements
                 (product_id, type, quantity, previous_stock, new_stock, reason, reference, user, user_id)
                 VALUES (?, 'salida', ?, ?, ?, 'Dispensa a beneficiario', ?, ?, ?)"
            );
            $stmt->execute([
                $item['product_id'],
                $item['cantidad'],
                $item['stock_previo'],
                $item['stock_nuevo'],
                $refLabel,
                $auth['username'],
                $auth['sub'],
            ]);
        }

        $db->commit();
        jsonResponse(['message' => 'Dispensa registrada', 'id' => $dispensaId], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al registrar la dispensa: ' . $e->getMessage(), 500);
    }
}
