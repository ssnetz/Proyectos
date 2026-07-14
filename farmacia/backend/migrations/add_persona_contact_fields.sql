-- Agrega datos de contacto y fecha de nacimiento al padrón de personas.
-- La tabla `personas` vive en la base `stock_control` (dueña: farmacia) pero
-- es compartida con turnos-prioritarios, que la usa para identificar al
-- paciente/beneficiario de cada turno. A partir de esta migración,
-- turnos-prioritarios exige estos 3 campos al dar de alta o actualizar una
-- persona (ver backend/api/personas.php de ese proyecto); farmacia no los
-- usa ni los exige, quedan NULL para los ~96.000 registros existentes.
--
-- Ejecutar en el servidor con:
--   mysql -u root -p stock_control < add_persona_contact_fields.sql
--
-- Nota: sin "IF NOT EXISTS" a propósito — MySQL 8.0 estándar (no MariaDB)
-- no soporta esa cláusula en ADD COLUMN. Es una migración de una sola vez;
-- si hay que reejecutarla, comentar la(s) columna(s) que ya existan.

ALTER TABLE personas
  ADD COLUMN fecha_nacimiento DATE NULL AFTER sexo,
  ADD COLUMN email VARCHAR(150) NULL AFTER cuit_cuil,
  ADD COLUMN celular VARCHAR(30) NULL AFTER email;
