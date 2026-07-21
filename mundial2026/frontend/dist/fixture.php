<?php
require_once __DIR__ . '/config/database.php';

try {
    $pdo = getDB();
} catch (PDOException $e) {
    die('<p class="error">Error de conexión: ' . htmlspecialchars($e->getMessage()) . '</p>');
}

$mensaje = '';
$error   = '';

// Guardar resultado desde formulario inline
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['accion']) && $_POST['accion'] === 'guardar') {
    $id  = filter_input(INPUT_POST, 'id_partido',      FILTER_VALIDATE_INT);
    $gl  = filter_input(INPUT_POST, 'goles_local',     FILTER_VALIDATE_INT);
    $gv  = filter_input(INPUT_POST, 'goles_visitante', FILTER_VALIDATE_INT);
    $fp  = isset($_POST['fue_prorroga']) ? 1 : 0;
    $fpe = isset($_POST['fue_penales'])  ? 1 : 0;

    if ($id && $id > 0 && $gl !== false && $gl >= 0 && $gv !== false && $gv >= 0) {
        $stmt = $pdo->prepare("
            UPDATE partidos
            SET goles_local=:gl, goles_visitante=:gv,
                fue_prorroga=:fp, fue_penales=:fpe, estado='Finalizado'
            WHERE id_partido=:id
        ");
        $stmt->execute([':gl'=>$gl,':gv'=>$gv,':fp'=>$fp,':fpe'=>$fpe,':id'=>$id]);
        $mensaje = 'Resultado guardado correctamente.';
    } else {
        $error = 'Datos inválidos. Verificá los goles ingresados.';
    }
}

$grupo_sel = strtoupper(trim($_GET['grupo'] ?? ''));
$grupos = $pdo->query("SELECT id_grupo, nombre FROM grupos ORDER BY id_grupo")->fetchAll();
$validos = array_column($grupos, 'id_grupo');

$sql = "
    SELECT p.id_partido, p.fecha_hora,
           l.nombre AS local, v.nombre AS visitante,
           p.goles_local, p.goles_visitante,
           p.estado, s.estadio, s.ciudad,
           f.nombre AS fase,
           COALESCE(p.id_grupo, '') AS id_grupo,
           p.fue_prorroga, p.fue_penales
    FROM partidos p
    JOIN selecciones l ON l.id_seleccion = p.id_seleccion_local
    JOIN selecciones v ON v.id_seleccion = p.id_seleccion_visit
    JOIN sedes s ON s.id_sede = p.id_sede
    JOIN fases f ON f.id_fase = p.id_fase
";
$params = [];
if (in_array($grupo_sel, $validos, true)) {
    $sql .= ' WHERE p.id_grupo = :grupo';
    $params[':grupo'] = $grupo_sel;
}
$sql .= ' ORDER BY p.fecha_hora ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$partidos = $stmt->fetchAll();

$estado_colores = [
    'Programado' => '#444',
    'En curso'   => '#2e7d32',
    'Finalizado' => '#1a237e',
    'Suspendido' => '#7f0000',
];
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fixture — Mundial FIFA 2026</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #0a0a2e; color: #eee; }

        header { background: linear-gradient(135deg, #1a1a5e, #c8102e); padding: 16px 30px; display: flex; align-items: center; justify-content: space-between; }
        header h1 { font-size: 1.5rem; }
        header span { font-size: 0.85rem; opacity: 0.8; }

        nav { background: #111; border-bottom: 2px solid #c8102e; display: flex; }
        nav a { display: block; padding: 13px 22px; color: #ccc; text-decoration: none; font-size: 0.9rem; transition: background 0.2s; }
        nav a:hover, nav a.activo { background: #c8102e; color: #fff; }

        main { max-width: 1200px; margin: 24px auto; padding: 0 16px; }
        h2 { color: #ffd700; margin-bottom: 16px; font-size: 1.3rem; }

        .grupo-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
        .grupo-tabs a { padding: 5px 13px; background: #1e1e5e; color: #ccc; text-decoration: none; border-radius: 4px; font-size: 0.85rem; border: 1px solid #2a2a6e; transition: background 0.2s; }
        .grupo-tabs a:hover { background: #2a2a8e; }
        .grupo-tabs a.activo { background: #c8102e; color: #fff; border-color: #c8102e; }

        .alerta { padding: 10px 14px; border-radius: 4px; margin-bottom: 16px; font-size: 0.9rem; }
        .alerta.ok  { background: #0d3320; color: #4caf50; border: 1px solid #2e7d32; }
        .alerta.err { background: #300; color: #f66; border: 1px solid #700; }

        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th { background: #1e1e5e; padding: 9px 10px; text-align: left; color: #aaa; font-weight: normal; white-space: nowrap; }
        td { padding: 7px 10px; border-bottom: 1px solid #1a1a4e; vertical-align: middle; }
        tr:hover td { background: #131340; }

        .fecha { color: #888; font-size: 0.8rem; white-space: nowrap; }
        .equipo { font-size: 0.9rem; }
        .resultado { font-weight: bold; color: #ffd700; text-align: center; font-size: 1rem; white-space: nowrap; }
        .vs { color: #555; text-align: center; }
        .sede { color: #777; font-size: 0.78rem; }
        .fase { color: #aaa; font-size: 0.78rem; }
        .estado { font-size: 0.72rem; padding: 2px 7px; border-radius: 10px; color: #fff; white-space: nowrap; }
        .badge { font-size: 0.68rem; background: #333; color: #aaa; padding: 1px 5px; border-radius: 8px; margin-left: 3px; }

        /* Formulario inline */
        .form-inline { display: flex; align-items: center; gap: 6px; }
        .form-inline input[type="number"] {
            width: 48px; background: #0d0d3b; color: #eee;
            border: 1px solid #444; padding: 5px 6px;
            border-radius: 4px; font-size: 0.85rem; text-align: center;
        }
        .form-inline .guion { color: #555; font-weight: bold; }
        .form-inline button {
            background: #c8102e; color: #fff; border: none;
            padding: 5px 12px; border-radius: 4px; cursor: pointer;
            font-size: 0.8rem; white-space: nowrap;
        }
        .form-inline button:hover { background: #a00d24; }
        .form-inline .extras { display: flex; gap: 8px; align-items: center; font-size: 0.75rem; color: #aaa; }
        .form-inline .extras label { display: flex; align-items: center; gap: 3px; cursor: pointer; }

        footer {
            text-align: center; padding: 20px; color: #666;
            font-size: 0.8rem; margin-top: 40px;
            border-top: 1px solid #1e1e4e;
        }
        footer strong { color: #aaa; }
    </style>
</head>
<body>

<header>
    <h1>⚽ Mundial FIFA 2026</h1>
    <span>EE.UU. · Canadá · México</span>
</header>

<nav>
    <a href="index.php">Inicio</a>
    <a href="resultados.php">Resultados</a>
    <a href="posiciones.php">Posiciones</a>
    <a href="goleadores.php">Goleadores</a>
    <a href="fixture.php" class="activo">Fixture</a>
</nav>

<main>
    <h2>Fixture completo</h2>

    <?php if ($mensaje): ?>
        <div class="alerta ok"><?= htmlspecialchars($mensaje) ?></div>
    <?php endif; ?>
    <?php if ($error): ?>
        <div class="alerta err"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <div class="grupo-tabs">
        <a href="fixture.php" class="<?= $grupo_sel === '' ? 'activo' : '' ?>">Todos</a>
        <?php foreach ($grupos as $g): ?>
            <a href="?grupo=<?= $g['id_grupo'] ?>" class="<?= $g['id_grupo'] === $grupo_sel ? 'activo' : '' ?>">
                <?= htmlspecialchars($g['nombre']) ?>
            </a>
        <?php endforeach; ?>
    </div>

    <?php if (empty($partidos)): ?>
        <p style="color:#666">No hay partidos para mostrar.</p>
    <?php else: ?>
    <table>
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Local</th>
                <th style="text-align:center">Resultado / Cargar</th>
                <th>Visitante</th>
                <th>Sede</th>
                <th>Fase</th>
                <th>Estado</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($partidos as $p):
            $color = $estado_colores[$p['estado']] ?? '#555';
        ?>
            <tr>
                <td class="fecha"><?= date('d/m/Y H:i', strtotime($p['fecha_hora'])) ?></td>
                <td class="equipo"><?= htmlspecialchars($p['local']) ?></td>
                <td>
                    <?php if ($p['estado'] === 'Finalizado'): ?>
                        <div class="resultado">
                            <?= $p['goles_local'] ?> - <?= $p['goles_visitante'] ?>
                            <?php if ($p['fue_penales']): ?><span class="badge">Pen.</span><?php endif; ?>
                            <?php if ($p['fue_prorroga'] && !$p['fue_penales']): ?><span class="badge">Pr.</span><?php endif; ?>
                        </div>
                    <?php else: ?>
                        <form method="post" class="form-inline">
                            <input type="hidden" name="accion" value="guardar">
                            <input type="hidden" name="id_partido" value="<?= $p['id_partido'] ?>">
                            <input type="number" name="goles_local" min="0" max="30" placeholder="0" required>
                            <span class="guion">-</span>
                            <input type="number" name="goles_visitante" min="0" max="30" placeholder="0" required>
                            <div class="extras">
                                <label><input type="checkbox" name="fue_prorroga" value="1"> Pr.</label>
                                <label><input type="checkbox" name="fue_penales" value="1"> Pen.</label>
                            </div>
                            <button type="submit">Guardar</button>
                        </form>
                    <?php endif; ?>
                </td>
                <td class="equipo"><?= htmlspecialchars($p['visitante']) ?></td>
                <td class="sede"><?= htmlspecialchars($p['estadio']) ?><br><?= htmlspecialchars($p['ciudad']) ?></td>
                <td class="fase"><?= htmlspecialchars($p['fase']) ?></td>
                <td><span class="estado" style="background:<?= $color ?>"><?= htmlspecialchars($p['estado']) ?></span></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</main>

<footer>
    <strong>Mundial FIFA 2026</strong> &mdash;
    Desarrollado por 6to Año D de Informática &mdash; Escuela Presidente Sarmiento
</footer>

</body>
</html>
