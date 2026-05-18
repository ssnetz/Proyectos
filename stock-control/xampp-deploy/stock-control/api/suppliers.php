<?php
// Endpoint: /api/suppliers — gestiona proveedores (droguerías / distribuidoras)
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getProveedor($db, $id) : listProveedores($db))),
    'POST'   => (requireAdmin() && createProveedor($db)),
    'PUT'    => (requireAdmin() && ($id ? updateProveedor($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteProveedor($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listProveedores(PDO $db): void {
    $stmt = $db->query(
        "SELECT p.*, COUNT(DISTINCT sl.id_medicamento) AS medicamentos_asociados
         FROM proveedores p
         LEFT JOIN stock_lotes sl ON p.id_proveedor = sl.id_proveedor
         GROUP BY p.id_proveedor
         ORDER BY p.razon_social"
    );
    jsonResponse($stmt->fetchAll());
}

function getProveedor(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM proveedores WHERE id_proveedor = ?");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Proveedor no encontrado', 404);
    jsonResponse($p);
}

function createProveedor(PDO $db): void {
    $data = getBody();
    if (empty($data['razon_social'])) jsonError('La razón social es requerida');

    $stmt = $db->prepare(
        "INSERT INTO proveedores (razon_social, contacto, email, telefono, direccion)
         VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $data['razon_social'],
        $data['contacto']  ?? null,
        $data['email']     ?? null,
        $data['telefono']  ?? null,
        $data['direccion'] ?? null,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Proveedor creado'], 201);
}

function updateProveedor(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['razon_social'])) jsonError('La razón social es requerida');

    $stmt = $db->prepare(
        "UPDATE proveedores SET razon_social=?, contacto=?, email=?, telefono=?, direccion=?, updated_at=NOW()
         WHERE id_proveedor=?"
    );
    $stmt->execute([
        $data['razon_social'],
        $data['contacto']  ?? null,
        $data['email']     ?? null,
        $data['telefono']  ?? null,
        $data['direccion'] ?? null,
        $id,
    ]);
    jsonResponse(['message' => 'Proveedor actualizado']);
}

function deleteProveedor(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM stock_lotes WHERE id_proveedor = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene lotes de stock asociados', 409);
    }
    $stmt = $db->prepare("DELETE FROM proveedores WHERE id_proveedor = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Proveedor eliminado']);
}
