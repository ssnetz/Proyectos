<?php
// Endpoint: /api/products — catálogo de medicamentos con campos compatibles con el frontend
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getProduct($db, $id) : listProducts($db))),
    'POST'   => (requireAdmin() && createProduct($db)),
    'PUT'    => (requireAdmin() && ($id ? updateProduct($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteProduct($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listProducts(PDO $db): void {
    $search   = $_GET['search']   ?? '';
    $category = $_GET['category'] ?? '';
    $lowStock = isset($_GET['low_stock']);

    // Devuelve campos con los nombres del frontend original
    $sql = "SELECT
                m.id_medicamento                                    AS id,
                CONCAT('MED-', LPAD(m.id_medicamento, 3, '0'))     AS code,
                m.nombre_comercial                                  AS name,
                m.nombre_generico                                   AS description,
                m.presentacion                                      AS unit,
                m.id_categoria                                      AS category_id,
                ct.nombre                                           AS category_name,
                m.activo                                            AS active,
                m.controlado, m.refrigerado, m.fraccionable,
                -- Datos del lote más reciente (para precios y proveedor)
                sl_last.id_proveedor                                AS supplier_id,
                p.razon_social                                      AS supplier_name,
                COALESCE(sl_last.precio_costo, 0)                   AS purchase_price,
                COALESCE(sl_last.precio_venta, 0)                   AS sale_price,
                -- Stock y stock_minimo agregados de todos los lotes
                COALESCE(SUM(sl.cantidad_existente), 0)             AS stock,
                COALESCE(MIN(sl.stock_minimo), 5)                   AS min_stock,
                m.created_at, m.updated_at
            FROM medicamentos m
            LEFT JOIN categorias_terapeuticas ct ON m.id_categoria = ct.id
            LEFT JOIN stock_lotes sl ON m.id_medicamento = sl.id_medicamento
            LEFT JOIN (
                SELECT id_medicamento, id_proveedor, precio_costo, precio_venta
                FROM stock_lotes
                WHERE id_stock IN (
                    SELECT MAX(id_stock) FROM stock_lotes GROUP BY id_medicamento
                )
            ) sl_last ON m.id_medicamento = sl_last.id_medicamento
            LEFT JOIN proveedores p ON sl_last.id_proveedor = p.id_proveedor
            WHERE m.activo = 1";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (m.nombre_comercial LIKE ? OR m.nombre_generico LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    if ($category !== '') {
        $sql .= " AND m.id_categoria = ?";
        $params[] = $category;
    }

    $sql .= " GROUP BY m.id_medicamento, sl_last.id_proveedor, sl_last.precio_costo, sl_last.precio_venta, p.razon_social";

    if ($lowStock) {
        $sql .= " HAVING stock <= min_stock";
    }

    $sql .= " ORDER BY m.nombre_comercial";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getProduct(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT
             m.id_medicamento                                AS id,
             CONCAT('MED-', LPAD(m.id_medicamento, 3, '0')) AS code,
             m.nombre_comercial                              AS name,
             m.nombre_generico                               AS description,
             m.presentacion                                  AS unit,
             m.id_categoria                                  AS category_id,
             ct.nombre                                       AS category_name,
             m.activo                                        AS active,
             m.controlado, m.refrigerado, m.fraccionable,
             sl_last.id_proveedor                            AS supplier_id,
             p.razon_social                                  AS supplier_name,
             COALESCE(sl_last.precio_costo, 0)               AS purchase_price,
             COALESCE(sl_last.precio_venta, 0)               AS sale_price,
             COALESCE((SELECT SUM(sl2.cantidad_existente) FROM stock_lotes sl2 WHERE sl2.id_medicamento = m.id_medicamento), 0) AS stock,
             COALESCE((SELECT MIN(sl3.stock_minimo)       FROM stock_lotes sl3 WHERE sl3.id_medicamento = m.id_medicamento), 5)  AS min_stock
         FROM medicamentos m
         LEFT JOIN categorias_terapeuticas ct ON m.id_categoria = ct.id
         LEFT JOIN (
             SELECT id_medicamento, id_proveedor, precio_costo, precio_venta
             FROM stock_lotes WHERE id_stock IN (
                 SELECT MAX(id_stock) FROM stock_lotes GROUP BY id_medicamento
             )
         ) sl_last ON m.id_medicamento = sl_last.id_medicamento
         LEFT JOIN proveedores p ON sl_last.id_proveedor = p.id_proveedor
         WHERE m.id_medicamento = ?"
    );
    $stmt->execute([$id]);
    $product = $stmt->fetch();
    if (!$product) jsonError('Medicamento no encontrado', 404);
    jsonResponse($product);
}

function createProduct(PDO $db): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');

    $db->beginTransaction();
    try {
        // 1. Crear medicamento en el catálogo
        $stmt = $db->prepare(
            "INSERT INTO medicamentos (nombre_comercial, nombre_generico, presentacion, id_categoria,
              controlado, refrigerado, fraccionable)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['name'],
            $data['description'] ?? $data['name'],
            $data['unit']        ?? null,
            $data['category_id'] ?? null,
            (int)($data['controlado']   ?? 0),
            (int)($data['refrigerado']  ?? 0),
            (int)($data['fraccionable'] ?? 0),
        ]);
        $idMed = (int)$db->lastInsertId();

        // 2. Crear lote inicial de stock
        $stockInicial = (int)($data['stock'] ?? 0);
        $stmt = $db->prepare(
            "INSERT INTO stock_lotes
             (id_medicamento, id_proveedor, lote, fecha_caducidad,
              cantidad_existente, stock_minimo, precio_costo, precio_venta, fecha_ultima_compra)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())"
        );
        $stmt->execute([
            $idMed,
            $data['supplier_id']    ?? null,
            'INICIAL',
            '2099-12-31',
            $stockInicial,
            (int)($data['min_stock']      ?? 5),
            (float)($data['purchase_price'] ?? 0),
            (float)($data['sale_price']     ?? 0),
        ]);
        $idStock = (int)$db->lastInsertId();

        // 3. Registrar movimiento si hay stock inicial
        if ($stockInicial > 0) {
            $stmt = $db->prepare(
                "INSERT INTO movimientos_stock
                 (id_stock, id_medicamento, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
                 VALUES (?, ?, 'entrada', ?, 0, ?, 'Stock inicial')"
            );
            $stmt->execute([$idStock, $idMed, $stockInicial, $stockInicial]);
        }

        $db->commit();
        jsonResponse(['id' => $idMed, 'message' => 'Medicamento creado'], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al crear: ' . $e->getMessage(), 500);
    }
}

function updateProduct(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');

    $db->beginTransaction();
    try {
        // Actualizar catálogo
        $stmt = $db->prepare(
            "UPDATE medicamentos SET
             nombre_comercial=?, nombre_generico=?, presentacion=?, id_categoria=?,
             updated_at=NOW()
             WHERE id_medicamento=?"
        );
        $stmt->execute([
            $data['name'],
            $data['description'] ?? $data['name'],
            $data['unit']        ?? null,
            $data['category_id'] ?? null,
            $id,
        ]);

        // Actualizar precios y proveedor en el lote más reciente
        $stmt = $db->prepare(
            "UPDATE stock_lotes SET
             id_proveedor=?, precio_costo=?, precio_venta=?, stock_minimo=?, updated_at=NOW()
             WHERE id_medicamento=?
             ORDER BY id_stock DESC LIMIT 1"
        );
        $stmt->execute([
            $data['supplier_id']    ?? null,
            (float)($data['purchase_price'] ?? 0),
            (float)($data['sale_price']     ?? 0),
            (int)($data['min_stock']        ?? 5),
            $id,
        ]);

        $db->commit();
        jsonResponse(['message' => 'Medicamento actualizado']);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Error al actualizar: ' . $e->getMessage(), 500);
    }
}

function deleteProduct(PDO $db, int $id): void {
    $stmt = $db->prepare("UPDATE medicamentos SET activo = 0 WHERE id_medicamento = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Medicamento desactivado']);
}
