<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match ($method) {
    'GET'    => (requireAuth() && ($id ? getFactura($db, $id) : listFacturas($db))),
    'POST'   => createFactura($db, requireAuth()),
    'DELETE' => ($id ? deleteFactura($db, $id, requireAuth()) : jsonError('ID requerido', 400)),
    default  => jsonError('Método no permitido', 405),
};

function listFacturas(PDO $db): void {
    $stmt = $db->prepare("
        SELECT
            fi.id, fi.invoice_number, fi.invoice_date, fi.notes,
            fi.created_at, fi.user,
            s.name AS supplier_name,
            COUNT(pl.id)       AS total_lotes,
            COALESCE(SUM(pl.quantity), 0) AS total_unidades
        FROM purchase_invoices fi
        LEFT JOIN suppliers s    ON fi.supplier_id = s.id
        LEFT JOIN product_lots pl ON pl.invoice_id = fi.id
        GROUP BY fi.id
        ORDER BY fi.created_at DESC
        LIMIT 300
    ");
    $stmt->execute();
    jsonResponse($stmt->fetchAll());
}

function getFactura(PDO $db, int $id): void {
    $stmt = $db->prepare("
        SELECT fi.*, s.name AS supplier_name
        FROM purchase_invoices fi
        LEFT JOIN suppliers s ON fi.supplier_id = s.id
        WHERE fi.id = ?
    ");
    $stmt->execute([$id]);
    $factura = $stmt->fetch();
    if (!$factura) jsonError('Factura no encontrada', 404);

    $stmt = $db->prepare("
        SELECT pl.id, pl.lot_number, pl.marca, pl.expiration_date AS expiry_date,
               pl.quantity, pl.location_id,
               p.id AS product_id, p.name AS product_name, p.code AS product_code,
               p.description AS product_description, p.unit,
               l.name AS location_name
        FROM product_lots pl
        JOIN products p  ON pl.product_id  = p.id
        LEFT JOIN locations l ON pl.location_id = l.id
        WHERE pl.invoice_id = ?
        ORDER BY pl.id
    ");
    $stmt->execute([$id]);
    $factura['lotes'] = $stmt->fetchAll();
    jsonResponse($factura);
}

function createFactura(PDO $db, array $auth): void {
    $data = getBody();

    if (empty($data['invoice_number']))                          jsonError('Campo requerido: invoice_number');
    if (empty($data['items']) || !is_array($data['items']))      jsonError('Debe incluir al menos un ítem');

    $supplierId  = !empty($data['supplier_id'])  ? (int)$data['supplier_id']  : null;
    $locationId  = !empty($data['location_id'])  ? (int)$data['location_id']  : null;
    $invoiceDate = !empty($data['invoice_date']) ? $data['invoice_date'] : date('Y-m-d');

    $db->beginTransaction();
    try {
        // Crear encabezado de factura
        $stmt = $db->prepare(
            "INSERT INTO purchase_invoices
             (invoice_number, supplier_id, invoice_date, notes, user, user_id)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            trim($data['invoice_number']),
            $supplierId,
            $invoiceDate,
            $data['notes'] ?? null,
            $auth['username'],
            $auth['id'] ?? 0,
        ]);
        $facturaId = (int)$db->lastInsertId();

        foreach ($data['items'] as $idx => $item) {
            $productId  = (int)($item['product_id']  ?? 0);
            $quantity   = (int)($item['quantity']    ?? 0);
            $lotNumber  = trim($item['lot_number']   ?? '');
            $marca      = trim($item['marca']        ?? '');
            $expiryDate = !empty($item['expiry_date']) ? $item['expiry_date'] : null;
            $itemLocId  = !empty($item['location_id']) ? (int)$item['location_id'] : $locationId;

            if ($productId === 0) jsonError("Ítem " . ($idx + 1) . ": producto inválido");
            if ($quantity  <= 0)  jsonError("Ítem " . ($idx + 1) . ": la cantidad debe ser mayor a 0");

            $s = $db->prepare("SELECT id, name, stock FROM products WHERE id = ? AND active = 1");
            $s->execute([$productId]);
            $product = $s->fetch();
            if (!$product) jsonError("Producto ID $productId no encontrado");

            $prevStock = (int)$product['stock'];
            $newStock  = $prevStock + $quantity;

            // Crear lote vinculado a la factura
            $s = $db->prepare(
                "INSERT INTO product_lots
                 (product_id, lot_number, marca, expiration_date, quantity, location_id, invoice_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $s->execute([
                $productId,
                $lotNumber ?: null,
                $marca     ?: null,
                $expiryDate,
                $quantity,
                $itemLocId,
                $facturaId,
            ]);

            // Actualizar stock total
            $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?")
               ->execute([$newStock, $productId]);

            // Actualizar stock por ubicación
            adjustProductStock($db, $productId, $itemLocId, $quantity);

            // Registrar movimiento de entrada
            $s = $db->prepare(
                "INSERT INTO stock_movements
                 (product_id, location_id, type, quantity, previous_stock, new_stock,
                  reason, reference, user, user_id)
                 VALUES (?, ?, 'entrada', ?, ?, ?, ?, ?, ?, ?)"
            );
            $s->execute([
                $productId,
                $itemLocId,
                $quantity,
                $prevStock,
                $newStock,
                'Factura ' . $data['invoice_number'] . ($lotNumber ? " – Lote $lotNumber" : ''),
                'FAC-' . $facturaId,
                $auth['username'],
                $auth['id'] ?? 0,
            ]);
        }

        $db->commit();
        getFactura($db, $facturaId);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al guardar factura: ' . $e->getMessage(), 500);
    }
}

function deleteFactura(PDO $db, int $id, array $auth): void {
    $stmt = $db->prepare("SELECT * FROM purchase_invoices WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) jsonError('Factura no encontrada', 404);

    $db->beginTransaction();
    try {
        // Revertir stock de cada lote asociado
        $stmt = $db->prepare(
            "SELECT pl.*, p.stock AS current_stock
             FROM product_lots pl
             JOIN products p ON pl.product_id = p.id
             WHERE pl.invoice_id = ?"
        );
        $stmt->execute([$id]);
        $lotes = $stmt->fetchAll();

        foreach ($lotes as $lote) {
            $newStock = max(0, (int)$lote['current_stock'] - (int)$lote['quantity']);
            $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?")
               ->execute([$newStock, $lote['product_id']]);
            $lotLocId = !empty($lote['location_id']) ? (int)$lote['location_id'] : null;
            adjustProductStock($db, $lote['product_id'], $lotLocId, -(int)$lote['quantity']);
        }

        $db->prepare("DELETE FROM product_lots     WHERE invoice_id = ?")->execute([$id]);
        $db->prepare("DELETE FROM purchase_invoices WHERE id = ?")       ->execute([$id]);

        $db->commit();
        jsonResponse(['message' => 'Factura eliminada y stock revertido']);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al eliminar factura: ' . $e->getMessage(), 500);
    }
}
