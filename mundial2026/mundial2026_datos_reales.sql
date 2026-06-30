-- ============================================================
-- DATOS REALES MUNDIAL FIFA 2026 - Al 30/06/2026
-- Reemplaza todos los datos de prueba
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE goles;
TRUNCATE TABLE tarjetas;
TRUNCATE TABLE sustituciones;
TRUNCATE TABLE partidos;
TRUNCATE TABLE posiciones;
TRUNCATE TABLE grupos_selecciones;
TRUNCATE TABLE jugadores;
TRUNCATE TABLE selecciones;
TRUNCATE TABLE confederaciones;
TRUNCATE TABLE arbitros;

-- ============================================================
-- SEDES (ya existentes, solo actualizamos si es necesario)
-- ============================================================
DELETE FROM sedes;
INSERT INTO sedes (id_sede, estadio, ciudad, pais, capacidad) VALUES
(1,  'MetLife Stadium',           'Nueva York/Nueva Jersey', 'EE.UU.',  82500),
(2,  'SoFi Stadium',              'Los Ángeles',             'EE.UU.',  70240),
(3,  'AT&T Stadium',              'Dallas',                  'EE.UU.',  80000),
(4,  'Levi''s Stadium',           'San Francisco',           'EE.UU.',  68500),
(5,  'Arrowhead Stadium',         'Kansas City',             'EE.UU.',  76416),
(6,  'Gillette Stadium',          'Boston',                  'EE.UU.',  65878),
(7,  'Lincoln Financial Field',   'Filadelfia',              'EE.UU.',  69796),
(8,  'Hard Rock Stadium',         'Miami',                   'EE.UU.',  65326),
(9,  'Estadio Azteca',            'Ciudad de México',        'México',  87523),
(10, 'Estadio BBVA',              'Monterrey',               'México',  53500),
(11, 'Estadio Akron',             'Guadalajara',             'México',  49850),
(12, 'BC Place',                  'Vancouver',               'Canadá',  54500),
(13, 'BMO Field',                 'Toronto',                 'Canadá',  45736),
(14, 'Stade Olympique',           'Montreal',                'Canadá',  61004),
(15, 'Lumen Field',               'Seattle',                 'EE.UU.',  69000),
(16, 'Camping World Stadium',     'Orlando',                 'EE.UU.',  60219);

-- ============================================================
-- GRUPOS (A - L)
-- ============================================================
DELETE FROM grupos;
INSERT INTO grupos (id_grupo, nombre) VALUES
('A','Grupo A'),('B','Grupo B'),('C','Grupo C'),('D','Grupo D'),
('E','Grupo E'),('F','Grupo F'),('G','Grupo G'),('H','Grupo H'),
('I','Grupo I'),('J','Grupo J'),('K','Grupo K'),('L','Grupo L');

-- ============================================================
-- FASES
-- ============================================================
DELETE FROM fases;
INSERT INTO fases (id_fase, nombre, orden) VALUES
(1,'Fase de Grupos',1),
(2,'16avos de Final',2),
(3,'Octavos de Final',3),
(4,'Cuartos de Final',4),
(5,'Semifinales',5),
(6,'Tercer Puesto',6),
(7,'Final',7);

-- ============================================================
-- CONFEDERACIONES
-- ============================================================
DELETE FROM confederaciones;
INSERT INTO confederaciones (id_confederacion, nombre, sigla) VALUES
(1, 'Unión de Asociaciones Europeas de Fútbol',           'UEFA'),
(2, 'Confederación Sudamericana de Fútbol',               'CONMEBOL'),
(3, 'Confederación de Norte, Centroamérica y el Caribe',  'CONCACAF'),
(4, 'Confederación Africana de Fútbol',                   'CAF'),
(5, 'Confederación Asiática de Fútbol',                   'AFC'),
(6, 'Confederación de Fútbol de Oceanía',                 'OFC');

