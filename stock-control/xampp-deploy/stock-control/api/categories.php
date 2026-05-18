<?php
// Endpoint: /api/categories — categorías terapéuticas con campos compatibles con el frontend
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
];

function listCategories(PDO $db): void {
    $stmt = $db->query(
        "SELECT ct.id,
                ct.nombre      AS name,
                ct.descripcion AS description,
                COUNT(m.id_medicamento) AS product_count
         FROM categorias_terapeuticas ct
         LEFT JOIN medicamentos m ON ct.id = m.id_categoria AND m.activo = 1
         GROUP BY ct.id
         ORDER BY ct.nombre"
    );
    jsonResponse($stmt->fetchAll());
}

function createCategory(PDO $db): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("INSERT INTO categorias_terapeuticas (nombre, descripcion) VALUES (?, ?)");
    $stmt->execute([$data['name'], $data['description'] ?? null]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Categoría creada'], 201);
}

function updateCategory(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['name'])) jsonError('El nombre es requerido');
    $stmt = $db->prepare("UPDATE categorias_terapeuticas SET nombre=?, descripcion=? WHERE id=?");
    $stmt->execute([$data['name'], $data['description'] ?? null, $id]);
    jsonResponse(['message' => 'Categoría actualizada']);
}

function deleteCategory(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM medicamentos WHERE id_categoria = ? AND activo = 1");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene medicamentos asociados', 409);
    }
    $stmt = $db->prepare("DELETE FROM categorias_terapeuticas WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Categoría eliminada']);
}
