<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db   = getDB();
$type = $_GET['type'] ?? '';

try {
    switch ($type) {
        case 'stock_consolidado': reportStockConsolidado($db); break;
        case 'stock_por_sector':  reportStockPorSector($db);   break;
        case 'stock_bajo':        reportStockBajo($db);        break;
        case 'movimientos':       reportMovimientos($db);      break;
        case 'proximos_a_vencer': reportProximosAVencer($db); break;
        default: jsonError('Tipo de reporte inválido', 400);
    }
} catch (Exception $e) {
    jsonError('Error en reporte: ' . $e->getMessage(), 500);
}

// ── 1. Stock consolidado ──────────────────────────────────────────────────────
function reportStockConsolidado(PDO $db): void {
    $locationId = $_GET['location_id'] ?? '';
    $categoryId = $_GET['category_id'] ?? '';

    if ($locationId) {
        $sql = "SELECT p.code, p.name, c.name AS categoria, p.unit AS unidad,
                       COALESCE(ps.quantity, 0) AS stock_total, p.min_stock
                FROM products p
                LEFT JOIN categories    c  ON p.category_id  = c.id
                LEFT JOIN product_stock ps ON p.id = ps.product_id AND ps.location_id = ?
                WHERE p.active = 1";
        $params = [$locationId];
    } else {
        $sql = "SELECT p.code, p.name, c.name AS categoria, p.unit AS unidad,
                       COALESCE(SUM(ps.quantity), 0) AS stock_total, p.min_stock
                FROM products p
                LEFT JOIN categories    c  ON p.category_id  = c.id
                LEFT JOIN product_stock ps ON p.id = ps.product_id
                WHERE p.active = 1";
        $params = [];
    }

    if ($categoryId) {
        $sql .= " AND p.category_id = ?";
        $params[] = $categoryId;
    }

    if ($locationId) {
        $sql .= " ORDER BY c.name, p.name";
    } else {
        $sql .= " GROUP BY p.id, p.code, p.name, p.unit, p.min_stock, c.name
                  ORDER BY c.name, p.name";
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    // Metadatos para el título del PDF
    $locationName = '';
    if ($locationId) {
        $s = $db->prepare("SELECT name FROM locations WHERE id = ?");
        $s->execute([$locationId]);
        $locationName = $s->fetchColumn() ?: '';
    }

    jsonResponse([
        'title'       => 'Stock Consolidado' . ($locationName ? " — $locationName" : ' — Todas las ubicaciones'),
        'generated'   => date('d/m/Y H:i'),
        'columns'     => ['Código', 'Medicamento / Insumo', 'Categoría', 'Unidad', 'Stock', 'Mínimo'],
        'rows'        => $stmt->fetchAll(PDO::FETCH_NUM),
    ]);
}

// ── 2. Stock por sector ───────────────────────────────────────────────────────
function reportStockPorSector(PDO $db): void {
    $categoryId = $_GET['category_id'] ?? '';

    $sql = "SELECT p.code, p.name, c.name AS categoria,
                   l.name AS sector, ps.quantity AS stock, ps.min_stock
            FROM product_stock ps
            JOIN products  p  ON ps.product_id  = p.id
            JOIN locations l  ON ps.location_id = l.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.active = 1 AND l.active = 1";
    $params = [];

    if ($categoryId) {
        $sql .= " AND p.category_id = ?";
        $params[] = $categoryId;
    }

    $sql .= " ORDER BY l.name, c.name, p.name";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    jsonResponse([
        'title'     => 'Stock por Sector',
        'generated' => date('d/m/Y H:i'),
        'columns'   => ['Código', 'Medicamento / Insumo', 'Categoría', 'Sector', 'Stock', 'Mínimo'],
        'rows'      => $stmt->fetchAll(PDO::FETCH_NUM),
    ]);
}

// ── 3. Stock bajo ─────────────────────────────────────────────────────────────
function reportStockBajo(PDO $db): void {
    $rows = $db->query(
        "SELECT p.code, p.name, c.name AS categoria,
                COALESCE(SUM(ps.quantity), 0) AS stock_total, p.min_stock,
                CASE WHEN COALESCE(SUM(ps.quantity),0) = 0 THEN 'Sin stock' ELSE 'Stock bajo' END AS estado
         FROM products p
         LEFT JOIN categories    c  ON p.category_id = c.id
         LEFT JOIN product_stock ps ON p.id = ps.product_id
         WHERE p.active = 1
         GROUP BY p.id, p.code, p.name, p.min_stock, c.name
         HAVING COALESCE(SUM(ps.quantity), 0) <= p.min_stock
         ORDER BY stock_total ASC, p.name"
    )->fetchAll(PDO::FETCH_NUM);

    jsonResponse([
        'title'     => 'Medicamentos con Stock Bajo',
        'generated' => date('d/m/Y H:i'),
        'columns'   => ['Código', 'Medicamento / Insumo', 'Categoría', 'Stock total', 'Mínimo', 'Estado'],
        'rows'      => $rows,
    ]);
}

// ── 4. Historial de movimientos ───────────────────────────────────────────────
function reportMovimientos(PDO $db): void {
    $from       = $_GET['from']        ?? date('Y-m-01');
    $to         = $_GET['to']          ?? date('Y-m-d');
    $locationId = $_GET['location_id'] ?? '';

    $sql = "SELECT DATE_FORMAT(m.created_at,'%d/%m/%Y %H:%i') AS fecha,
                   p.code, p.name AS medicamento,
                   m.type AS tipo, m.quantity AS cantidad,
                   m.previous_stock AS anterior, m.new_stock AS nuevo,
                   COALESCE(lf.name,'—') AS origen,
                   COALESCE(lt.name,'—') AS destino,
                   m.reason AS motivo, m.user AS usuario
            FROM stock_movements m
            JOIN products  p  ON m.product_id  = p.id
            LEFT JOIN locations lf ON m.location_id    = lf.id
            LEFT JOIN locations lt ON m.to_location_id = lt.id
            WHERE DATE(m.created_at) BETWEEN ? AND ?";
    $params = [$from, $to];

    if ($locationId) {
        $sql .= " AND (m.location_id = ? OR m.to_location_id = ?)";
        $params[] = $locationId;
        $params[] = $locationId;
    }

    $sql .= " ORDER BY m.created_at DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $fromFmt = date('d/m/Y', strtotime($from));
    $toFmt   = date('d/m/Y', strtotime($to));

    jsonResponse([
        'title'     => "Movimientos del $fromFmt al $toFmt",
        'generated' => date('d/m/Y H:i'),
        'columns'   => ['Fecha', 'Código', 'Medicamento', 'Tipo', 'Cant.', 'Anterior', 'Nuevo', 'Origen', 'Destino', 'Motivo', 'Usuario'],
        'rows'      => $stmt->fetchAll(PDO::FETCH_NUM),
    ]);
}

// ── 5. Próximos a vencer ──────────────────────────────────────────────────────
function reportProximosAVencer(PDO $db): void {
    $from       = $_GET['from']        ?? date('Y-m-d');
    $to         = $_GET['to']          ?? date('Y-m-d', strtotime('+90 days'));
    $locationId = $_GET['location_id'] ?? '';
    $categoryId = $_GET['category_id'] ?? '';

    $sql = "SELECT p.code, p.name, c.name AS categoria,
                   l.name AS ubicacion,
                   pl.lot_number AS lote,
                   DATE_FORMAT(pl.expiration_date,'%d/%m/%Y') AS vencimiento,
                   pl.quantity AS cantidad,
                   DATEDIFF(pl.expiration_date, CURDATE()) AS dias_restantes
            FROM product_lots pl
            JOIN products  p ON pl.product_id  = p.id
            JOIN locations l ON pl.location_id = l.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.active = 1 AND l.active = 1
              AND pl.quantity > 0
              AND pl.expiration_date BETWEEN ? AND ?";
    $params = [$from, $to];

    if ($locationId) {
        $sql .= " AND pl.location_id = ?";
        $params[] = $locationId;
    }
    if ($categoryId) {
        $sql .= " AND p.category_id = ?";
        $params[] = $categoryId;
    }

    $sql .= " ORDER BY pl.expiration_date ASC, p.name";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $fromFmt = date('d/m/Y', strtotime($from));
    $toFmt   = date('d/m/Y', strtotime($to));

    jsonResponse([
        'title'     => "Medicamentos próximos a vencer: $fromFmt – $toFmt",
        'generated' => date('d/m/Y H:i'),
        'columns'   => ['Código', 'Medicamento', 'Categoría', 'Ubicación', 'Lote', 'Vencimiento', 'Cant.', 'Días restantes'],
        'rows'      => $stmt->fetchAll(PDO::FETCH_NUM),
    ]);
}
