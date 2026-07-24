<?php
// Corte de mesa automático: dado un máximo de electores por mesa, reparte
// TODO el padrón de la elección actual en mesas, en bloques ordenados
// alfabéticamente (apellido, nombre) — igual al criterio real de la
// Justicia Electoral. Reasigna mesa_id y orden de cada elector; es
// re-ejecutable: cada corrida recalcula todo desde cero según el máximo
// indicado, sin importar cortes anteriores.
//
// El orden puede ser correlativo a lo largo de TODO el padrón (default:
// mesa 2 sigue donde terminó la 1) o reiniciar en 1 en cada mesa, según el
// checkbox "Reiniciar el orden en 1 en cada mesa" de la pantalla de
// Configuración (parámetro reiniciar_orden). No se guarda como preferencia:
// se elige en cada corrida.
//
// Las mesas nuevas quedan bajo el establecimiento genérico "Sin asignar"
// (mismo criterio que la importación de CSV), para repartirlas después a
// los establecimientos reales desde la pantalla de Mesas. Si se vuelve a
// correr el corte después de esa reasignación manual, reusa esa misma mesa
// (por número, sin importar el establecimiento en el que haya quedado) en
// vez de crear una "Sin asignar" duplicada con el mismo número.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();

$db = getDB();
$method = getMethod();

match($method) {
    'POST' => cortarMesas($db),
    default => jsonError('Método no permitido', 405),
};

function cortarMesas(PDO $db): void {
    @set_time_limit(300);

    $scope = requireMunicipioScope(requireAdmin());
    $municipioId = $scope['municipio_id'];
    $eleccionId = requireEleccionScope();

    $data = getBody();
    $maxPorMesa = (int)($data['max_por_mesa'] ?? 0);
    if ($maxPorMesa < 1) jsonError('El máximo de electores por mesa debe ser mayor a 0', 400);

    $numeroInicial = (int)($data['numero_inicial'] ?? 1);
    if ($numeroInicial < 1) jsonError('El número de mesa inicial debe ser mayor a 0', 400);

    $reiniciarOrden = !empty($data['reiniciar_orden']);

    $stmt = $db->prepare(
        "SELECT id FROM electores WHERE municipio_id = ? AND eleccion_id = ? ORDER BY apellido, nombre, id"
    );
    $stmt->execute([$municipioId, $eleccionId]);
    $electorIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($electorIds)) {
        jsonError('No hay electores cargados en esta elección para cortar en mesas', 400);
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

    // Busca por número en TODA la elección, no solo bajo "Sin asignar": si esa
    // mesa ya se reasignó a mano a su escuela real (flujo normal después del
    // primer corte), hay que reusarla ahí, no crear una nueva bajo "Sin
    // asignar" con el mismo número (quedarían dos mesas "1" duplicadas y la
    // real quedaría vacía y huérfana). Si hay más de una coincidencia — caso
    // ya roto por corridas anteriores de este bug — se prefiere la que no sea
    // "Sin asignar".
    $findMesa = $db->prepare(
        "SELECT id FROM mesas WHERE municipio_id = ? AND eleccion_id = ? AND numero = ?
         ORDER BY (establecimiento_id = ?) ASC LIMIT 1"
    );
    $insertMesa = $db->prepare(
        "INSERT INTO mesas (municipio_id, eleccion_id, establecimiento_id, numero, electores_habilitados) VALUES (?, ?, ?, ?, 0)"
    );
    $updateMesaCount = $db->prepare("UPDATE mesas SET electores_habilitados = ? WHERE id = ?");
    $updateElector = $db->prepare("UPDATE electores SET mesa_id = ?, orden = ? WHERE id = ?");

    $totalMesas = (int)ceil(count($electorIds) / $maxPorMesa);
    $mesasCreadas = 0;
    $mesaIdsUsados = [];

    $orden = 0;

    $db->beginTransaction();
    try {
        foreach (array_chunk($electorIds, $maxPorMesa) as $i => $bloque) {
            $numero = (string)($numeroInicial + $i);
            $findMesa->execute([$municipioId, $eleccionId, $numero, $establecimientoId]);
            $mesaId = $findMesa->fetchColumn();
            if (!$mesaId) {
                $insertMesa->execute([$municipioId, $eleccionId, $establecimientoId, $numero]);
                $mesaId = (int)$db->lastInsertId();
                $mesasCreadas++;
            }
            $mesaIdsUsados[] = $mesaId;

            if ($reiniciarOrden) $orden = 0;
            foreach ($bloque as $electorId) {
                $orden++;
                $updateElector->execute([$mesaId, $orden, $electorId]);
            }
            $updateMesaCount->execute([count($bloque), $mesaId]);
        }

        $db->commit();
    } catch (\Throwable $e) {
        $db->rollBack();
        jsonError('Error al cortar mesas: ' . $e->getMessage(), 500);
    }

    // Limpieza: mesas que quedaron bajo "Sin asignar" de cortes anteriores y
    // que ya no tienen ningún elector asignado (porque todos se movieron a las
    // mesas de esta corrida). Si una mesa vieja ya tiene un fiscal asignado
    // (FK en la tabla fiscales), el DELETE falla y la dejamos como está.
    $mesasBorradas = 0;
    $placeholders = implode(',', array_fill(0, count($mesaIdsUsados), '?'));
    $findViejas = $db->prepare(
        "SELECT id FROM mesas
         WHERE municipio_id = ? AND eleccion_id = ? AND establecimiento_id = ?
           AND id NOT IN ($placeholders)"
    );
    $findViejas->execute([$municipioId, $eleccionId, $establecimientoId, ...$mesaIdsUsados]);
    $mesasViejas = $findViejas->fetchAll(PDO::FETCH_COLUMN);

    $countElectores = $db->prepare("SELECT COUNT(*) FROM electores WHERE mesa_id = ?");
    $deleteMesaVieja = $db->prepare("DELETE FROM mesas WHERE id = ?");
    foreach ($mesasViejas as $mesaViejaId) {
        $countElectores->execute([$mesaViejaId]);
        if ((int)$countElectores->fetchColumn() > 0) continue;
        try {
            $deleteMesaVieja->execute([$mesaViejaId]);
            $mesasBorradas++;
        } catch (\Throwable $e) {
            // Tiene fiscal u otra referencia asociada; se deja como está.
        }
    }

    jsonResponse([
        'message'          => 'Corte de mesa aplicado',
        'total_electores'  => count($electorIds),
        'total_mesas'      => $totalMesas,
        'mesas_creadas'    => $mesasCreadas,
        'mesas_borradas'   => $mesasBorradas,
        'max_por_mesa'     => $maxPorMesa,
        'numero_inicial'   => $numeroInicial,
        'numero_final'     => $numeroInicial + $totalMesas - 1,
        'reiniciar_orden'  => $reiniciarOrden,
    ]);
}
