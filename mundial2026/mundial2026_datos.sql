-- ============================================================
--  DATOS INICIALES: MUNDIAL FIFA 2026
-- ============================================================

USE mundial2026;

-- ------------------------------------------------------------
-- CONFEDERACIONES
-- ------------------------------------------------------------
INSERT INTO confederaciones (nombre, sigla) VALUES
('Confederación Sudamericana de Fútbol',         'CONMEBOL'),
('Unión de Asociaciones Europeas de Fútbol',     'UEFA'),
('Confederación de Fútbol de América del Norte', 'CONCACAF'),
('Confederación Africana de Fútbol',             'CAF'),
('Confederación Asiática de Fútbol',             'AFC'),
('Confederación Oceánica de Fútbol',             'OFC');

-- ------------------------------------------------------------
-- FASES
-- ------------------------------------------------------------
INSERT INTO fases (nombre, orden) VALUES
('Fase de Grupos',  1),
('Octavos de Final',2),
('Cuartos de Final',3),
('Semifinales',     4),
('Tercer Puesto',   5),
('Final',           6);

-- ------------------------------------------------------------
-- GRUPOS (A a L — 12 grupos)
-- ------------------------------------------------------------
INSERT INTO grupos (id_grupo, nombre) VALUES
('A','Grupo A'),('B','Grupo B'),('C','Grupo C'),('D','Grupo D'),
('E','Grupo E'),('F','Grupo F'),('G','Grupo G'),('H','Grupo H'),
('I','Grupo I'),('J','Grupo J'),('K','Grupo K'),('L','Grupo L');

-- ------------------------------------------------------------
-- SEDES
-- ------------------------------------------------------------
INSERT INTO sedes (ciudad, pais, estadio, capacidad) VALUES
('Nueva York / Nueva Jersey', 'EE.UU.',  'MetLife Stadium',          82500),
('Los Ángeles',               'EE.UU.',  'SoFi Stadium',             70240),
('Dallas',                    'EE.UU.',  'AT&T Stadium',             80000),
('San Francisco',             'EE.UU.',  'Levi''s Stadium',          68500),
('Miami',                     'EE.UU.',  'Hard Rock Stadium',        65326),
('Atlanta',                   'EE.UU.',  'Mercedes-Benz Stadium',    71000),
('Seattle',                   'EE.UU.',  'Lumen Field',              69000),
('Houston',                   'EE.UU.',  'NRG Stadium',              72220),
('Kansas City',               'EE.UU.',  'Arrowhead Stadium',        76416),
('Boston',                    'EE.UU.',  'Gillette Stadium',         65878),
('Philadelphia',              'EE.UU.',  'Lincoln Financial Field',  69176),
('Ciudad de México',          'México',  'Estadio Azteca',           87523),
('Monterrey',                 'México',  'Estadio BBVA',             53500),
('Guadalajara',               'México',  'Estadio Akron',            49850),
('Toronto',                   'Canadá',  'BMO Field',                30000),
('Vancouver',                 'Canadá',  'BC Place',                 54500);

-- ------------------------------------------------------------
-- SELECCIONES (ejemplo con 16 selecciones)
-- ------------------------------------------------------------
INSERT INTO selecciones (nombre, codigo_fifa, id_confederacion, entrenador) VALUES
-- CONMEBOL (id=1)
('Argentina',  'ARG', 1, 'Lionel Scaloni'),
('Brasil',     'BRA', 1, 'Dorival Júnior'),
('Uruguay',    'URU', 1, 'Marcelo Bielsa'),
('Colombia',   'COL', 1, 'Néstor Lorenzo'),
('Ecuador',    'ECU', 1, 'Sebastián Beccacece'),
-- UEFA (id=2)
('Francia',    'FRA', 2, 'Didier Deschamps'),
('España',     'ESP', 2, 'Luis de la Fuente'),
('Alemania',   'GER', 2, 'Julian Nagelsmann'),
('Inglaterra', 'ENG', 2, 'Lee Carsley'),
('Portugal',   'POR', 2, 'Roberto Martínez'),
-- CONCACAF (id=3)
('México',     'MEX', 3, 'Javier Aguirre'),
('Estados Unidos','USA',3,'Mauricio Pochettino'),
('Canadá',     'CAN', 3, 'Jesse Marsch'),
-- CAF (id=4)
('Marruecos',  'MAR', 4, 'Walid Regragui'),
('Senegal',    'SEN', 4, 'Aliou Cissé'),
-- AFC (id=5)
('Japón',      'JPN', 5, 'Hajime Moriyasu');

-- ------------------------------------------------------------
-- EJEMPLO DE JUGADORES (Argentina - plantel reducido)
-- ------------------------------------------------------------
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Emiliano',  'Martínez',  '1992-09-02', 'Portero',        1,  1, FALSE),
('Nahuel',    'Molina',    '1998-04-06', 'Defensa',        26, 1, FALSE),
('Cristian',  'Romero',    '1998-04-27', 'Defensa',        13, 1, FALSE),
('Lisandro',  'Martínez',  '1998-01-18', 'Defensa',        14, 1, FALSE),
('Nicolás',   'Tagliafico','1992-08-31', 'Defensa',        3,  1, FALSE),
('Rodrigo',   'De Paul',   '1994-05-24', 'Mediocampista',  7,  1, FALSE),
('Enzo',      'Fernández', '2001-01-17', 'Mediocampista',  24, 1, FALSE),
('Alexis',    'Mac Allister','1998-12-24','Mediocampista', 20, 1, FALSE),
('Lionel',    'Messi',     '1987-06-24', 'Delantero',      10, 1, TRUE),
('Lautaro',   'Martínez',  '1997-08-22', 'Delantero',      22, 1, FALSE),
('Julián',    'Álvarez',   '2000-01-31', 'Delantero',      9,  1, FALSE);

-- ------------------------------------------------------------
-- EJEMPLO DE PARTIDOS (Fase de Grupos - Grupo A)
-- ------------------------------------------------------------
INSERT INTO partidos
    (id_fase, id_grupo, id_sede, id_seleccion_local, id_seleccion_visit,
     fecha_hora, estado)
VALUES
(1, 'A', 12, 12, 6,  '2026-06-11 20:00:00', 'Programado'),  -- USA vs Francia
(1, 'A', 1,  9,  10, '2026-06-12 17:00:00', 'Programado'),  -- Inglaterra vs Portugal
(1, 'A', 4,  12, 10, '2026-06-16 17:00:00', 'Programado'),  -- USA vs Portugal
(1, 'A', 12, 6,  9,  '2026-06-16 20:00:00', 'Programado');  -- Francia vs Inglaterra