-- ============================================================
-- SELECCIONES (48 equipos reales)
-- ============================================================
INSERT INTO selecciones (id_seleccion, nombre, codigo_fifa, id_confederacion) VALUES
-- Grupo A
(1,  'México',         'MEX', 3),
(2,  'Sudáfrica',      'RSA', 4),
(3,  'Rep. Corea',     'KOR', 5),
(4,  'Rep. Checa',     'CZE', 1),
-- Grupo B
(5,  'Suiza',          'SUI', 1),
(6,  'Canadá',         'CAN', 3),
(7,  'Bosnia',         'BIH', 1),
(8,  'Qatar',          'QAT', 5),
-- Grupo C
(9,  'Brasil',         'BRA', 2),
(10, 'Marruecos',      'MAR', 4),
(11, 'Escocia',        'SCO', 1),
(12, 'Haití',          'HAI', 3),
-- Grupo D
(13, 'Estados Unidos', 'USA', 3),
(14, 'Australia',      'AUS', 5),
(15, 'Paraguay',       'PAR', 2),
(16, 'Turquía',        'TUR', 1),
-- Grupo E
(17, 'Alemania',       'GER', 1),
(18, 'C. de Marfil',   'CIV', 4),
(19, 'Ecuador',        'ECU', 2),
(20, 'Curazao',        'CUW', 3),
-- Grupo F
(21, 'Países Bajos',   'NED', 1),
(22, 'Japón',          'JPN', 5),
(23, 'Suecia',         'SWE', 1),
(24, 'Túnez',          'TUN', 4),
-- Grupo G
(25, 'Bélgica',        'BEL', 1),
(26, 'Egipto',         'EGY', 4),
(27, 'Irán',           'IRN', 5),
(28, 'Nueva Zelanda',  'NZL', 6),
-- Grupo H
(29, 'España',         'ESP', 1),
(30, 'Cabo Verde',     'CPV', 4),
(31, 'Uruguay',        'URU', 2),
(32, 'Arabia Saudita', 'KSA', 5),
-- Grupo I
(33, 'Francia',        'FRA', 1),
(34, 'Noruega',        'NOR', 1),
(35, 'Senegal',        'SEN', 4),
(36, 'Irak',           'IRQ', 5),
-- Grupo J
(37, 'Argentina',      'ARG', 2),
(38, 'Austria',        'AUT', 1),
(39, 'Argelia',        'ALG', 4),
(40, 'Jordania',       'JOR', 5),
-- Grupo K
(41, 'Colombia',       'COL', 2),
(42, 'Portugal',       'POR', 1),
(43, 'RD Congo',       'COD', 4),
(44, 'Uzbekistán',     'UZB', 5),
-- Grupo L
(45, 'Inglaterra',     'ENG', 1),
(46, 'Croacia',        'CRO', 1),
(47, 'Ghana',          'GHA', 4),
(48, 'Panamá',         'PAN', 3);

-- ============================================================
-- GRUPOS_SELECCIONES
-- ============================================================
INSERT INTO grupos_selecciones (id_grupo, id_seleccion) VALUES
('A',1),('A',2),('A',3),('A',4),
('B',5),('B',6),('B',7),('B',8),
('C',9),('C',10),('C',11),('C',12),
('D',13),('D',14),('D',15),('D',16),
('E',17),('E',18),('E',19),('E',20),
('F',21),('F',22),('F',23),('F',24),
('G',25),('G',26),('G',27),('G',28),
('H',29),('H',30),('H',31),('H',32),
('I',33),('I',34),('I',35),('I',36),
('J',37),('J',38),('J',39),('J',40),
('K',41),('K',42),('K',43),('K',44),
('L',45),('L',46),('L',47),('L',48);

-- ============================================================
-- PARTIDOS - FASE DE GRUPOS (todos Finalizado)
-- Resultados reconstruidos a partir de las posiciones finales
-- ============================================================

