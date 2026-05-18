<?php
// Endpoint: /api/products — gestiona el catálogo de medicamentos
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getMedicamento($db, $id) : listMedicamentos($db))),
    'POST'   => (requireAdmin() && createMedicamento($db)),
    'PUT'    => (requireAdmin() && ($id ? updateMedicamento($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteMedicamento($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listMedicamentos(PDO $db): void {
    $search   = $_GET['search']   ?? '';
    $category = $_GET['category'] ?? '';
    $lowStock = isset($_GET['low_stock']);
    $controlado  = $_GET['controlado']  ?? '';
    $refrigerado = $_GET['refrigerado'] ?? '';

    $sql = "SELECT m.*,
                   ct.nombre AS categoria_nombre,
                   COALESCE(SUM(sl.cantidad_existente), 0)       AS stock_total,
                   MIN(sl.fecha_caducidad)                        AS proxima_caducidad,
                   MIN(sl.precio_venta)                           AS precio_venta
            FROM medicamentos m
            LEFT JOIN categorias_terapeuticas ct ON m.id_categoria = ct.id
            LEFT JOIN stock_lotes sl ON m.id_medicamento = sl.id_medicamento
            WHERE m.activo = 1";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (m.nombre_comercial LIKE ? OR m.nombre_generico LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    if ($category !== '') {
        $sql .= " AND m.id_categoria = ?";
        $params[] = $category;
    }
    if ($controlado !== '') {
        $sql .= " AND m.controlado = ?";
        $params[] = (int)$controlado;
    }
    if ($refrigerado !== '') {
        $sql .= " AND m.refrigerado = ?";
        $params[] = (int)$refrigerado;
    }

    $sql .= " GROUP BY m.id_medicamento";

    if ($lowStock) {
        $sql .= " HAVING stock_total <= (SELECT MIN(stock_minimo) FROM stock_lotes WHERE id_medicamento = m.id_medicamento)";
    }

    $sql .= " ORDER BY m.nombre_comercial";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getMedicamento(PDO $db, int $id): void {
    $stmt = $db->prepare(
        "SELECT m.*, ct.nombre AS categoria_nombre
         FROM medicamentos m
         LEFT JOIN categorias_terapeuticas ct ON m.id_categoria = ct.id
         WHERE m.id_medicamento = ?"
    );
    $stmt->execute([$id]);
    $med = $stmt->fetch();
    if (!$med) jsonError('Medicamento no encontrado', 404);
    jsonResponse($med);
}

function createMedicamento(PDO $db): void {
    $data = getBody();
    $required = ['nombre_comercial', 'nombre_generico'];
    foreach ($required as $field) {
        if (empty($data[$field])) jsonError("Campo requerido: $field");
    }

    $stmt = $db->prepare(
        "INSERT INTO medicamentos
         (nombre_comercial, nombre_generico, presentacion, laboratorio, id_categoria,
          controlado, refrigerado, fraccionable)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $data['nombre_comercial'],
        $data['nombre_generico'],
        $data['presentacion']  ?? null,
        $data['laboratorio']   ?? null,
        $data['id_categoria']  ?? null,
        (int)($data['controlado']  ?? 0),
        (int)($data['refrigerado'] ?? 0),
        (int)($data['fraccionable'] ?? 0),
    ]);

    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Medicamento creado'], 201);
}

function updateMedicamento(PDO $db, int $id): void {
    $data = getBody();
    $stmt = $db->prepare(
        "UPDATE medicamentos SET
         nombre_comercial=?, nombre_generico=?, presentacion=?, laboratorio=?,
         id_categoria=?, controlado=?, refrigerado=?, fraccionable=?, updated_at=NOW()
         WHERE id_medicamento=?"
    );
    $stmt->execute([
        $data['nombre_comercial'],
        $data['nombre_generico'],
        $data['presentacion']  ?? null,
        $data['laboratorio']   ?? null,
        $data['id_categoria']  ?? null,
        (int)($data['controlado']  ?? 0),
        (int)($data['refrigerado'] ?? 0),
        (int)($data['fraccionable'] ?? 0),
        $id,
    ]);
    jsonResponse(['message' => 'Medicamento actualizado']);
}

function deleteMedicamento(PDO $db, int $id): void {
    $stmt = $db->prepare("UPDATE medicamentos SET activo = 0 WHERE id_medicamento = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Medicamento desactivado']);
}
