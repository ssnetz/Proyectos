<?php
// Protección simple por clave compartida para las acciones de carga
// (cargar resultado, registrar gol). Las tablas siguen siendo públicas y de
// solo lectura para cualquiera; solo estos formularios de escritura quedan
// detrás de esta clave. Se recuerda en el navegador durante 30 días.

session_set_cookie_params(60 * 60 * 24 * 30);
session_start();

function estaAutorizado(): bool {
    return !empty($_SESSION['autorizado']);
}

// Procesa el POST de ingreso de clave, si corresponde. Devuelve un mensaje
// de error para mostrar, o null si no hubo intento o si fue exitoso.
function procesarLoginClave(): ?string {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['accion'] ?? '') === 'ingresar_clave') {
        if (hash_equals(APP_PASSWORD, (string)($_POST['clave'] ?? ''))) {
            $_SESSION['autorizado'] = true;
            return null;
        }
        return 'Clave incorrecta.';
    }
    return null;
}

function formularioClave(?string $error): void { ?>
    <div class="form-card">
        <h3>Ingresá la clave para cargar datos</h3>
        <?php if ($error): ?><div class="alerta err"><?= htmlspecialchars($error) ?></div><?php endif; ?>
        <form method="post" style="max-width:320px">
            <input type="hidden" name="accion" value="ingresar_clave">
            <div class="form-group">
                <label for="clave">Clave</label>
                <input type="password" id="clave" name="clave" required autofocus>
            </div>
            <button type="submit" class="btn" style="margin-top:14px">Ingresar</button>
        </form>
    </div>
<?php }
