<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();

match($method) {
    'GET'    => (requireAuth() && ($id ? getCandidato($db, $id) : listCandidatos($db))),
    'POST'   => (requireAdmin() && createCandidato($db)),
    'PUT'    => (requireAdmin() && ($id ? updateCandidato($db, $id) : jsonError('ID requerido', 400))),
    'DELETE' => (requireAdmin() && ($id ? deleteCandidato($db, $id) : jsonError('ID requerido', 400))),
    default  => jsonError('Método no permitido', 405),
};

function baseSelect(): string {
    return "SELECT ca.*, l.numero AS lista_numero, l.nombre AS lista_nombre,
                   p.nombre AS partido_nombre, c.nombre AS cargo_nombre
            FROM candidatos ca
            JOIN listas l ON ca.lista_id = l.id
            JOIN partidos p ON l.partido_id = p.id
            JOIN cargos c ON l.cargo_id = c.id";
}

function listCandidatos(PDO $db): void {
    $where = [];
    $params = [];
    if (!empty($_GET['lista_id'])) {
        $where[] = 'ca.lista_id = ?';
        $params[] = (int)$_GET['lista_id'];
    }
    $sql = baseSelect();
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY l.numero, ca.orden';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getCandidato(PDO $db, int $id): void {
    $stmt = $db->prepare(baseSelect() . ' WHERE ca.id = ?');
    $stmt->execute([$id]);
    $c = $stmt->fetch();
    if (!$c) jsonError('Candidato no encontrado', 404);
    jsonResponse($c);
}

function createCandidato(PDO $db): void {
    $data = getBody();
    foreach (['lista_id', 'orden', 'apellidos', 'nombres'] as $field) {
        if (empty($data[$field]) && $data[$field] !== '0') jsonError("El campo $field es requerido");
    }

    $stmt = $db->prepare(
        "INSERT INTO candidatos (lista_id, orden, apellidos, nombres, documento, titular) VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        (int)$data['lista_id'],
        (int)$data['orden'],
        $data['apellidos'],
        $data['nombres'],
        $data['documento'] ?? null,
        isset($data['titular']) ? (int)(bool)$data['titular'] : 1,
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId(), 'message' => 'Candidato creado'], 201);
}

function updateCandidato(PDO $db, int $id): void {
    $data = getBody();
    foreach (['lista_id', 'orden', 'apellidos', 'nombres'] as $field) {
        if (empty($data[$field]) && $data[$field] !== '0') jsonError("El campo $field es requerido");
    }

    $stmt = $db->prepare(
        "UPDATE candidatos SET lista_id=?, orden=?, apellidos=?, nombres=?, documento=?, titular=?, updated_at=NOW() WHERE id=?"
    );
    $stmt->execute([
        (int)$data['lista_id'],
        (int)$data['orden'],
        $data['apellidos'],
        $data['nombres'],
        $data['documento'] ?? null,
        isset($data['titular']) ? (int)(bool)$data['titular'] : 1,
        $id,
    ]);
    jsonResponse(['message' => 'Candidato actualizado']);
}

function deleteCandidato(PDO $db, int $id): void {
    $stmt = $db->prepare("DELETE FROM candidatos WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Candidato eliminado']);
}
