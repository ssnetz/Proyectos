-- Migración: agrega mesas.pin, un código de 6 dígitos para que el fiscal
-- entre a la app del celular con "mesa + PIN" en vez de usuario/contraseña.
-- Atado a la mesa (no a la persona): si reemplazan al fiscal a la tarde, el
-- PIN sigue siendo el mismo. Arranca en NULL; el backend lo genera solo la
-- próxima vez que se liste/edite cada mesa (ver mesas.php).

ALTER TABLE mesas ADD COLUMN pin VARCHAR(6) AFTER activo;
ALTER TABLE mesas ADD UNIQUE KEY uk_mesa_pin (pin);
