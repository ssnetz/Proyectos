-- ============================================================
-- MIGRACIÓN: Categoría Psicotrópicos
-- Hospital Dr. Armando Cima
--
-- CÓMO EJECUTAR EN phpMyAdmin:
--   1. Seleccioná la base 'stock_control' en el panel izquierdo
--   2. Pestaña 'SQL'
--   3. Pegá TODO el contenido de este archivo
--   4. Clic en 'Continuar'
-- ============================================================

USE stock_control;

-- Crear categoría Psicotrópicos
INSERT IGNORE INTO categories (name, description)
VALUES ('Psicotrópicos', 'Medicamentos psicotrópicos de dispensación controlada');

-- ── Benzodiazepinas ──────────────────────────────────────────────────
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Psicotrópicos')
WHERE code IN (
  'MED-034',  -- Clonazepam 1 mg
  'MED-035',  -- Clonazepam 2 mg
  'MED-059',  -- Lorazepam sublingual 1 mg
  'REM-432',  -- Diazepam 10 mg Comp.
  'INS-155',  -- Diazepam 10 mg/2 ml (inyectable)
  'INS-174',  -- Lorazepam 4 mg/ml (inyectable)
  'INS-176'   -- Midazolam 15 mg/3 ml (inyectable)
);

-- ── Antipsicóticos ───────────────────────────────────────────────────
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Psicotrópicos')
WHERE code IN (
  'MED-079',  -- Risperidona 2 mg
  'REM-433',  -- Risperidona 1 mg
  'REM-434',  -- Risperidona 2 mg
  'REM-467',  -- Haloperidol 5 mg
  'REM-474',  -- Haloperidol 10 mg
  'REM-431',  -- Biperideno 2 mg
  'INS-171'   -- Levomepromazina 25 mg/ml (inyectable)
);

-- ── Antidepresivos ───────────────────────────────────────────────────
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Psicotrópicos')
WHERE code IN (
  'MED-083',  -- Sertralina 100 mg
  'REM-435',  -- Escitalopram 20 mg
  'REM-375'   -- Sertralina 50 mg
);

SELECT CONCAT('Psicotrópicos cargados: ', COUNT(*), ' medicamentos') AS resultado
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE c.name = 'Psicotrópicos';