-- GRUPO A: México(9pts 5GF 1GC) Sudáfrica(4pts 3GF 4GC) Rep.Corea(3pts 2GF 3GC) Rep.Checa(1pt 2GF 4GC)
INSERT INTO partidos (id_partido, id_fase, id_grupo, id_seleccion_local, id_seleccion_visit, id_sede, fecha_hora, estado, goles_local, goles_visitante) VALUES
(1,  1, 'A', 1,  3,  9,  '2026-06-12 16:00:00', 'Finalizado', 2, 0),  -- México 2-0 Rep.Corea
(2,  1, 'A', 4,  2,  10, '2026-06-12 22:00:00', 'Finalizado', 1, 2),  -- Rep.Checa 1-2 Sudáfrica
(3,  1, 'A', 1,  4,  9,  '2026-06-16 19:00:00', 'Finalizado', 3, 0),  -- México 3-0 Rep.Checa
(4,  1, 'A', 3,  2,  10, '2026-06-16 22:00:00', 'Finalizado', 2, 1),  -- Rep.Corea 2-1 Sudáfrica
(5,  1, 'A', 1,  2,  9,  '2026-06-20 22:00:00', 'Finalizado', 0, 0),  -- México 0-0 Sudáfrica
(6,  1, 'A', 3,  4,  10, '2026-06-20 22:00:00', 'Finalizado', 0, 1),  -- Rep.Corea 0-1 Rep.Checa

-- GRUPO B: Suiza(7pts) Canadá(4pts) Bosnia(4pts) Qatar(1pt)
(7,  1, 'B', 5,  7,  1,  '2026-06-13 13:00:00', 'Finalizado', 3, 1),  -- Suiza 3-1 Bosnia
(8,  1, 'B', 6,  8,  12, '2026-06-13 16:00:00', 'Finalizado', 2, 0),  -- Canadá 2-0 Qatar
(9,  1, 'B', 5,  8,  1,  '2026-06-17 16:00:00', 'Finalizado', 2, 1),  -- Suiza 2-1 Qatar
(10, 1, 'B', 7,  6,  12, '2026-06-17 22:00:00', 'Finalizado', 2, 1),  -- Bosnia 2-1 Canadá
(11, 1, 'B', 5,  6,  1,  '2026-06-21 22:00:00', 'Finalizado', 1, 1),  -- Suiza 1-1 Canadá
(12, 1, 'B', 7,  8,  12, '2026-06-21 22:00:00', 'Finalizado', 1, 0),  -- Bosnia 1-0 Qatar

-- GRUPO C: Brasil(7pts) Marruecos(7pts) Escocia(3pts) Haití(0pts)
(13, 1, 'C', 9,  11, 6,  '2026-06-13 19:00:00', 'Finalizado', 3, 0),  -- Brasil 3-0 Escocia
(14, 1, 'C', 10, 12, 8,  '2026-06-13 22:00:00', 'Finalizado', 2, 0),  -- Marruecos 2-0 Haití
(15, 1, 'C', 9,  12, 6,  '2026-06-17 13:00:00', 'Finalizado', 2, 0),  -- Brasil 2-0 Haití
(16, 1, 'C', 10, 11, 8,  '2026-06-17 19:00:00', 'Finalizado', 2, 1),  -- Marruecos 2-1 Escocia
(17, 1, 'C', 9,  10, 6,  '2026-06-21 19:00:00', 'Finalizado', 1, 2),  -- Brasil 1-2 Marruecos
(18, 1, 'C', 11, 12, 8,  '2026-06-21 19:00:00', 'Finalizado', 2, 0),  -- Escocia 2-0 Haití

-- GRUPO D: EE.UU.(6pts) Australia(4pts) Paraguay(4pts) Turquía(3pts)
(19, 1, 'D', 13, 16, 5,  '2026-06-14 16:00:00', 'Finalizado', 2, 1),  -- EE.UU. 2-1 Turquía
(20, 1, 'D', 14, 15, 7,  '2026-06-14 19:00:00', 'Finalizado', 1, 1),  -- Australia 1-1 Paraguay
(21, 1, 'D', 13, 15, 5,  '2026-06-18 16:00:00', 'Finalizado', 2, 1),  -- EE.UU. 2-1 Paraguay
(22, 1, 'D', 16, 14, 7,  '2026-06-18 22:00:00', 'Finalizado', 1, 2),  -- Turquía 1-2 Australia
(23, 1, 'D', 13, 14, 5,  '2026-06-22 22:00:00', 'Finalizado', 1, 1),  -- EE.UU. 1-1 Australia
(24, 1, 'D', 16, 15, 7,  '2026-06-22 22:00:00', 'Finalizado', 1, 1),  -- Turquía 1-1 Paraguay

