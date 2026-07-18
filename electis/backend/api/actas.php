<?php
// Actas de escrutinio por mesa. Versión inicial simple: un acta guarda los
// totales (votantes, blancos, nulos, recurridos, impugnados) y el detalle
// de votos por lista en `acta_votos`. Como `actas.mesa_id` es UNIQUE, volver
// a guardar el acta de una mesa actualiza la existente en vez de duplicarla
// (upsert manual, en una transacción). Este flujo se va a terminar de
// ajustar cuando se definan las planillas reales de escrutinio.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();
$id = getId();
$scope = requireMunicipioScope();
$municipioId = $scope['municipio_id'];
$eleccionId = requireEleccionScope();

match($method) {
    'GET'    => ($id ? getActa($db, $id, $municipioId, $eleccionId) : listActas($db, $municipioId, $eleccionId)),
    'POST'   => saveActa($db, $municipioId, $eleccionId, $scope['payload']),
    default  => jsonError('Método no permitido', 405),
};

function listActas(PDO $db, int $municipioId, int $eleccionId): void {
    $where = ['a.municipio_id = ?', 'a.eleccion_id = ?'];
    $params = [$municipioId, $eleccionId];
    if (!empty($_GET['mesa_id'])) {
        $where[] = 'a.mesa_id = ?';
        $params[] = (int)$_GET['mesa_id'];
    }
    if (!empty($_GET['estado'])) {
        $where[] = 'a.estado = ?';
        $params[] = $_GET['estado'];
    }

    $sql = "SELECT a.*, m.numero AS mesa_numero, es.nombre AS establecimiento_nombre, u.usuario AS cargado_por_usuario
            FROM actas a
            JOIN mesas m ON a.mesa_id = m.id
            JOIN establecimientos es ON m.establecimiento_id = es.id
            LEFT JOIN usuarios u ON a.cargado_por = u.id
            WHERE " . implode(' AND ', $where) . '
            ORDER BY m.numero';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function getActa(PDO $db, int $id, int $municipioId, int $eleccionId): void {
    $stmt = $db->prepare(
        "SELECT a.*, m.numero AS mesa_numero, es.nombre AS establecimiento_nombre
         FROM actas a
         JOIN mesas m ON a.mesa_id = m.id
         JOIN establecimientos es ON m.establecimiento_id = es.id
         WHERE a.id = ? AND a.municipio_id = ? AND a.eleccion_id = ?"
    );
    $stmt->execute([$id, $municipioId, $eleccionId]);
    $acta = $stmt->fetch();
    if (!$acta) jsonError('Acta no encontrada', 404);

    $votos = $db->prepare(
        "SELECT av.lista_id, av.votos, l.numero AS lista_numero, l.nombre AS lista_nombre,
                p.nombre AS partido_nombre, p.color AS partido_color, c.nombre AS cargo_nombre
         FROM acta_votos av
         JOIN listas l ON av.lista_id = l.id
         JOIN partidos p ON l.partido_id = p.id
         JOIN cargos c ON l.cargo_id = c.id
         WHERE av.acta_id = ?
         ORDER BY c.orden, av.votos DESC"
    );
    $votos->execute([$id]);
    $acta['votos'] = $votos->fetchAll();

    jsonResponse($acta);
}

function saveActa(PDO $db, int $municipioId, int $eleccionId, array $payload): void {
    $data = getBody();

    if (empty($data['mesa_id'])) jsonError('El campo mesa_id es requerido');
    if (empty($data['votos']) || !is_array($data['votos'])) jsonError('El detalle de votos por lista es requerido');

    $mesaId = (int)$data['mesa_id'];
    $stmt = $db->prepare("SELECT municipio_id, eleccion_id FROM mesas WHERE id = ?");
    $stmt->execute([$mesaId]);
    $mesa = $stmt->fetch();
    if (!$mesa || (int)$mesa['municipio_id'] !== $municipioId || (int)$mesa['eleccion_id'] !== $eleccionId) {
        jsonError('La mesa no pertenece a esta elección', 400);
    }

    $estado = $data['estado'] ?? 'cargada';
    if (!in_array($estado, ['pendiente', 'cargada', 'validada'])) jsonError('Estado inválido');

    $db->beginTransaction();
    try {
        $check = $db->prepare("SELECT id FROM actas WHERE mesa_id = ? AND municipio_id = ? AND eleccion_id = ?");
        $check->execute([$mesaId, $municipioId, $eleccionId]);
        $existing = $check->fetch();

        $params = [
            (int)($data['electores_votantes'] ?? 0),
            (int)($data['votos_blanco'] ?? 0),
            (int)($data['votos_nulos'] ?? 0),
            (int)($data['votos_recurridos'] ?? 0),
            (int)($data['votos_impugnados'] ?? 0),
            $estado,
            $data['observaciones'] ?? null,
            (int)$payload['sub'],
        ];

        if ($existing) {
            $actaId = (int)$existing['id'];
            $stmt = $db->prepare(
                "UPDATE actas SET electores_votantes=?, votos_blanco=?, votos_nulos=?, votos_recurridos=?, votos_impugnados=?,
                    estado=?, observaciones=?, cargado_por=?, updated_at=NOW()
                 WHERE id=?"
            );
            $stmt->execute([...$params, $actaId]);
            $db->prepare("DELETE FROM acta_votos WHERE acta_id = ?")->execute([$actaId]);
        } else {
            $stmt = $db->prepare(
                "INSERT INTO actas (municipio_id, eleccion_id, mesa_id, electores_votantes, votos_blanco, votos_nulos, votos_recurridos, votos_impugnados, estado, observaciones, cargado_por)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([$municipioId, $eleccionId, $mesaId, ...$params]);
            $actaId = (int)$db->lastInsertId();
        }

        $insertVoto = $db->prepare("INSERT INTO acta_votos (acta_id, lista_id, votos) VALUES (?, ?, ?)");
        foreach ($data['votos'] as $v) {
            if (empty($v['lista_id'])) continue;
            $insertVoto->execute([$actaId, (int)$v['lista_id'], (int)($v['votos'] ?? 0)]);
        }

        $db->commit();
        jsonResponse(['id' => $actaId, 'message' => 'Acta guardada'], $existing ? 200 : 201);
    } catch (\Throwable $e) {
        $db->rollBack();
        jsonError('Error al guardar el acta: ' . $e->getMessage(), 500);
    }
}
