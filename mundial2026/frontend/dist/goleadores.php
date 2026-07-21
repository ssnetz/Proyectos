<?php
require_once __DIR__ . '/config/database.php';

try {
    $pdo = getDB();
} catch (PDOException $e) {
    die('<p class="error">Error de conexión: ' . htmlspecialchars($e->getMessage()) . '</p>');
}

$mensaje = '';
$error   = '';

// Registrar un gol
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['accion']) && $_POST['accion'] === 'registrar_gol') {
    $id_partido  = filter_input(INPUT_POST, 'id_partido',  FILTER_VALIDATE_INT);
    $id_jugador  = filter_input(INPUT_POST, 'id_jugador',  FILTER_VALIDATE_INT);
    $minuto      = filter_input(INPUT_POST, 'minuto',      FILTER_VALIDATE_INT);
    $tipo        = $_POST['tipo'] ?? 'Normal';

    $tipos_validos = ['Normal', 'Penal', 'Autogol', 'Prorroga'];
    if (!$id_partido || $id_partido <= 0) {
        $error = 'ID de partido inválido.';
    } elseif (!$id_jugador || $id_jugador <= 0) {
        $error = 'ID de jugador inválido.';
    } elseif (!$minuto || $minuto < 1 || $minuto > 120) {
        $error = 'El minuto debe estar entre 1 y 120.';
    } elseif (!in_array($tipo, $tipos_validos, true)) {
        $error = 'Tipo de gol no válido.';
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO goles (id_partido, id_jugador, minuto, tipo)
            VALUES (:ip, :ij, :min, :tipo)
        ");
        $stmt->execute([':ip' => $id_partido, ':ij' => $id_jugador, ':min' => $minuto, ':tipo' => $tipo]);
        $mensaje = 'Gol registrado correctamente.';
    }
}

// Top 20 goleadores (excluye autogoles en el conteo de goles propios)
$goleadores = $pdo->query("
    SELECT
        CONCAT(j.nombre, ' ', j.apellido) AS jugador,
        s.nombre                           AS seleccion,
        COUNT(g.id_gol)                    AS goles,
        SUM(g.tipo = 'Penal')              AS penales
    FROM goles g
    JOIN jugadores   j ON j.id_jugador   = g.id_jugador
    JOIN selecciones s ON s.id_seleccion = j.id_seleccion
    WHERE g.tipo <> 'Autogol'
    GROUP BY g.id_jugador, j.nombre, j.apellido, s.nombre
    ORDER BY goles DESC, penales ASC
    LIMIT 20
")->fetchAll();

// Lista de jugadores para el formulario
$jugadores = $pdo->query("
    SELECT j.id_jugador,
           CONCAT(j.nombre, ' ', j.apellido, ' (', s.nombre, ')') AS etiqueta
    FROM jugadores j
    JOIN selecciones s ON s.id_seleccion = j.id_seleccion
    ORDER BY s.nombre, j.apellido
")->fetchAll();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Goleadores — Mundial FIFA 2026</title>
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

        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 30px; }
        th { background: #1e1e5e; padding: 10px 14px; text-align: center; color: #aaa; font-weight: normal; }
        th:nth-child(2), th:nth-child(3) { text-align: left; }
        td { padding: 10px 14px; border-bottom: 1px solid #1e1e4e; text-align: center; }
        td:nth-child(2), td:nth-child(3) { text-align: left; }
        tr:hover td { background: #1a1a4e; }

        .pos-1 td { color: #ffd700; }
        .pos-2 td { color: #c0c0c0; }
        .pos-3 td { color: #cd7f32; }

        .goles-num { font-weight: bold; font-size: 1.1rem; }
        .penales   { color: #888; font-size: 0.85rem; }

        .form-card { background: #13133a; border: 1px solid #2a2a6e; border-radius: 8px; padding: 24px; margin-top: 10px; }
        .form-card h3 { color: #ffd700; margin-bottom: 18px; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        label { font-size: 0.85rem; color: #aaa; }
        input[type="number"], select { background: #0d0d3b; color: #eee; border: 1px solid #444; padding: 8px 10px; border-radius: 4px; font-size: 0.9rem; width: 100%; }
        .btn { background: #c8102e; color: #fff; border: none; padding: 9px 20px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; margin-top: 18px; }
        .btn:hover { background: #a00d24; }
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
    <a href="resultados.php">Resultados</a>
    <a href="posiciones.php">Posiciones</a>
    <a href="goleadores.php" class="activo">Goleadores</a>
    <a href="fixture.php">Fixture</a>
</nav>

<main>
    <h2>Tabla de goleadores</h2>

    <?php if ($mensaje): ?>
        <div class="alerta ok"><?= htmlspecialchars($mensaje) ?></div>
    <?php endif; ?>
    <?php if ($error): ?>
        <div class="alerta err"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <?php if (empty($goleadores)): ?>
        <p style="color:#666;margin-bottom:30px">Aún no hay goles registrados.</p>
    <?php else: ?>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>Selección</th>
                <th>Goles</th>
                <th>De penal</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($goleadores as $i => $g): ?>
            <tr class="<?= $i === 0 ? 'pos-1' : ($i === 1 ? 'pos-2' : ($i === 2 ? 'pos-3' : '')) ?>">
                <td><?= $i + 1 ?></td>
                <td><?= htmlspecialchars($g['jugador']) ?></td>
                <td><?= htmlspecialchars($g['seleccion']) ?></td>
                <td class="goles-num"><?= (int)$g['goles'] ?></td>
                <td class="penales"><?= (int)$g['penales'] ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>

    <div class="form-card">
        <h3>Registrar gol</h3>
        <form method="post">
            <input type="hidden" name="accion" value="registrar_gol">
            <div class="form-grid">
                <div class="form-group">
                    <label for="id_partido">ID de partido</label>
                    <input type="number" id="id_partido" name="id_partido" min="1" required placeholder="Ej: 1">
                </div>
                <div class="form-group">
                    <label for="id_jugador">Jugador</label>
                    <select id="id_jugador" name="id_jugador" required>
                        <option value="">— Seleccioná un jugador —</option>
                        <?php foreach ($jugadores as $j): ?>
                            <option value="<?= $j['id_jugador'] ?>"><?= htmlspecialchars($j['etiqueta']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label for="minuto">Minuto (1-120)</label>
                    <input type="number" id="minuto" name="minuto" min="1" max="120" required placeholder="Ej: 67">
                </div>
                <div class="form-group">
                    <label for="tipo">Tipo de gol</label>
                    <select id="tipo" name="tipo">
                        <option value="Normal">Normal</option>
                        <option value="Penal">Penal</option>
                        <option value="Autogol">Autogol</option>
                        <option value="Prorroga">Prórroga</option>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn">Registrar gol</button>
        </form>
    </div>
</main>

<footer>Mundial FIFA 2026 &mdash; Desarrollado por 6to Año D de Informática &mdash; Escuela Presidente Sarmiento</footer>
</body>
</html>
