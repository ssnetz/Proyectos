<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$ref    = $_GET['ref'] ?? null;

match(true) {
    $method === 'GET'  && $ref !== null => (requireAuth() && getDispensa($db, $ref)),
    $method === 'GET'                   => (requireAuth() && listDispensas($db)),
    $method === 'POST'                  => createDispensa($db, requireAuth()),
    default => jsonError('Método no permitido', 405),
};

function listDispensas(PDO $db): void {
    $personaId = $_GET['persona_id'] ?? null;
    $limit     = min((int)($_GET['limit'] ?? 100), 500);

    $sql = "SELECT
                sm.reference,
                sm.beneficiary_id,
                p.documento, p.tipo_documento, p.apellido, p.nombre,
                MIN(sm.created_at)  AS fecha,
                COUNT(sm.id)        AS total_items,
                SUM(sm.quantity)    AS total_unidades,
                sm.user,
                sm.location_id,
                l.name              AS location_name,
                MIN(sm.reason)      AS observaciones
            FROM stock_movements sm
            JOIN personas p ON sm.beneficiary_id = p.id
            LEFT JOIN locations l ON sm.location_id = l.id
            WHERE sm.type = 'dispensa'";
    $params = [];

    if ($personaId) {
        $sql    .= " AND sm.beneficiary_id = ?";
        $params[] = (int)$personaId;
    }

    $sql .= " GROUP BY sm.reference, sm.beneficiary_id, sm.user, sm.location_id
              ORDER BY MIN(sm.created_at) DESC
              LIMIT $limit";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getDispensa(PDO $db, string $ref): void {
    // Header info from first movement in this reference
    $stmt = $db->prepare(
        "SELECT sm.reference, sm.beneficiary_id, sm.user, sm.location_id,
                MIN(sm.created_at) AS fecha,
                MIN(sm.reason) AS observaciones,
                p.documento, p.tipo_documento, p.apellido, p.nombre,
                p.calle, p.numeracion, p.barrio, p.cuit_cuil,
                l.name AS location_name, l.type AS location_type
         FROM stock_movements sm
         JOIN personas p ON sm.beneficiary_id = p.id
         LEFT JOIN locations l ON sm.location_id = l.id
         WHERE sm.reference = ? AND sm.type = 'dispensa'
         GROUP BY sm.reference, sm.beneficiary_id, sm.user, sm.location_id"
    );
    $stmt->execute([$ref]);
    $dispensa = $stmt->fetch();
    if (!$dispensa) jsonError('Dispensa no encontrada', 404);

    // Items
    $stmt = $db->prepare(
        "SELECT sm.id, sm.product_id, sm.quantity AS cantidad,
                sm.previous_stock AS stock_previo, sm.new_stock AS stock_nuevo,
                pr.name AS product_name, pr.code AS product_code, pr.unit,
                pr.therapeutic_action
         FROM stock_movements sm
         JOIN products pr ON sm.product_id = pr.id
         WHERE sm.reference = ? AND sm.type = 'dispensa'
         ORDER BY sm.id"
    );
    $stmt->execute([$ref]);
    $dispensa['items'] = $stmt->fetchAll();

    jsonResponse($dispensa);
}

function createDispensa(PDO $db, array $auth): void {
    $data = getBody();

    if (empty($data['persona_id']))                        jsonError('Campo requerido: persona_id');
    if (empty($data['items']) || !is_array($data['items'])) jsonError('Debe incluir al menos un medicamento');
    if (count($data['items']) === 0)                       jsonError('Debe incluir al menos un medicamento');

    $personaId  = (int)$data['persona_id'];
    $locationId = !empty($data['location_id']) ? (int)$data['location_id'] : null;

    // Validate persona
    $stmt = $db->prepare("SELECT id, apellido, nombre FROM personas WHERE id = ? AND active = 1");
    $stmt->execute([$personaId]);
    $persona = $stmt->fetch();
    if (!$persona) jsonError('Persona no encontrada', 404);

    // Validate and collect stock for each item
    $itemsData = [];
    $seen      = [];
    foreach ($data['items'] as $item) {
        $productId = (int)($item['product_id'] ?? 0);
        $cantidad  = (int)($item['cantidad']   ?? 0);

        if ($productId === 0)           jsonError('product_id inválido en un ítem');
        if ($cantidad <= 0)             jsonError('La cantidad debe ser mayor a 0');
        if (isset($seen[$productId]))   jsonError('Medicamento duplicado en la dispensa');
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
            'cantidad'    => $cantidad,
            'stock_previo'=> (int)$product['stock'],
            'stock_nuevo' => (int)$product['stock'] - $cantidad,
        ];
    }

    // Unique reference for this dispensa session
    $reference = 'DISP-' . date('YmdHis') . '-P' . $personaId;
    $reason    = $data['observaciones'] ?? null;

    $db->beginTransaction();
    try {
        foreach ($itemsData as $item) {
            // Reduce total product stock
            $stmt = $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$item['stock_nuevo'], $item['product_id']]);

            // Actualizar stock por ubicación
            adjustProductStock($db, $item['product_id'], $locationId, -$item['cantidad']);

            // Record movement with type='dispensa'
            $stmt = $db->prepare(
                "INSERT INTO stock_movements
                 (product_id, location_id, type, quantity, previous_stock, new_stock,
                  reason, reference, user, user_id, beneficiary_id)
                 VALUES (?, ?, 'dispensa', ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $item['product_id'],
                $locationId,
                $item['cantidad'],
                $item['stock_previo'],
                $item['stock_nuevo'],
                $reason,
                $reference,
                $auth['username'],
                $auth['id'] ?? $auth['sub'] ?? 0,
                $personaId,
            ]);
        }

        $db->commit();
        jsonResponse(['message' => 'Dispensa registrada', 'reference' => $reference], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al registrar la dispensa: ' . $e->getMessage(), 500);
    }
}
