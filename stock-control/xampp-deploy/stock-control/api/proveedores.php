<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match ($method) {
    'GET'    => (requireAuth() && ($id ? getProveedor($db, $id) : listProveedores($db))),
    'POST'   => (requireAdmin() && createProveedor($db)),
    'PUT'    => (requireAdmin() && ($id ? updateProveedor($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteProveedor($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listProveedores(PDO $db): void {
    $stmt = $db->query(
        "SELECT s.*, COUNT(p.id) AS product_count
         FROM suppliers s
         LEFT JOIN products p ON s.id = p.supplier_id AND p.active = 1
         GROUP BY s.id ORDER BY s.name"
    );
    jsonResponse($stmt->fetchAll());
}

function getProveedor(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM suppliers WHERE id = ?");
    $stmt->execute([$id]);
    $s = $stmt->fetch();
    if (!$s) jsonError('Proveedor no encontrado', 404);
    jsonResponse($s);
}

function createProveedor(PDO $db): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare(
        "INSERT INTO suppliers (name, contact, email, phone, address) VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        trim($data['name']),
        $data['contact'] ?? null,
        $data['email']   ?? null,
        $data['phone']   ?? null,
        $data['address'] ?? null,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Proveedor creado'], 201);
}

function updateProveedor(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare(
        "UPDATE suppliers SET name=?, contact=?, email=?, phone=?, address=?, updated_at=NOW() WHERE id=?"
    );
    $stmt->execute([
        trim($data['name']),
        $data['contact'] ?? null,
        $data['email']   ?? null,
        $data['phone']   ?? null,
        $data['address'] ?? null,
        $id,
    ]);
    jsonResponse(['message' => 'Proveedor actualizado']);
}

function deleteProveedor(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM products WHERE supplier_id = ? AND active = 1");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene medicamentos asociados', 409);
    }
    $stmt = $db->prepare("DELETE FROM suppliers WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Proveedor eliminado']);
}
