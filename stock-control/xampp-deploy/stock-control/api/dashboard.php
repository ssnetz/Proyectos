<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db = getDB();

$totalMedicamentos = $db->query(
    "SELECT COUNT(*) FROM medicamentos WHERE activo = 1"
)->fetchColumn();

$lotesbajoStock = $db->query(
    "SELECT COUNT(*) FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1 AND sl.cantidad_existente <= sl.stock_minimo AND sl.cantidad_existente > 0"
)->fetchColumn();

$lotesSinStock = $db->query(
    "SELECT COUNT(*) FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1 AND sl.cantidad_existente = 0"
)->fetchColumn();

$lotesVencidos = $db->query(
    "SELECT COUNT(*) FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1 AND sl.fecha_caducidad < CURDATE()"
)->fetchColumn();

$lotesPorVencer = $db->query(
    "SELECT COUNT(*) FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1 AND sl.fecha_caducidad BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)"
)->fetchColumn();

$refrigeradosActivos = $db->query(
    "SELECT COUNT(*) FROM medicamentos WHERE activo = 1 AND refrigerado = 1"
)->fetchColumn();

$controladosActivos = $db->query(
    "SELECT COUNT(*) FROM medicamentos WHERE activo = 1 AND controlado = 1"
)->fetchColumn();

$totalProveedores = $db->query("SELECT COUNT(*) FROM proveedores")->fetchColumn();

$valorStock = $db->query(
    "SELECT COALESCE(SUM(sl.cantidad_existente * sl.precio_costo), 0)
     FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1"
)->fetchColumn();

$lotesBajoStockDetalle = $db->query(
    "SELECT sl.id_stock, sl.lote, sl.cantidad_existente, sl.stock_minimo, sl.fecha_caducidad,
            m.nombre_comercial, m.nombre_generico, m.refrigerado, m.controlado,
            ct.nombre AS categoria_nombre
     FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     LEFT JOIN categorias_terapeuticas ct ON m.id_categoria = ct.id
     WHERE m.activo = 1 AND sl.cantidad_existente <= sl.stock_minimo
     ORDER BY sl.cantidad_existente ASC
     LIMIT 10"
)->fetchAll();

$proximosCaducidad = $db->query(
    "SELECT sl.id_stock, sl.lote, sl.fecha_caducidad, sl.cantidad_existente, sl.ubicacion,
            m.nombre_comercial, m.nombre_generico, m.refrigerado
     FROM stock_lotes sl
     JOIN medicamentos m ON sl.id_medicamento = m.id_medicamento
     WHERE m.activo = 1
       AND sl.fecha_caducidad BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
       AND sl.cantidad_existente > 0
     ORDER BY sl.fecha_caducidad ASC
     LIMIT 10"
)->fetchAll();

$movimientosRecientes = $db->query(
    "SELECT mv.tipo, mv.cantidad, mv.created_at, mv.motivo,
            m.nombre_comercial, sl.lote
     FROM movimientos_stock mv
     JOIN medicamentos m  ON mv.id_medicamento = m.id_medicamento
     JOIN stock_lotes  sl ON mv.id_stock = sl.id_stock
     ORDER BY mv.created_at DESC
     LIMIT 8"
)->fetchAll();

$movimientosPorDia = $db->query(
    "SELECT DATE(created_at) AS dia,
            SUM(CASE WHEN tipo='entrada' THEN cantidad ELSE 0 END) AS entradas,
            SUM(CASE WHEN tipo='salida'  THEN cantidad ELSE 0 END) AS salidas
     FROM movimientos_stock
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at)
     ORDER BY dia"
)->fetchAll();

jsonResponse([
    'stats' => [
        'total_medicamentos'   => (int)$totalMedicamentos,
        'lotes_bajo_stock'     => (int)$lotesbajoStock,
        'lotes_sin_stock'      => (int)$lotesSinStock,
        'lotes_vencidos'       => (int)$lotesVencidos,
        'lotes_por_vencer'     => (int)$lotesPorVencer,
        'refrigerados_activos' => (int)$refrigeradosActivos,
        'controlados_activos'  => (int)$controladosActivos,
        'total_proveedores'    => (int)$totalProveedores,
        'valor_stock'          => (float)$valorStock,
    ],
    'lotes_bajo_stock'      => $lotesBajoStockDetalle,
    'proximos_caducidad'    => $proximosCaducidad,
    'movimientos_recientes' => $movimientosRecientes,
    'movimientos_por_dia'   => $movimientosPorDia,
]);