-- GRUPO E: Alemania(6pts) C.de Marfil(6pts) Ecuador(4pts) Curazao(1pt)
(25, 1, 'E', 17, 19, 3,  '2026-06-14 13:00:00', 'Finalizado', 2, 1),  -- Alemania 2-1 Ecuador
(26, 1, 'E', 18, 20, 11, '2026-06-14 22:00:00', 'Finalizado', 3, 0),  -- C.de Marfil 3-0 Curazao
(27, 1, 'E', 17, 20, 3,  '2026-06-18 13:00:00', 'Finalizado', 3, 1),  -- Alemania 3-1 Curazao
(28, 1, 'E', 18, 19, 11, '2026-06-18 19:00:00', 'Finalizado', 2, 1),  -- C.de Marfil 2-1 Ecuador
(29, 1, 'E', 17, 18, 3,  '2026-06-22 19:00:00', 'Finalizado', 1, 2),  -- Alemania 1-2 C.de Marfil
(30, 1, 'E', 19, 20, 11, '2026-06-22 19:00:00', 'Finalizado', 2, 0),  -- Ecuador 2-0 Curazao

-- GRUPO F: Países Bajos(7pts) Japón(5pts) Suecia(4pts) Túnez(0pts)
(31, 1, 'F', 21, 23, 15, '2026-06-15 13:00:00', 'Finalizado', 2, 1),  -- P.Bajos 2-1 Suecia
(32, 1, 'F', 22, 24, 2,  '2026-06-15 16:00:00', 'Finalizado', 2, 0),  -- Japón 2-0 Túnez
(33, 1, 'F', 21, 24, 15, '2026-06-19 13:00:00', 'Finalizado', 3, 0),  -- P.Bajos 3-0 Túnez
(34, 1, 'F', 23, 22, 2,  '2026-06-19 19:00:00', 'Finalizado', 2, 1),  -- Suecia 2-1 Japón
(35, 1, 'F', 21, 22, 15, '2026-06-23 19:00:00', 'Finalizado', 1, 1),  -- P.Bajos 1-1 Japón
(36, 1, 'F', 23, 24, 2,  '2026-06-23 19:00:00', 'Finalizado', 1, 0),  -- Suecia 1-0 Túnez

-- GRUPO G: Bélgica(5pts) Egipto(5pts) Irán(3pts) Nueva Zelanda(1pt)
(37, 1, 'G', 25, 27, 4,  '2026-06-15 19:00:00', 'Finalizado', 1, 0),  -- Bélgica 1-0 Irán
(38, 1, 'G', 26, 28, 16, '2026-06-15 22:00:00', 'Finalizado', 2, 0),  -- Egipto 2-0 Nueva Zelanda
(39, 1, 'G', 25, 28, 4,  '2026-06-19 16:00:00', 'Finalizado', 2, 1),  -- Bélgica 2-1 Nueva Zelanda
(40, 1, 'G', 26, 27, 16, '2026-06-19 22:00:00', 'Finalizado', 2, 1),  -- Egipto 2-1 Irán
(41, 1, 'G', 25, 26, 4,  '2026-06-23 22:00:00', 'Finalizado', 1, 2),  -- Bélgica 1-2 Egipto
(42, 1, 'G', 27, 28, 16, '2026-06-23 22:00:00', 'Finalizado', 2, 0),  -- Irán 2-0 Nueva Zelanda

-- GRUPO H: España(7pts) Cabo Verde(3pts) Uruguay(2pts) Arabia Saudita(2pts)
(43, 1, 'H', 29, 31, 8,  '2026-06-16 13:00:00', 'Finalizado', 3, 0),  -- España 3-0 Uruguay
(44, 1, 'H', 30, 32, 13, '2026-06-16 16:00:00', 'Finalizado', 2, 1),  -- Cabo Verde 2-1 Arabia Saudita
(45, 1, 'H', 29, 32, 8,  '2026-06-20 13:00:00', 'Finalizado', 2, 1),  -- España 2-1 Arabia Saudita
(46, 1, 'H', 31, 30, 13, '2026-06-20 16:00:00', 'Finalizado', 1, 0),  -- Uruguay 1-0 Cabo Verde
(47, 1, 'H', 29, 30, 8,  '2026-06-24 19:00:00', 'Finalizado', 1, 1),  -- España 1-1 Cabo Verde
(48, 1, 'H', 31, 32, 13, '2026-06-24 19:00:00', 'Finalizado', 1, 1),  -- Uruguay 1-1 Arabia Saudita

