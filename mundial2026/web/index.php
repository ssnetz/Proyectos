<?php
$dsn = 'mysql:host=localhost;dbname=mundial2026;charset=utf8mb4';
$opciones = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];

try {
    $pdo = new PDO($dsn, 'root', '', $opciones);
} catch (PDOException $e) {
    die('<p class="error">Error de conexión: ' . htmlspecialchars($e->getMessage()) . '</p>');
}

$proximos = $pdo->query("
    SELECT p.fecha_hora, l.nombre AS local, v.nombre AS visitante, s.estadio, s.ciudad
    FROM partidos p
    JOIN selecciones l ON l.id_seleccion = p.id_seleccion_local
    JOIN selecciones v ON v.id_seleccion = p.id_seleccion_visit
    JOIN sedes s ON s.id_sede = p.id_sede
    WHERE p.estado = 'Programado'
    ORDER BY p.fecha_hora ASC
    LIMIT 5
")->fetchAll();

$ultimos = $pdo->query("
    SELECT p.fecha_hora, l.nombre AS local, p.goles_local, p.goles_visitante,
           v.nombre AS visitante, s.estadio, f.nombre AS fase
    FROM partidos p
    JOIN selecciones l ON l.id_seleccion = p.id_seleccion_local
    JOIN selecciones v ON v.id_seleccion = p.id_seleccion_visit
    JOIN sedes s ON s.id_sede = p.id_sede
    JOIN fases f ON f.id_fase = p.id_fase
    WHERE p.estado = 'Finalizado'
    ORDER BY p.fecha_hora DESC
    LIMIT 5
")->fetchAll();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mundial FIFA 2026</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #0a0a2e; color: #eee; }

        header {
            background: linear-gradient(135deg, #1a1a5e, #c8102e);
            padding: 20px 40px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        header h1 { font-size: 1.6rem; letter-spacing: 1px; }
        header span { font-size: 0.9rem; opacity: 0.8; }

        nav {
            background: #111;
            border-bottom: 2px solid #c8102e;
            display: flex;
            gap: 0;
        }
        nav a {
            display: block;
            padding: 14px 24px;
            color: #ccc;
            text-decoration: none;
            font-size: 0.95rem;
            transition: background 0.2s, color 0.2s;
        }
        nav a:hover, nav a.activo { background: #c8102e; color: #fff; }

        main { max-width: 1100px; margin: 30px auto; padding: 0 20px; }

        .hero {
            text-align: center;
            padding: 40px 20px;
            background: linear-gradient(135deg, #1a1a5e 0%, #0d0d3b 100%);
            border-radius: 10px;
            margin-bottom: 30px;
            border: 1px solid #2a2a7e;
        }
        .hero h2 { font-size: 2rem; margin-bottom: 8px; color: #ffd700; }
        .hero p { color: #aaa; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }

        .card {
            background: #13133a;
            border-radius: 8px;
            border: 1px solid #2a2a6e;
            overflow: hidden;
        }
        .card-header {
            background: #1e1e5e;
            padding: 12px 18px;
            font-weight: bold;
            font-size: 1rem;
            border-bottom: 2px solid #c8102e;
            color: #ffd700;
        }

        table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        th { background: #0d0d3b; padding: 9px 12px; text-align: left; color: #aaa; font-weight: normal; }
        td { padding: 9px 12px; border-bottom: 1px solid #1e1e4e; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #1a1a4e; }

        .resultado { text-align: center; font-weight: bold; font-size: 1.1rem; color: #ffd700; }
        .fecha { color: #888; font-size: 0.82rem; }
        .sede { color: #777; font-size: 0.82rem; }

        footer { text-align: center; padding: 24px; color: #555; font-size: 0.82rem; margin-top: 40px; }
        .error { color: #f66; background: #300; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>

<header>
    <h1>⚽ Mundial FIFA 2026</h1>
    <span>EE.UU. · Canadá · México</span>
</header>

<nav>
    <a href="index.php" class="activo">Inicio</a>
    <a href="resultados.php">Resultados</a>
    <a href="posiciones.php">Posiciones</a>
    <a href="goleadores.php">Goleadores</a>
    <a href="fixture.php">Fixture</a>
</nav>

<main>
    <div class="hero">
        <h2>Mundial FIFA 2026</h2>
        <p>11 de junio — 19 de julio de 2026 &nbsp;|&nbsp; 48 selecciones &nbsp;|&nbsp; 16 sedes</p>
    </div>

    <div class="grid">
        <div class="card">
            <div class="card-header">Próximos partidos</div>
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Partido</th>
                        <th>Sede</th>
                    </tr>
                </thead>
                <tbody>
                <?php if (empty($proximos)): ?>
                    <tr><td colspan="3" style="color:#666;text-align:center">Sin partidos programados</td></tr>
                <?php else: ?>
                    <?php foreach ($proximos as $p): ?>
                    <tr>
                        <td class="fecha"><?= date('d/m H:i', strtotime($p['fecha_hora'])) ?></td>
                        <td><?= htmlspecialchars($p['local']) ?> <strong>vs</strong> <?= htmlspecialchars($p['visitante']) ?></td>
                        <td class="sede"><?= htmlspecialchars($p['ciudad']) ?></td>
                    </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
                </tbody>
            </table>
        </div>

        <div class="card">
            <div class="card-header">Últimos resultados</div>
            <table>
                <thead>
                    <tr>
                        <th>Partido</th>
                        <th>Res.</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>
                <?php if (empty($ultimos)): ?>
                    <tr><td colspan="3" style="color:#666;text-align:center">Sin resultados aún</td></tr>
                <?php else: ?>
                    <?php foreach ($ultimos as $p): ?>
                    <tr>
                        <td><?= htmlspecialchars($p['local']) ?> vs <?= htmlspecialchars($p['visitante']) ?></td>
                        <td class="resultado"><?= $p['goles_local'] ?> - <?= $p['goles_visitante'] ?></td>
                        <td class="fecha"><?= date('d/m', strtotime($p['fecha_hora'])) ?></td>
                    </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</main>

<footer>Mundial FIFA 2026 &mdash; Proyecto Aplicaciones Informáticas</footer>

</body>
</html>
