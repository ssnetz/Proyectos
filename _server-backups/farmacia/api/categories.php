<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && listCategories($db)),
    'POST'   => (requireAdmin() && createCategory($db)),
    'PUT'    => (requireAdmin() && ($id ? updateCategory($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteCategory($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listCategories(PDO $db): void {
    $stmt = $db->query(
        "SELECT c.*, COUNT(p.id) AS product_count
         FROM categories c
         LEFT JOIN products p ON c.id = p.category_id AND p.active = 1
         GROUP BY c.id ORDER BY c.name"
    );
    jsonResponse($stmt->fetchAll());
}

function createCategory(PDO $db): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
    $stmt->execute([$data['name'], $data['description'] ?? null]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Categoría creada'], 201);
}

function updateCategory(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("UPDATE categories SET name=?, description=? WHERE id=?");
    $stmt->execute([$data['name'], $data['description'] ?? null, $id]);
    jsonResponse(['message' => 'Categoría actualizada']);
}

function deleteCategory(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM products WHERE category_id = ? AND active = 1");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene productos asociados', 409);
    }
    $stmt = $db->prepare("DELETE FROM categories WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Categoría eliminada']);
}