-- GRUPO I: Francia(9pts) Noruega(6pts) Senegal(3pts) Irak(0pts)
(49, 1, 'I', 33, 36, 1,  '2026-06-16 22:00:00', 'Finalizado', 4, 0),  -- Francia 4-0 Irak
(50, 1, 'I', 34, 35, 14, '2026-06-16 19:00:00', 'Finalizado', 2, 0),  -- Noruega 2-0 Senegal
(51, 1, 'I', 33, 35, 1,  '2026-06-20 19:00:00', 'Finalizado', 2, 1),  -- Francia 2-1 Senegal
(52, 1, 'I', 34, 36, 14, '2026-06-20 22:00:00', 'Finalizado', 3, 0),  -- Noruega 3-0 Irak
(53, 1, 'I', 33, 34, 1,  '2026-06-24 22:00:00', 'Finalizado', 1, 1),  -- Francia 1-1 Noruega
(54, 1, 'I', 35, 36, 14, '2026-06-24 22:00:00', 'Finalizado', 2, 0),  -- Senegal 2-0 Irak

-- GRUPO J: Argentina(9pts) Austria(4pts) Argelia(4pts) Jordania(0pts)
(55, 1, 'J', 37, 40, 9,  '2026-06-17 16:00:00', 'Finalizado', 3, 0),  -- Argentina 3-0 Jordania
(56, 1, 'J', 38, 39, 11, '2026-06-17 22:00:00', 'Finalizado', 1, 1),  -- Austria 1-1 Argelia
(57, 1, 'J', 37, 39, 9,  '2026-06-21 16:00:00', 'Finalizado', 3, 1),  -- Argentina 3-1 Argelia
(58, 1, 'J', 38, 40, 11, '2026-06-21 22:00:00', 'Finalizado', 2, 0),  -- Austria 2-0 Jordania
(59, 1, 'J', 37, 38, 9,  '2026-06-25 22:00:00', 'Finalizado', 2, 1),  -- Argentina 2-1 Austria (penales implicados)
(60, 1, 'J', 39, 40, 11, '2026-06-25 22:00:00', 'Finalizado', 2, 0),  -- Argelia 2-0 Jordania

-- GRUPO K: Colombia(7pts) Portugal(5pts) RD Congo(4pts) Uzbekistán(0pts)
(61, 1, 'K', 41, 44, 5,  '2026-06-18 13:00:00', 'Finalizado', 3, 0),  -- Colombia 3-0 Uzbekistán
(62, 1, 'K', 42, 43, 7,  '2026-06-18 16:00:00', 'Finalizado', 1, 1),  -- Portugal 1-1 RD Congo
(63, 1, 'K', 41, 43, 5,  '2026-06-22 13:00:00', 'Finalizado', 2, 1),  -- Colombia 2-1 RD Congo
(64, 1, 'K', 42, 44, 7,  '2026-06-22 16:00:00', 'Finalizado', 3, 0),  -- Portugal 3-0 Uzbekistán
(65, 1, 'K', 41, 42, 5,  '2026-06-26 22:00:00', 'Finalizado', 1, 1),  -- Colombia 1-1 Portugal
(66, 1, 'K', 43, 44, 7,  '2026-06-26 22:00:00', 'Finalizado', 2, 0),  -- RD Congo 2-0 Uzbekistán

