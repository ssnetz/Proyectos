<?php
require_once __DIR__ . '/config/database.php';

$id  = intval($_GET['id']  ?? 0);
$sig = trim($_GET['sig']   ?? '');

header('Content-Type: text/html; charset=utf-8');

if (!$id || !$sig) {
    showResult(false, null, 'Código QR inválido o incompleto.');
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT fo.*, v.name AS vehicle_name, v.plate
        FROM fuel_orders fo
        JOIN vehicles v ON v.id = fo.vehicle_id
        WHERE fo.id = ?
    ");
    $stmt->execute([$id]);
    $o = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$o) {
        showResult(false, null, 'Orden #' . $id . ' no encontrada en el sistema.');
        exit;
    }

    $payload = implode('|', [
        $o['id'], $o['vehicle_id'], $o['plate'], $o['fuel_type'],
        $o['liters_requested'], $o['driver_name'], $o['status'], $o['ordered_at'],
    ]);
    $expected = substr(hash_hmac('sha256', $payload, QR_SECRET), 0, 32);

    if (!hash_equals($expected, $sig)) {
        showResult(false, $o, 'FIRMA INVÁLIDA — El comprobante fue adulterado o es una falsificación.');
        exit;
    }

    showResult(true, $o, 'Comprobante auténtico y sin modificaciones.');

} catch (Exception $e) {
    showResult(false, null, 'Error al verificar: ' . $e->getMessage());
}

function showResult(bool $ok, ?array $o, string $msg) {
    $color  = $ok ? '#16a34a' : '#dc2626';
    $bg     = $ok ? '#f0fdf4' : '#fef2f2';
    $icon   = $ok ? '✅' : '❌';
    $title  = $ok ? 'COMPROBANTE VÁLIDO' : 'COMPROBANTE INVÁLIDO';
    $fecha  = $o ? date('d/m/Y H:i', strtotime($o['ordered_at'])) : '—';
    $estado = $o['status'] ?? '—';
    $estadoMap = ['pendiente' => 'Pendiente', 'completada' => 'Completada', 'cancelada' => 'Cancelada'];
    echo <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verificación de Orden — Control de Combustible</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.10); max-width: 480px; width: 100%; overflow: hidden; }
  .header { background: $color; color: #fff; padding: 24px; text-align: center; }
  .header .icon { font-size: 48px; }
  .header h1 { font-size: 20px; margin-top: 8px; letter-spacing: 1px; }
  .header p { font-size: 13px; opacity: .85; margin-top: 6px; }
  .body { padding: 24px; background: $bg; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  .row:last-child { border-bottom: none; }
  .label { color: #64748b; }
  .value { font-weight: 600; color: #1e293b; text-align: right; }
  .footer { padding: 14px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  .org { font-weight: 700; color: #1e40af; font-size: 13px; display: block; margin-bottom: 2px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="icon">$icon</div>
    <h1>$title</h1>
    <p>$msg</p>
  </div>
  <div class="body">
HTML;
    if ($o) {
        echo '<div class="row"><span class="label">Orden N°</span><span class="value">#' . $o['id'] . '</span></div>';
        echo '<div class="row"><span class="label">Vehículo</span><span class="value">' . htmlspecialchars($o['vehicle_name']) . '</span></div>';
        echo '<div class="row"><span class="label">Patente</span><span class="value">' . htmlspecialchars($o['plate']) . '</span></div>';
        echo '<div class="row"><span class="label">Tipo combustible</span><span class="value">' . htmlspecialchars($o['fuel_type']) . '</span></div>';
        echo '<div class="row"><span class="label">Litros solicitados</span><span class="value">' . number_format($o['liters_requested'], 2) . ' L</span></div>';
        echo '<div class="row"><span class="label">Chofer</span><span class="value">' . htmlspecialchars($o['driver_name']) . '</span></div>';
        echo '<div class="row"><span class="label">Estado</span><span class="value">' . ($estadoMap[$estado] ?? $estado) . '</span></div>';
        echo '<div class="row"><span class="label">Fecha emisión</span><span class="value">' . $fecha . '</span></div>';
    }
    echo <<<HTML
  </div>
  <div class="footer">
    <span class="org">Municipalidad de Cosquín — Control de Combustible</span>
    Verificación automática mediante firma digital HMAC-SHA256
  </div>
</div>
</body>
</html>
HTML;
}
