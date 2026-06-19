<?php
$dsn = 'mysql:host=localhost;dbname=mundial2026;charset=utf8mb4';
$opciones = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];

try {
    $pdo = new PDO($dsn, 'root', '', $opciones);
} catch (PDOException $e) {
    die('<p class="error">Error de conexión: ' . htmlspecialchars($e->getMessage()) . '</p>');
}

$mensaje = '';
$error   = '';

// Procesar formulario de carga de resultado
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['accion']) && $_POST['accion'] === 'cargar_resultado') {
    $id_partido       = filter_input(INPUT_POST, 'id_partido',       FILTER_VALIDATE_INT);
    $goles_local      = filter_input(INPUT_POST, 'goles_local',      FILTER_VALIDATE_INT);
    $goles_visitante  = filter_input(INPUT_POST, 'goles_visitante',  FILTER_VALIDATE_INT);
    $fue_prorroga     = isset($_POST['fue_prorroga'])  ? 1 : 0;
    $fue_penales      = isset($_POST['fue_penales'])   ? 1 : 0;

    if ($id_partido === false || $id_partido <= 0) {
        $error = 'El ID de partido no es válido.';
    } elseif ($goles_local === false || $goles_local < 0) {
        $error = 'Los goles del equipo local no son válidos.';
    } elseif ($goles_visitante === false || $goles_visitante < 0) {
        $error = 'Los goles del equipo visitante no son válidos.';
    } else {
        $stmt = $pdo->prepare("
            UPDATE partidos
            SET goles_local     = :gl,
                goles_visitante = :gv,
                fue_prorroga    = :fp,
                fue_penales     = :fpe,
                estado          = 'Finalizado'
            WHERE id_partido = :id
        ");
        $stmt->execute([
            ':gl'  => $goles_local,
            ':gv'  => $goles_visitante,
            ':fp'  => $fue_prorroga,
            ':fpe' => $fue_penales,
            ':id'  => $id_partido,
        ]);

        if ($stmt->rowCount() > 0) {
            $mensaje = 'Resultado cargado correctamente.';
        } else {
            $error = 'No se encontró el partido con ese ID.';
        }
    }
}

// Filtro por fase
$id_fase_filtro = filter_input(INPUT_GET, 'fase', FILTER_VALIDATE_INT) ?: 0;

$fases = $pdo->query("SELECT id_fase, nombre FROM fases ORDER BY orden")->fetchAll();

$sql = "
    SELECT p.id_partido, p.fecha_hora,
           l.nombre AS local, p.goles_local,
           p.goles_visitante, v.nombre AS visitante,
           s.estadio, s.ciudad, f.nombre AS fase,
           p.fue_prorroga, p.fue_penales
    FROM partidos p
    JOIN selecciones l ON l.id_seleccion = p.id_seleccion_local
    JOIN selecciones v ON v.id_seleccion = p.id_seleccion_visit
    JOIN sedes s ON s.id_sede = p.id_sede
    JOIN fases f ON f.id_fase = p.id_fase
    WHERE p.estado = 'Finalizado'
";
$params = [];
if ($id_fase_filtro > 0) {
    $sql .= ' AND p.id_fase = :id_fase';
    $params[':id_fase'] = $id_fase_filtro;
}
$sql .= ' ORDER BY p.fecha_hora DESC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$partidos = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resultados — Mundial FIFA 2026</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #0a0a2e; color: #eee; }

        header { background: linear-gradient(135deg, #1a1a5e, #c8102e); padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; }
        header h1 { font-size: 1.6rem; }

        nav { background: #111; border-bottom: 2px solid #c8102e; display: flex; }
        nav a { display: block; padding: 14px 24px; color: #ccc; text-decoration: none; font-size: 0.95rem; transition: background 0.2s; }
        nav a:hover, nav a.activo { background: #c8102e; color: #fff; }

        main { max-width: 1100px; margin: 30px auto; padding: 0 20px; }
        h2 { color: #ffd700; margin-bottom: 20px; font-size: 1.4rem; }

        .controles { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
        select { background: #1e1e5e; color: #eee; border: 1px solid #444; padding: 8px 12px; border-radius: 4px; font-size: 0.9rem; }
        .btn { background: #c8102e; color: #fff; border: none; padding: 8px 18px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
        .btn:hover { background: #a00d24; }

        table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-bottom: 30px; }
        th { background: #1e1e5e; padding: 10px 12px; text-align: left; color: #aaa; }
        td { padding: 9px 12px; border-bottom: 1px solid #1e1e4e; }
        tr:hover td { background: #1a1a4e; }
        .resultado { text-align: center; font-weight: bold; color: #ffd700; font-size: 1.1rem; white-space: nowrap; }
        .badge { font-size: 0.72rem; background: #333; color: #aaa; padding: 2px 6px; border-radius: 10px; margin-left: 4px; }

        .form-card { background: #13133a; border: 1px solid #2a2a6e; border-radius: 8px; padding: 24px; margin-top: 10px; }
        .form-card h3 { color: #ffd700; margin-bottom: 18px; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        label { font-size: 0.85rem; color: #aaa; }
        input[type="number"], input[type="text"] { background: #0d0d3b; color: #eee; border: 1px solid #444; padding: 8px 10px; border-radius: 4px; font-size: 0.9rem; width: 100%; }
        .check-group { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
        .form-actions { margin-top: 18px; }
        .alerta { padding: 10px 14px; border-radius: 4px; margin-bottom: 16px; font-size: 0.9rem; }
        .alerta.ok  { background: #0d3320; color: #4caf50; border: 1px solid #2e7d32; }
        .alerta.err { background: #300; color: #f66; border: 1px solid #700; }

        footer { text-align: center; padding: 24px; color: #555; font-size: 0.82rem; margin-top: 40px; }
    </style>
</head>
<body>

<header>
    <h1>⚽ Mundial FIFA 2026</h1>
    <span>EE.UU. · Canadá · México</span>
</header>

<nav>
    <a href="index.php">Inicio</a>
    <a href="resultados.php" class="activo">Resultados</a>
    <a href="posiciones.php">Posiciones</a>
    <a href="goleadores.php">Goleadores</a>
    <a href="fixture.php">Fixture</a>
</nav>

<main>
    <h2>Resultados</h2>

    <?php if ($mensaje): ?>
        <div class="alerta ok"><?= htmlspecialchars($mensaje) ?></div>
    <?php endif; ?>
    <?php if ($error): ?>
        <div class="alerta err"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form method="get" class="controles">
        <label for="fase">Filtrar por fase:</label>
        <select name="fase" id="fase">
            <option value="0">Todas las fases</option>
            <?php foreach ($fases as $f): ?>
                <option value="<?= $f['id_fase'] ?>" <?= $id_fase_filtro == $f['id_fase'] ? 'selected' : '' ?>>
                    <?= htmlspecialchars($f['nombre']) ?>
                </option>
            <?php endforeach; ?>
        </select>
        <button type="submit" class="btn">Filtrar</button>
    </form>

    <?php if (empty($partidos)): ?>
        <p style="color:#666">No hay partidos finalizados con ese filtro.</p>
    <?php else: ?>
    <table>
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Local</th>
                <th>Resultado</th>
                <th>Visitante</th>
                <th>Sede</th>
                <th>Fase</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($partidos as $p): ?>
            <tr>
                <td><?= date('d/m/Y H:i', strtotime($p['fecha_hora'])) ?></td>
                <td><?= htmlspecialchars($p['local']) ?></td>
                <td class="resultado">
                    <?= $p['goles_local'] ?> - <?= $p['goles_visitante'] ?>
                    <?php if ($p['fue_penales']): ?>
                        <span class="badge">Pen.</span>
                    <?php elseif ($p['fue_prorroga']): ?>
                        <span class="badge">Pr.</span>
                    <?php endif; ?>
                </td>
                <td><?= htmlspecialchars($p['visitante']) ?></td>
                <td><?= htmlspecialchars($p['estadio']) ?>, <?= htmlspecialchars($p['ciudad']) ?></td>
                <td><?= htmlspecialchars($p['fase']) ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>

    <div class="form-card">
        <h3>Cargar resultado de partido</h3>
        <form method="post">
            <input type="hidden" name="accion" value="cargar_resultado">
            <div class="form-grid">
                <div class="form-group">
                    <label for="id_partido">ID de partido</label>
                    <input type="number" id="id_partido" name="id_partido" min="1" required placeholder="Ej: 1">
                </div>
                <div class="form-group">
                    <label for="goles_local">Goles local</label>
                    <input type="number" id="goles_local" name="goles_local" min="0" required placeholder="0">
                </div>
                <div class="form-group">
                    <label for="goles_visitante">Goles visitante</label>
                    <input type="number" id="goles_visitante" name="goles_visitante" min="0" required placeholder="0">
                </div>
            </div>
            <div class="form-grid" style="margin-top:14px">
                <div class="check-group">
                    <input type="checkbox" id="fue_prorroga" name="fue_prorroga" value="1">
                    <label for="fue_prorroga">Fue a prórroga</label>
                </div>
                <div class="check-group">
                    <input type="checkbox" id="fue_penales" name="fue_penales" value="1">
                    <label for="fue_penales">Fue a penales</label>
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn">Guardar resultado</button>
            </div>
        </form>
    </div>
</main>

<footer>Mundial FIFA 2026 &mdash; Proyecto Aplicaciones Informáticas</footer>
</body>
</html>