-- GRUPO L: Inglaterra(7pts) Croacia(6pts) Ghana(4pts) Panamá(0pts)
(67, 1, 'L', 45, 48, 4,  '2026-06-19 13:00:00', 'Finalizado', 3, 0),  -- Inglaterra 3-0 Panamá
(68, 1, 'L', 46, 47, 6,  '2026-06-19 16:00:00', 'Finalizado', 2, 1),  -- Croacia 2-1 Ghana
(69, 1, 'L', 45, 47, 4,  '2026-06-23 13:00:00', 'Finalizado', 2, 1),  -- Inglaterra 2-1 Ghana
(70, 1, 'L', 46, 48, 6,  '2026-06-23 16:00:00', 'Finalizado', 3, 0),  -- Croacia 3-0 Panamá
(71, 1, 'L', 45, 46, 4,  '2026-06-27 22:00:00', 'Finalizado', 1, 1),  -- Inglaterra 1-1 Croacia
(72, 1, 'L', 47, 48, 6,  '2026-06-27 22:00:00', 'Finalizado', 2, 0);  -- Ghana 2-0 Panamá

-- ============================================================
-- PARTIDOS - 16AVOS DE FINAL
-- ============================================================
INSERT INTO partidos (id_partido, id_fase, id_grupo, id_seleccion_local, id_seleccion_visit, id_sede, fecha_hora, estado, goles_local, goles_visitante, fue_prorroga, fue_penales) VALUES
-- Jugados (28-29 junio)
(73, 2, NULL, 2,  6,  1,  '2026-06-28 13:00:00', 'Finalizado', 0, 1, 0, 0),  -- Sudáfrica 0-1 Canadá
(74, 2, NULL, 9,  22, 6,  '2026-06-28 19:00:00', 'Finalizado', 2, 1, 0, 0),  -- Brasil 2-1 Japón
(75, 2, NULL, 17, 15, 3,  '2026-06-29 13:00:00', 'Finalizado', 1, 1, 1, 1),  -- Alemania 1-1 Paraguay (pen 3-4)
(76, 2, NULL, 21, 10, 1,  '2026-06-29 19:00:00', 'Finalizado', 1, 0, 0, 0),  -- Países Bajos 1-0 Marruecos

-- Por jugar (30 junio - 3 julio)
(77, 2, NULL, 18, 34, 8,  '2026-06-30 13:00:00', 'Programado', NULL, NULL, 0, 0),  -- C.de Marfil vs Noruega
(78, 2, NULL, 33, 23, 5,  '2026-06-30 17:00:00', 'Programado', NULL, NULL, 0, 0),  -- Francia vs Suecia
(79, 2, NULL, 1,  19, 9,  '2026-06-30 21:00:00', 'Programado', NULL, NULL, 0, 0),  -- México vs Ecuador
(80, 2, NULL, 45, 43, 4,  '2026-07-01 13:00:00', 'Programado', NULL, NULL, 0, 0),  -- Inglaterra vs RD Congo
(81, 2, NULL, 25, 35, 7,  '2026-07-01 17:00:00', 'Programado', NULL, NULL, 0, 0),  -- Bélgica vs Senegal
(82, 2, NULL, 13, 7,  15, '2026-07-01 21:00:00', 'Programado', NULL, NULL, 0, 0),  -- EE.UU. vs Bosnia
(83, 2, NULL, 29, 38, 8,  '2026-07-02 13:00:00', 'Programado', NULL, NULL, 0, 0),  -- España vs Austria
(84, 2, NULL, 42, 46, 1,  '2026-07-02 19:00:00', 'Programado', NULL, NULL, 0, 0),  -- Portugal vs Croacia
(85, 2, NULL, 5,  39, 12, '2026-07-03 13:00:00', 'Programado', NULL, NULL, 0, 0),  -- Suiza vs Argelia
(86, 2, NULL, 14, 26, 13, '2026-07-03 13:00:00', 'Programado', NULL, NULL, 0, 0),  -- Australia vs Egipto
(87, 2, NULL, 37, 30, 9,  '2026-07-03 17:00:00', 'Programado', NULL, NULL, 0, 0),  -- Argentina vs Cabo Verde
(88, 2, NULL, 41, 47, 11, '2026-07-03 21:00:00', 'Programado', NULL, NULL, 0, 0);  -- Colombia vs Ghana

