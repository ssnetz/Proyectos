<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db     = getDB();
$method = getMethod();
$id     = getId();

match ($method) {
    'GET'    => (requireAuth() && listCategorias($db)),
    'POST'   => (requireAdmin() && createCategoria($db)),
    'PUT'    => (requireAdmin() && ($id ? updateCategoria($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteCategoria($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listCategorias(PDO $db): void {
    try {
        $stmt = $db->query(
            "SELECT c.*, COUNT(p.id) AS product_count
             FROM categories c
             LEFT JOIN products p ON c.id = p.category_id AND p.active = 1
             GROUP BY c.id ORDER BY c.name"
        );
        jsonResponse($stmt->fetchAll());
    } catch (Exception $e) {
        jsonError('Error al listar categorías: ' . $e->getMessage(), 500);
    }
}

function createCategoria(PDO $db): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
    $stmt->execute([trim($data['name']), $data['description'] ?? null]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Categoría creada'], 201);
}

function updateCategoria(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("UPDATE categories SET name=?, description=? WHERE id=?");
    $stmt->execute([trim($data['name']), $data['description'] ?? null, $id]);
    jsonResponse(['message' => 'Categoría actualizada']);
}

function deleteCategoria(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM products WHERE category_id = ? AND active = 1");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene medicamentos asociados', 409);
    }
    $stmt = $db->prepare("DELETE FROM categories WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Categoría eliminada']);
}
