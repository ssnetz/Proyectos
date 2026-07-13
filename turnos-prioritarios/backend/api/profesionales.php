<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getProfesional($db, $id) : listProfesionales($db))),
    'POST'   => (requireAdmin() && createProfesional($db)),
    'PUT'    => (requireAdmin() && ($id ? updateProfesional($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteProfesional($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function listProfesionales(PDO $db): void {
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $stmt = $db->prepare(
            "SELECT * FROM profesionales
             WHERE apellidos LIKE ? OR nombres LIKE ? OR matricula LIKE ? OR especialidad LIKE ?
             ORDER BY apellidos, nombres"
        );
        $like = "%$q%";
        $stmt->execute([$like, $like, $like, $like]);
    } else {
        $stmt = $db->query("SELECT * FROM profesionales ORDER BY apellidos, nombres");
    }
    jsonResponse($stmt->fetchAll());
}

function getProfesional(PDO $db, int $id): void {
    $stmt = $db->prepare("SELECT * FROM profesionales WHERE id = ?");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Profesional no encontrado', 404);
    jsonResponse($p);
}

function createProfesional(PDO $db): void {
    $data = getBody();
    if (empty($data['apellidos'])) jsonError('Los apellidos son requeridos');
    if (empty($data['nombres'])) jsonError('Los nombres son requeridos');
    if (empty($data['matricula'])) jsonError('La matrícula es requerida');

    try {
        $stmt = $db->prepare(
            "INSERT INTO profesionales (apellidos, nombres, matricula, especialidad, domicilio, celular)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['apellidos'],
            $data['nombres'],
            $data['matricula'],
            $data['especialidad'] ?? null,
            $data['domicilio'] ?? null,
            $data['celular'] ?? null,
        ]);
        jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Profesional creado'], 201);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('La matrícula ya existe', 409);
        jsonError('Error al crear profesional: ' . $e->getMessage(), 500);
    }
}

function updateProfesional(PDO $db, int $id): void {
    $data = getBody();
    if (empty($data['apellidos'])) jsonError('Los apellidos son requeridos');
    if (empty($data['nombres'])) jsonError('Los nombres son requeridos');
    if (empty($data['matricula'])) jsonError('La matrícula es requerida');

    $activo = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    try {
        $stmt = $db->prepare(
            "UPDATE profesionales SET apellidos=?, nombres=?, matricula=?, especialidad=?, domicilio=?, celular=?, activo=?, updated_at=NOW()
             WHERE id=?"
        );
        $stmt->execute([
            $data['apellidos'],
            $data['nombres'],
            $data['matricula'],
            $data['especialidad'] ?? null,
            $data['domicilio'] ?? null,
            $data['celular'] ?? null,
            $activo,
            $id,
        ]);
        jsonResponse(['message' => 'Profesional actualizado']);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') jsonError('La matrícula ya existe', 409);
        jsonError('Error al actualizar profesional: ' . $e->getMessage(), 500);
    }
}

function deleteProfesional(PDO $db, int $id): void {
    $check = $db->prepare("SELECT COUNT(*) FROM turnos_prioritarios WHERE profesional_id = ? AND estado IN ('pendiente','confirmado')");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: tiene turnos pendientes o confirmados', 409);
    }
    $stmt = $db->prepare("DELETE FROM profesionales WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Profesional eliminado']);
}
