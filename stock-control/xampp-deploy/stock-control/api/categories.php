<?php
// Endpoint: /api/categories — gestiona categorías terapéuticas
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && listCategorias($db)),
    'POST'   => (requireAdmin() && createCategoria($db)),
    'PUT'    => (requireAdmin() && ($id ? updateCategoria($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteCategoria($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listCategorias(PDO $db): void {
    $stmt = $db->query(
        "SELECT ct.*, COUNT(m.id_medicamento) AS medicamentos_count
         FROM categorias_terapeuticas ct
         LEFT JOIN medicamentos m ON ct.id = m.id_categoria AND m.activo = 1
         GROUP BY ct.id
         ORDER BY ct.nombre"
    );
    jsonResponse($stmt->fetchAll());
}

function createCategoria(PDO $db): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("INSERT INTO categorias_terapeuticas (nombre, descripcion) VALUES (?, ?)");
    $stmt->execute([$data['nombre'], $data['descripcion'] ?? null]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Categoría creada'], 201);
}

function updateCategoria(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['nombre'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("UPDATE categorias_terapeuticas SET nombre=?, descripcion=? WHERE id=?");
    $stmt->execute([$data['nombre'], $data['descripcion'] ?? null, $id]);
    jsonResponse(['message' => 'Categoría actualizada']);
}

function deleteCategoria(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM medicamentos WHERE id_categoria = ? AND activo = 1");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene medicamentos asociados', 409);
    }
    $stmt = $db->prepare("DELETE FROM categorias_terapeuticas WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Categoría eliminada']);
}
