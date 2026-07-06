<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

setCorsHeaders();
handleOptions();
requireAuth();

define('QR_SECRET', 'fc_cosquin_qr_2024_#$@!');

$db = getDB();
$id = intval($_GET['id'] ?? 0);
if (!$id) jsonError('id requerido', 400);

$stmt = $db->prepare("
    SELECT fo.*, v.name AS vehicle_name, v.plate
    FROM fuel_orders fo
    JOIN vehicles v ON v.id = fo.vehicle_id
    WHERE fo.id = ?
");
$stmt->execute([$id]);
$o = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$o) jsonError('Orden no encontrada', 404);

// Campos que forman el payload (los mismos que se muestran en el comprobante)
$payload = implode('|', [
    $o['id'],
    $o['vehicle_id'],
    $o['plate'],
    $o['fuel_type'],
    $o['liters_requested'],
    $o['driver_name'],
    $o['status'],
    $o['ordered_at'],
]);

$sig = hash_hmac('sha256', $payload, QR_SECRET);

// URL de verificación pública
$proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host  = $_SERVER['HTTP_HOST'] ?? 'localhost';
$verifyUrl = "$proto://$host/fuel-control/backend/verify.php?id={$o['id']}&sig=" . substr($sig, 0, 32);

jsonResponse([
    'order'      => $o,
    'sig'        => substr($sig, 0, 32),
    'verify_url' => $verifyUrl,
]);
