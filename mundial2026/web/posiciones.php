<?php
$dsn = 'mysql:host=localhost;dbname=mundial2026;charset=utf8mb4';
$opciones = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];

try {
    $pdo = new PDO($dsn, 'fuel_user', 'Mateo1212**', $opciones);
} catch (PDOException $e) {
    die('<p class="error">Error de conexión: ' . htmlspecialchars($e->getMessage()) . '</p>');
}

$grupos = $pdo->query("SELECT id_grupo, nombre FROM grupos ORDER BY id_grupo")->fetchAll();

$grupo_sel = strtoupper(trim($_GET['grupo'] ?? 'A'));
$validos = array_column($grupos, 'id_grupo');
if (!in_array($grupo_sel, $validos, true)) {
    $grupo_sel = 'A';
}

// Calcula posiciones en tiempo real con JOINs sobre partidos finalizados
$posiciones = $pdo->prepare("
    SELECT
        s.nombre AS seleccion,
        COUNT(p.id_partido)                                                            AS pj,
        SUM(
            CASE
                WHEN p.id_seleccion_local = s.id_seleccion AND p.goles_local > p.goles_visitante THEN 1
                WHEN p.id_seleccion_visit = s.id_seleccion AND p.goles_visitante > p.goles_local THEN 1
                ELSE 0
            END
        )                                                                              AS pg,
        SUM(
            CASE WHEN p.goles_local = p.goles_visitante THEN 1 ELSE 0 END
        )                                                                              AS pe,
        SUM(
            CASE
                WHEN p.id_seleccion_local = s.id_seleccion AND p.goles_local < p.goles_visitante THEN 1
                WHEN p.id_seleccion_visit = s.id_seleccion AND p.goles_visitante < p.goles_local THEN 1
                ELSE 0
            END
        )                                                                              AS pp,
        SUM(
            CASE
                WHEN p.id_seleccion_local = s.id_seleccion THEN p.goles_local
                ELSE p.goles_visitante
            END
        )                                                                              AS gf,
        SUM(
            CASE
                WHEN p.id_seleccion_local = s.id_seleccion THEN p.goles_visitante
                ELSE p.goles_local
            END
        )                                                                              AS gc,
        SUM(
            CASE
                WHEN p.id_seleccion_local = s.id_seleccion AND p.goles_local > p.goles_visitante THEN 3
                WHEN p.id_seleccion_visit = s.id_seleccion AND p.goles_visitante > p.goles_local THEN 3
                WHEN p.goles_local = p.goles_visitante THEN 1
                ELSE 0
            END
        )                                                                              AS pts
    FROM selecciones s
    JOIN grupos_selecciones gs ON gs.id_seleccion = s.id_seleccion AND gs.id_grupo = :grupo
    LEFT JOIN partidos p ON (
            p.id_seleccion_local = s.id_seleccion
            OR p.id_seleccion_visit = s.id_seleccion
        )
        AND p.id_grupo = :grupo2
        AND p.estado = 'Finalizado'
    GROUP BY s.id_seleccion, s.nombre
    ORDER BY pts DESC, (SUM(
            CASE
                WHEN p.id_seleccion_local = s.id_seleccion THEN p.goles_local
                ELSE p.goles_visitante
            END
        ) - SUM(
            CASE
                WHEN p.id_seleccion_local = s.id_seleccion THEN p.goles_visitante
                ELSE p.goles_local
            END
        )) DESC, gf DESC
");
$posiciones->execute([':grupo' => $grupo_sel, ':grupo2' => $grupo_sel]);
$tabla = $posiciones->fetchAll();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Posiciones — Mundial FIFA 2026</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #0a0a2e; color: #eee; }

        header { background: linear-gradient(135deg, #1a1a5e, #c8102e); padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; }
        header h1 { font-size: 1.6rem; }

        nav { background: #111; border-bottom: 2px solid #c8102e; display: flex; }
        nav a { display: block; padding: 14px 24px; color: #ccc; text-decoration: none; font-size: 0.95rem; transition: background 0.2s; }
        nav a:hover, nav a.activo { background: #c8102e; color: #fff; }

        main { max-width: 900px; margin: 30px auto; padding: 0 20px; }
        h2 { color: #ffd700; margin-bottom: 20px; font-size: 1.4rem; }

        .controles { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; }
        select { background: #1e1e5e; color: #eee; border: 1px solid #444; padding: 8px 12px; border-radius: 4px; font-size: 0.9rem; }
        .btn { background: #c8102e; color: #fff; border: none; padding: 8px 18px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
        .btn:hover { background: #a00d24; }

        .grupo-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
        .grupo-tabs a {
            padding: 6px 14px;
            background: #1e1e5e;
            color: #ccc;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.88rem;
            border: 1px solid #2a2a6e;
            transition: background 0.2s;
        }
        .grupo-tabs a:hover { background: #2a2a8e; }
        .grupo-tabs a.activo { background: #c8102e; color: #fff; border-color: #c8102e; }

        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        th { background: #1e1e5e; padding: 10px 14px; text-align: center; color: #aaa; font-weight: normal; }
        th:first-child { text-align: left; }
        td { padding: 10px 14px; border-bottom: 1px solid #1e1e4e; text-align: center; }
        td:first-child { text-align: left; }
        tr:hover td { background: #1a1a4e; }
        tr:nth-child(-n+2) td:first-child { color: #4caf50; font-weight: bold; }

        .pts { font-weight: bold; color: #ffd700; font-size: 1rem; }
        .dif.pos { color: #4caf50; }
        .dif.neg { color: #f66; }
        .dif.neu { color: #aaa; }

        .nota { font-size: 0.78rem; color: #666; margin-top: 12px; }
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
    <a href="resultados.php">Resultados</a>
    <a href="posiciones.php" class="activo">Posiciones</a>
    <a href="goleadores.php">Goleadores</a>
    <a href="fixture.php">Fixture</a>
</nav>

<main>
    <h2>Tabla de posiciones — Grupo <?= htmlspecialchars($grupo_sel) ?></h2>

    <div class="grupo-tabs">
        <?php foreach ($grupos as $g): ?>
            <a href="?grupo=<?= $g['id_grupo'] ?>" class="<?= $g['id_grupo'] === $grupo_sel ? 'activo' : '' ?>">
                <?= htmlspecialchars($g['nombre']) ?>
            </a>
        <?php endforeach; ?>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Selección</th>
                <th title="Partidos Jugados">PJ</th>
                <th title="Ganados">PG</th>
                <th title="Empatados">PE</th>
                <th title="Perdidos">PP</th>
                <th title="Goles a favor">GF</th>
                <th title="Goles en contra">GC</th>
                <th title="Diferencia de goles">DIF</th>
                <th title="Puntos">PTS</th>
            </tr>
        </thead>
        <tbody>
        <?php if (empty($tabla)): ?>
            <tr><td colspan="10" style="color:#666;text-align:center;padding:20px">Sin datos para este grupo.</td></tr>
        <?php else: ?>
            <?php foreach ($tabla as $i => $fila):
                $dif = (int)$fila['gf'] - (int)$fila['gc'];
                $difClass = $dif > 0 ? 'pos' : ($dif < 0 ? 'neg' : 'neu');
            ?>
            <tr>
                <td><?= $i + 1 ?></td>
                <td><?= htmlspecialchars($fila['seleccion']) ?></td>
                <td><?= (int)$fila['pj'] ?></td>
                <td><?= (int)$fila['pg'] ?></td>
                <td><?= (int)$fila['pe'] ?></td>
                <td><?= (int)$fila['pp'] ?></td>
                <td><?= (int)$fila['gf'] ?></td>
                <td><?= (int)$fila['gc'] ?></td>
                <td class="dif <?= $difClass ?>"><?= $dif > 0 ? '+' : '' ?><?= $dif ?></td>
                <td class="pts"><?= (int)$fila['pts'] ?></td>
            </tr>
            <?php endforeach; ?>
        <?php endif; ?>
        </tbody>
    </table>
    <p class="nota">Los datos se calculan en tiempo real a partir de los partidos finalizados. Las dos primeras selecciones avanzan a Octavos de Final.</p>
</main>

<footer>Mundial FIFA 2026 &mdash; Proyecto Aplicaciones Informáticas</footer>
</body>
</html>
