<?php
$dsn = 'mysql:host=localhost;dbname=mundial2026;charset=utf8mb4';
$opciones = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];

try {
    $pdo = new PDO($dsn, 'root', '', $opciones);
} catch (PDOException $e) {
    die('<p class="error">Error de conexión: ' . htmlspecialchars($e->getMessage()) . '</p>');
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
           COALESCE(p.id_grupo, '') AS id_grupo
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
    'Programado' => '#555',
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

        header { background: linear-gradient(135deg, #1a1a5e, #c8102e); padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; }
        header h1 { font-size: 1.6rem; }

        nav { background: #111; border-bottom: 2px solid #c8102e; display: flex; }
        nav a { display: block; padding: 14px 24px; color: #ccc; text-decoration: none; font-size: 0.95rem; transition: background 0.2s; }
        nav a:hover, nav a.activo { background: #c8102e; color: #fff; }

        main { max-width: 1100px; margin: 30px auto; padding: 0 20px; }
        h2 { color: #ffd700; margin-bottom: 20px; font-size: 1.4rem; }

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

        table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        th { background: #1e1e5e; padding: 10px 12px; text-align: left; color: #aaa; font-weight: normal; }
        td { padding: 9px 12px; border-bottom: 1px solid #1e1e4e; }
        tr:hover td { background: #1a1a4e; }

        .resultado { font-weight: bold; color: #ffd700; text-align: center; font-size: 1rem; }
        .vs { color: #555; text-align: center; }
        .estado { font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; color: #fff; white-space: nowrap; }
        .fecha { color: #888; font-size: 0.82rem; white-space: nowrap; }
        .sede { color: #777; font-size: 0.82rem; }
        .id { color: #555; font-size: 0.78rem; }

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
    <a href="posiciones.php">Posiciones</a>
    <a href="goleadores.php">Goleadores</a>
    <a href="fixture.php" class="activo">Fixture</a>
</nav>

<main>
    <h2>Fixture completo</h2>

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
                <th>ID</th>
                <th>Fecha</th>
                <th>Local</th>
                <th style="text-align:center">Resultado</th>
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
                <td class="id">#<?= $p['id_partido'] ?></td>
                <td class="fecha"><?= date('d/m/Y H:i', strtotime($p['fecha_hora'])) ?></td>
                <td><?= htmlspecialchars($p['local']) ?></td>
                <td>
                    <?php if ($p['estado'] === 'Finalizado'): ?>
                        <span class="resultado"><?= $p['goles_local'] ?> - <?= $p['goles_visitante'] ?></span>
                    <?php else: ?>
                        <span class="vs">vs</span>
                    <?php endif; ?>
                </td>
                <td><?= htmlspecialchars($p['visitante']) ?></td>
                <td class="sede"><?= htmlspecialchars($p['estadio']) ?><br><?= htmlspecialchars($p['ciudad']) ?></td>
                <td><?= htmlspecialchars($p['fase']) ?></td>
                <td><span class="estado" style="background:<?= $color ?>"><?= htmlspecialchars($p['estado']) ?></span></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</main>

<footer>Mundial FIFA 2026 &mdash; Proyecto Aplicaciones Informáticas</footer>
</body>
</html>
