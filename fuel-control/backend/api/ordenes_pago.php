<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$action = $_GET['action'] ?? '';

/* ── Cargas sin OP (modal selector) ─────────────────────────── */
if ($method === 'GET' && isset($_GET['unassigned'])) {
    $supplier_id = isset($_GET['supplier_id']) ? (int)$_GET['supplier_id'] : 0;
    $from = $_GET['from'] ?? '';
    $to   = $_GET['to']   ?? '';
    $sql = "
        SELECT f.id, f.fueled_at, f.liters, f.total_cost, f.fuel_type, f.station, f.notes,
               v.name AS vehicle_name, v.plate
        FROM fueling f
        JOIN vehicles v ON v.id = f.vehicle_id
        WHERE f.op_id IS NULL
    ";
    $params = [];
    if ($from) { $sql .= " AND DATE(f.fueled_at) >= ?"; $params[] = $from; }
    if ($to)   { $sql .= " AND DATE(f.fueled_at) <= ?"; $params[] = $to;   }
    $sql .= " ORDER BY f.fueled_at DESC LIMIT 500";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

/* ── Asignar cargas a una OP ─────────────────────────────────── */
if ($method === 'POST' && $action === 'assign') {
    $body    = json_decode(file_get_contents('php://input'), true);
    $op_id   = (int)($body['op_id'] ?? 0);
    $ids     = array_map('intval', $body['fueling_ids'] ?? []);
    if (!$op_id || !$ids) jsonError('op_id y fueling_ids requeridos', 400);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare("UPDATE fueling SET op_id = ? WHERE id IN ($placeholders)");
    $stmt->execute(array_merge([$op_id], $ids));
    jsonResponse(['updated' => $stmt->rowCount()]);
}

/* ── Desasignar cargas de una OP ─────────────────────────────── */
if ($method === 'POST' && $action === 'unassign') {
    $body  = json_decode(file_get_contents('php://input'), true);
    $ids   = array_map('intval', $body['fueling_ids'] ?? []);
    if (!$ids) jsonError('fueling_ids requeridos', 400);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare("UPDATE fueling SET op_id = NULL WHERE id IN ($placeholders)");
    $stmt->execute($ids);
    jsonResponse(['updated' => $stmt->rowCount()]);
}

/* ── GET lista de OPs ────────────────────────────────────────── */
if ($method === 'GET' && !$id) {
    $sql = "
        SELECT op.*, s.name AS supplier_name,
               COUNT(f.id)        AS total_cargas,
               SUM(f.liters)      AS total_litros,
               SUM(f.total_cost)  AS total_monto
        FROM ordenes_pago op
        JOIN suppliers s ON s.id = op.supplier_id
        LEFT JOIN fueling f ON f.op_id = op.id
        GROUP BY op.id, op.numero_op, op.supplier_id, op.fecha, op.estado, op.notas, op.created_by, op.created_at, s.name
        ORDER BY op.created_at DESC
    ";
    jsonResponse($db->query($sql)->fetchAll(PDO::FETCH_ASSOC));
}

/* ── GET una OP con sus cargas ───────────────────────────────── */
if ($method === 'GET' && $id) {
    $stmt = $db->prepare("
        SELECT op.*, s.name AS supplier_name FROM ordenes_pago op
        JOIN suppliers s ON s.id = op.supplier_id WHERE op.id = ?
    ");
    $stmt->execute([$id]);
    $op = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$op) jsonError('No encontrada', 404);

    $stmt2 = $db->prepare("
        SELECT f.id, f.fueled_at, f.liters, f.total_cost, f.fuel_type, f.station, f.notes,
               v.name AS vehicle_name, v.plate
        FROM fueling f JOIN vehicles v ON v.id = f.vehicle_id
        WHERE f.op_id = ? ORDER BY f.fueled_at
    ");
    $stmt2->execute([$id]);
    $op['cargas'] = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse($op);
}

/* ── POST crear OP ───────────────────────────────────────────── */
if ($method === 'POST' && !$action) {
    $body = json_decode(file_get_contents('php://input'), true);
    $stmt = $db->prepare("
        INSERT INTO ordenes_pago (numero_op, supplier_id, fecha, estado, notas, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $body['numero_op']   ?? '',
        (int)($body['supplier_id'] ?? 0),
        $body['fecha']       ?? date('Y-m-d'),
        $body['estado']      ?? 'borrador',
        $body['notas']       ?? '',
        $body['created_by']  ?? '',
    ]);
    jsonResponse(['id' => $db->lastInsertId()], 201);
}

/* ── PUT actualizar OP ───────────────────────────────────────── */
if ($method === 'PUT' && $id) {
    $body = json_decode(file_get_contents('php://input'), true);
    $stmt = $db->prepare("
        UPDATE ordenes_pago SET numero_op=?, supplier_id=?, fecha=?, estado=?, notas=? WHERE id=?
    ");
    $stmt->execute([
        $body['numero_op']   ?? '',
        (int)($body['supplier_id'] ?? 0),
        $body['fecha']       ?? date('Y-m-d'),
        $body['estado']      ?? 'borrador',
        $body['notas']       ?? '',
        $id,
    ]);
    jsonResponse(['ok' => true]);
}

/* ── DELETE OP ───────────────────────────────────────────────── */
if ($method === 'DELETE' && $id) {
    // Desasociar cargas antes de borrar
    $db->prepare("UPDATE fueling SET op_id = NULL WHERE op_id = ?")->execute([$id]);
    $db->prepare("DELETE FROM ordenes_pago WHERE id = ?")->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Acción no válida', 400);