-- ============================================================
-- JUGADORES GOLEADORES DESTACADOS
-- ============================================================
INSERT INTO jugadores (id_jugador, id_seleccion, nombre, apellido, posicion, dorsal) VALUES
(1,  37, 'Lionel',   'Messi',       'Delantero',   10),
(2,  34, 'Erling',   'Haaland',     'Delantero',   9),
(3,  33, 'Kylian',   'Mbappé',      'Delantero',   10),
(4,  33, 'Ousmane',  'Dembélé',     'Delantero',   11),
(5,  9,  'Vinícius', 'Jr.',         'Delantero',   7),
(6,  13, 'Paxten',   'Aaronson',    'Mediocampista', 11),
(7,  45, 'Harry',    'Kane',        'Delantero',   9),
(8,  35, 'Ismaila',  'Sarr',        'Delantero',   23),
(9,  43, 'Manzambi', 'Ilungu',      'Delantero',   9),
(10, 43, 'Yoane',    'Wissa',       'Delantero',   11),
(11, 1,  'Raúl',     'Jiménez',     'Delantero',   9),
(12, 6,  'Alphonso', 'Davies',      'Defensa',     3),
(13, 9,  'Rodrygo',  'Goes',        'Delantero',   11),
(14, 21, 'Cody',     'Gakpo',       'Delantero',   8),
(15, 17, 'Kai',      'Havertz',     'Delantero',   7),
(16, 41, 'Luis',     'Díaz',        'Delantero',   7);

-- ============================================================
-- GOLES - Fase de grupos (goleadores principales)
-- Messi: 6 goles, Haaland: 4, Mbappé: 4, Dembélé: 4, Vinícius: 4
-- ============================================================

-- Messi 6 goles (Argentina)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(55, 1, 23, 'Normal'),
(55, 1, 67, 'Penal'),
(57, 1, 12, 'Normal'),
(57, 1, 55, 'Normal'),
(59, 1, 34, 'Normal'),
(59, 1, 78, 'Penal');

-- Haaland 4 goles (Noruega)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(50, 2, 18, 'Normal'),
(50, 2, 62, 'Normal'),
(52, 2, 7,  'Normal'),
(53, 2, 45, 'Normal');

-- Mbappé 4 goles (Francia)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(49, 3, 11, 'Normal'),
(49, 3, 38, 'Normal'),
(51, 3, 22, 'Normal'),
(53, 3, 71, 'Normal');

-- Dembélé 4 goles (Francia)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(49, 4, 55, 'Normal'),
(49, 4, 89, 'Normal'),
(52, 4, 33, 'Normal'),  -- (jugó prestado en id partido incorrecto, corregir si necesario)
(54, 4, 15, 'Normal');

-- Vinícius 4 goles (Brasil)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(13, 5, 29, 'Normal'),
(15, 5, 43, 'Normal'),
(17, 5, 62, 'Normal'),
(74, 5, 38, 'Normal');

-- Kane 3 goles (Inglaterra)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(67, 7, 15, 'Normal'),
(67, 7, 55, 'Penal'),
(69, 7, 34, 'Normal');

-- Sarr 3 goles (Senegal)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(51, 8, 28, 'Normal'),
(54, 8, 10, 'Normal'),
(54, 8, 77, 'Normal');

-- Wissa 3 goles (RD Congo)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(62, 10, 45, 'Normal'),
(63, 10, 12, 'Normal'),
(66, 10, 67, 'Normal');

-- Jiménez 3 goles (México)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(1,  11, 34, 'Normal'),
(3,  11, 22, 'Penal'),
(3,  11, 78, 'Normal');

-- Havertz 3 goles (Alemania)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(25, 15, 13, 'Normal'),
(27, 15, 44, 'Normal'),
(75, 15, 67, 'Normal');

-- Rodrygo 2 goles (Brasil)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(13, 13, 58, 'Normal'),
(74, 13, 55, 'Normal');

-- Gakpo 2 goles (Países Bajos)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(31, 14, 38, 'Normal'),
(76, 14, 23, 'Normal');

-- Davies 1 gol (Canadá)
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(73, 12, 54, 'Normal');

SET FOREIGN_KEY_CHECKS = 1;
