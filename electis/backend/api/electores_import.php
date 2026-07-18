<?php
// Carga masiva de padrón por CSV (solo admin). El CSV requiere columnas
// documento, apellido, nombre, mesa_numero; domicilio y orden son opcionales.
// Las mesas que no existan se crean automáticamente bajo un establecimiento
// genérico "Sin asignar" del municipio, para reasignar a la escuela real
// después desde la pantalla de Mesas. Es re-ejecutable: los documentos ya
// cargados en el municipio se omiten en vez de duplicarse.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();

match($method) {
    'POST'  => importPadron($db),
    default => jsonError('Método no permitido', 405),
};

function importPadron(PDO $db): void {
    @set_time_limit(300);

    $scope = requireMunicipioScope(requireAdmin());
    $municipioId = $scope['municipio_id'];

    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        jsonError('Debe subir un archivo CSV', 400);
    }

    $handle = fopen($_FILES['file']['tmp_name'], 'r');
    if (!$handle) jsonError('No se pudo leer el archivo', 400);

    $header = fgetcsv($handle);
    if (!$header) jsonError('El archivo está vacío', 400);
    $header = array_map('trim', $header);
    $idx = array_flip($header);
    foreach (['documento', 'apellido', 'nombre', 'mesa_numero'] as $col) {
        if (!isset($idx[$col])) jsonError("Falta la columna '$col' en el CSV", 400);
    }

    $estNombre = 'Sin asignar';
    $estStmt = $db->prepare("SELECT id FROM establecimientos WHERE municipio_id = ? AND nombre = ?");
    $estStmt->execute([$municipioId, $estNombre]);
    $establecimientoId = $estStmt->fetchColumn();
    if (!$establecimientoId) {
        $ins = $db->prepare("INSERT INTO establecimientos (municipio_id, nombre) VALUES (?, ?)");
        $ins->execute([$municipioId, $estNombre]);
        $establecimientoId = (int)$db->lastInsertId();
    }

    $existing = [];
    $docStmt = $db->prepare("SELECT documento FROM electores WHERE municipio_id = ?");
    $docStmt->execute([$municipioId]);
    foreach ($docStmt->fetchAll(PDO::FETCH_COLUMN) as $doc) $existing[$doc] = true;

    $insertElector = $db->prepare(
        "INSERT INTO electores (municipio_id, orden, documento, apellido, nombre, domicilio, mesa_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $findMesa = $db->prepare("SELECT id FROM mesas WHERE municipio_id = ? AND establecimiento_id = ? AND numero = ?");
    $insertMesa = $db->prepare("INSERT INTO mesas (municipio_id, establecimiento_id, numero) VALUES (?, ?, ?)");
    $bumpMesa = $db->prepare("UPDATE mesas SET electores_habilitados = electores_habilitados + 1 WHERE id = ?");

    $mesaCache = [];
    $creados = 0;
    $omitidos = 0;
    $mesasCreadas = 0;
    $errores = [];
    $fila = 1;

    $db->beginTransaction();
    try {
        while (($row = fgetcsv($handle)) !== false) {
            $fila++;
            if (count($row) < count($header)) continue;

            $documento  = trim($row[$idx['documento']] ?? '');
            $apellido   = trim($row[$idx['apellido']] ?? '');
            $nombre     = trim($row[$idx['nombre']] ?? '');
            $mesaNumero = trim($row[$idx['mesa_numero']] ?? '');
            $domicilio  = isset($idx['domicilio']) ? trim($row[$idx['domicilio']] ?? '') : '';
            $orden      = (isset($idx['orden']) && $row[$idx['orden']] !== '') ? (int)$row[$idx['orden']] : null;

            if ($documento === '' || $apellido === '' || $mesaNumero === '') {
                $errores[] = "Fila $fila: faltan datos requeridos";
                continue;
            }
            if (isset($existing[$documento])) {
                $omitidos++;
                continue;
            }

            if (!isset($mesaCache[$mesaNumero])) {
                $findMesa->execute([$municipioId, $establecimientoId, $mesaNumero]);
                $mesaId = $findMesa->fetchColumn();
                if (!$mesaId) {
                    $insertMesa->execute([$municipioId, $establecimientoId, $mesaNumero]);
                    $mesaId = (int)$db->lastInsertId();
                    $mesasCreadas++;
                }
                $mesaCache[$mesaNumero] = (int)$mesaId;
            }

            $insertElector->execute([$municipioId, $orden, $documento, $apellido, $nombre, $domicilio ?: null, $mesaCache[$mesaNumero]]);
            $bumpMesa->execute([$mesaCache[$mesaNumero]]);
            $existing[$documento] = true;
            $creados++;
        }

        $db->commit();
    } catch (\Throwable $e) {
        $db->rollBack();
        jsonError('Error al importar: ' . $e->getMessage(), 500);
    }

    fclose($handle);

    jsonResponse([
        'message'                       => 'Importación completada',
        'electores_creados'             => $creados,
        'electores_omitidos_duplicados' => $omitidos,
        'mesas_creadas'                 => $mesasCreadas,
        'errores'                       => array_slice($errores, 0, 50),
        'total_errores'                 => count($errores),
    ]);
}
