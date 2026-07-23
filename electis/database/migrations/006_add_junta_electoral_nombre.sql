-- Migración: agrega municipios.junta_electoral_nombre, el texto que
-- encabeza el troquel de la Constancia de Emisión de Voto ("JUNTA ELECTORAL
-- MUNICIPAL"). Antes estaba fijo en el código; ahora es editable por
-- municipio desde la pantalla de Configuración, para reusarse en la
-- constancia y en las próximas actas que necesiten el mismo encabezado.
-- Arranca con el texto que ya se venía mostrando, para no cambiar nada en
-- los municipios ya cargados.

ALTER TABLE municipios ADD COLUMN junta_electoral_nombre VARCHAR(150) NOT NULL DEFAULT 'JUNTA ELECTORAL MUNICIPAL' AFTER seccion_electoral;
