<?php
// Endpoint: /api/suppliers — proveedores con campos compatibles con el frontend
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getSupplier($db, $id) : listSuppliers($db))),
    'POST'   => (requireAdmin() && createSupplier($db)),
    'PUT'    => (requireAdmin() && ($id ? updateSupplier($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteSupplier($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listSuppliers(PDO $db): void {
    $stmt = $db->query(
        "SELECT
             p.id_proveedor                        AS id,
             p.razon_social                        AS name,
             p.contacto                            AS contact,
             p.email,
             p.telefono                            AS phone,
             p.direccion                           AS address,
             p.created_at, p.updated_at,
             COUNT(DISTINCT sl.id_medicamento)     AS product_count
         FROM proveedores p
         LEFT JOIN stock_lotes sl ON p.id_proveedor = sl.id_proveedor
         GROUP BY p.id_proveedor
         ORDER BY p.razon_social"
    );
    jsonResponse($stmt->fetchAll());
}

function getSupplier(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT id_proveedor AS id, razon_social AS name, contacto AS contact,
                email, telefono AS phone, direccion AS address
         FROM proveedores WHERE id_proveedor = ?"
    );
    $stmt->execute([$id]);
    $s = $stmt->fetch();
    if (!$s) jsonError('Proveedor no encontrado', 404);
    jsonResponse($s);
}

function createSupplier(PDO $db): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');

    $stmt = $db->prepare(
        "INSERT INTO proveedores (razon_social, contacto, email, telefono, direccion)
         VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $data['name'],
        $data['contact']  ?? null,
        $data['email']    ?? null,
        $data['phone']    ?? null,
        $data['address']  ?? null,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Proveedor creado'], 201);
}

function updateSupplier(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');

    $stmt = $db->prepare(
        "UPDATE proveedores SET razon_social=?, contacto=?, email=?, telefono=?, direccion=?, updated_at=NOW()
         WHERE id_proveedor=?"
    );
    $stmt->execute([
        $data['name'],
        $data['contact']  ?? null,
        $data['email']    ?? null,
        $data['phone']    ?? null,
        $data['address']  ?? null,
        $id,
    ]);
    jsonResponse(['message' => 'Proveedor actualizado']);
}

function deleteSupplier(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM stock_lotes WHERE id_proveedor = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene lotes de stock asociados', 409);
    }
    $stmt = $db->prepare("DELETE FROM proveedores WHERE id_proveedor = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Proveedor eliminado']);
}
