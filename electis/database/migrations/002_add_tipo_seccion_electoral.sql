-- Migración: agrega los datos que faltan para poder imprimir el padrón por
-- mesa en hoja oficio (comprobante de emisión de voto).
--
-- - electores.tipo: tipo de documento tal como lo trae el padrón oficial
--   (DNI-EA, DNI-EB, DNI-EC...). No pisa nada existente, arranca en NULL.
-- - municipios.seccion_electoral: sección electoral provincial (ej.
--   "12-Punilla"). El "distrito" del padrón impreso se toma de
--   municipios.provincia (ya existe); el circuito ya es por establecimiento
--   (establecimientos.circuito, ya existe).
--
-- Backup antes de correr, como siempre.

ALTER TABLE electores ADD COLUMN tipo VARCHAR(10) AFTER documento;

ALTER TABLE municipios ADD COLUMN seccion_electoral VARCHAR(100) AFTER provincia;

-- Opcional: completar la sección electoral de los municipios existentes.
-- Reemplazá los valores según corresponda a cada uno.
-- UPDATE municipios SET seccion_electoral = '12-Punilla' WHERE nombre = 'Cosquín';
