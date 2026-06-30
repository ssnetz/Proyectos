-- ============================================================
--  SCRIPT COMPLETO: MUNDIAL FIFA 2026
--  Asignatura: Aplicaciones Informáticas
--  Ejecución: mysql -u root -p < mundial2026_completo.sql
-- ============================================================

DROP DATABASE IF EXISTS mundial2026;

CREATE DATABASE mundial2026
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mundial2026;

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE confederaciones (
    id_confederacion INT AUTO_INCREMENT PRIMARY KEY,
    nombre           VARCHAR(50)  NOT NULL,
    sigla            VARCHAR(10)  NOT NULL UNIQUE
);

CREATE TABLE selecciones (
    id_seleccion     INT AUTO_INCREMENT PRIMARY KEY,
    nombre           VARCHAR(60)  NOT NULL,
    codigo_fifa      CHAR(3)      NOT NULL UNIQUE,
    id_confederacion INT          NOT NULL,
    entrenador       VARCHAR(80),
    FOREIGN KEY (id_confederacion) REFERENCES confederaciones(id_confederacion)
);

CREATE TABLE sedes (
    id_sede   INT AUTO_INCREMENT PRIMARY KEY,
    ciudad    VARCHAR(60) NOT NULL,
    pais      VARCHAR(40) NOT NULL,
    estadio   VARCHAR(80) NOT NULL,
    capacidad INT
);

CREATE TABLE arbitros (
    id_arbitro       INT AUTO_INCREMENT PRIMARY KEY,
    nombre           VARCHAR(80) NOT NULL,
    nacionalidad     VARCHAR(60),
    id_confederacion INT,
    FOREIGN KEY (id_confederacion) REFERENCES confederaciones(id_confederacion)
);

CREATE TABLE jugadores (
    id_jugador   INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(80)  NOT NULL,
    apellido     VARCHAR(80)  NOT NULL,
    fecha_nac    DATE,
    posicion     ENUM('Portero','Defensa','Mediocampista','Delantero') NOT NULL,
    dorsal       TINYINT UNSIGNED,
    id_seleccion INT NOT NULL,
    capitan      BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_seleccion) REFERENCES selecciones(id_seleccion)
);

CREATE TABLE grupos (
    id_grupo CHAR(1) PRIMARY KEY,
    nombre   VARCHAR(20) NOT NULL
);

CREATE TABLE grupos_selecciones (
    id_grupo     CHAR(1) NOT NULL,
    id_seleccion INT     NOT NULL,
    PRIMARY KEY (id_grupo, id_seleccion),
    FOREIGN KEY (id_grupo)     REFERENCES grupos(id_grupo),
    FOREIGN KEY (id_seleccion) REFERENCES selecciones(id_seleccion)
);

CREATE TABLE fases (
    id_fase INT AUTO_INCREMENT PRIMARY KEY,
    nombre  VARCHAR(40) NOT NULL,
    orden   TINYINT     NOT NULL
);

CREATE TABLE partidos (
    id_partido         INT AUTO_INCREMENT PRIMARY KEY,
    id_fase            INT     NOT NULL,
    id_grupo           CHAR(1),
    id_sede            INT     NOT NULL,
    id_seleccion_local INT     NOT NULL,
    id_seleccion_visit INT     NOT NULL,
    fecha_hora         DATETIME NOT NULL,
    id_arbitro         INT,
    estado             ENUM('Programado','En curso','Finalizado','Suspendido') DEFAULT 'Programado',
    goles_local        TINYINT UNSIGNED,
    goles_visitante    TINYINT UNSIGNED,
    fue_prorroga       BOOLEAN DEFAULT FALSE,
    goles_local_pt     TINYINT UNSIGNED,
    goles_visit_pt     TINYINT UNSIGNED,
    fue_penales        BOOLEAN DEFAULT FALSE,
    penales_local      TINYINT UNSIGNED,
    penales_visitante  TINYINT UNSIGNED,
    FOREIGN KEY (id_fase)            REFERENCES fases(id_fase),
    FOREIGN KEY (id_grupo)           REFERENCES grupos(id_grupo),
    FOREIGN KEY (id_sede)            REFERENCES sedes(id_sede),
    FOREIGN KEY (id_seleccion_local) REFERENCES selecciones(id_seleccion),
    FOREIGN KEY (id_seleccion_visit) REFERENCES selecciones(id_seleccion),
    FOREIGN KEY (id_arbitro)         REFERENCES arbitros(id_arbitro),
    CHECK (id_seleccion_local <> id_seleccion_visit)
);

CREATE TABLE goles (
    id_gol       INT AUTO_INCREMENT PRIMARY KEY,
    id_partido   INT             NOT NULL,
    id_jugador   INT             NOT NULL,
    id_asistente INT,
    minuto       TINYINT UNSIGNED NOT NULL,
    minuto_extra TINYINT UNSIGNED,
    tipo         ENUM('Normal','Penal','Autogol','Prorroga') DEFAULT 'Normal',
    FOREIGN KEY (id_partido)   REFERENCES partidos(id_partido),
    FOREIGN KEY (id_jugador)   REFERENCES jugadores(id_jugador),
    FOREIGN KEY (id_asistente) REFERENCES jugadores(id_jugador)
);

CREATE TABLE tarjetas (
    id_tarjeta   INT AUTO_INCREMENT PRIMARY KEY,
    id_partido   INT             NOT NULL,
    id_jugador   INT             NOT NULL,
    tipo         ENUM('Amarilla','Roja','Doble amarilla') NOT NULL,
    minuto       TINYINT UNSIGNED NOT NULL,
    minuto_extra TINYINT UNSIGNED,
    FOREIGN KEY (id_partido) REFERENCES partidos(id_partido),
    FOREIGN KEY (id_jugador) REFERENCES jugadores(id_jugador)
);

CREATE TABLE sustituciones (
    id_sustitucion  INT AUTO_INCREMENT PRIMARY KEY,
    id_partido      INT             NOT NULL,
    id_jugador_sale INT             NOT NULL,
    id_jugador_entra INT            NOT NULL,
    minuto          TINYINT UNSIGNED NOT NULL,
    FOREIGN KEY (id_partido)       REFERENCES partidos(id_partido),
    FOREIGN KEY (id_jugador_sale)  REFERENCES jugadores(id_jugador),
    FOREIGN KEY (id_jugador_entra) REFERENCES jugadores(id_jugador)
);

CREATE TABLE posiciones (
    id_grupo     CHAR(1) NOT NULL,
    id_seleccion INT     NOT NULL,
    pj  TINYINT UNSIGNED DEFAULT 0,
    pg  TINYINT UNSIGNED DEFAULT 0,
    pe  TINYINT UNSIGNED DEFAULT 0,
    pp  TINYINT UNSIGNED DEFAULT 0,
    gf  TINYINT UNSIGNED DEFAULT 0,
    gc  TINYINT UNSIGNED DEFAULT 0,
    dg  TINYINT          DEFAULT 0,
    pts TINYINT UNSIGNED DEFAULT 0,
    PRIMARY KEY (id_grupo, id_seleccion),
    FOREIGN KEY (id_grupo)     REFERENCES grupos(id_grupo),
    FOREIGN KEY (id_seleccion) REFERENCES selecciones(id_seleccion)
);

-- ============================================================
-- DATOS
-- ============================================================

-- CONFEDERACIONES
-- id: 1=CONMEBOL, 2=UEFA, 3=CONCACAF, 4=CAF, 5=AFC, 6=OFC
INSERT INTO confederaciones (nombre, sigla) VALUES
('Confederación Sudamericana de Fútbol',         'CONMEBOL'),
('Unión de Asociaciones Europeas de Fútbol',     'UEFA'),
('Confederación de Fútbol de América del Norte', 'CONCACAF'),
('Confederación Africana de Fútbol',             'CAF'),
('Confederación Asiática de Fútbol',             'AFC'),
('Confederación Oceánica de Fútbol',             'OFC');

-- FASES
-- id: 1=Grupos, 2=16avos, 3=Octavos, 4=Cuartos, 5=Semi, 6=3er Puesto, 7=Final
INSERT INTO fases (nombre, orden) VALUES
('Fase de Grupos',   1),
('16avos de Final',  2),
('Octavos de Final', 3),
('Cuartos de Final', 4),
('Semifinales',      5),
('Tercer Puesto',    6),
('Final',            7);

-- GRUPOS
INSERT INTO grupos (id_grupo, nombre) VALUES
('A','Grupo A'),('B','Grupo B'),('C','Grupo C'),('D','Grupo D'),
('E','Grupo E'),('F','Grupo F'),('G','Grupo G'),('H','Grupo H'),
('I','Grupo I'),('J','Grupo J'),('K','Grupo K'),('L','Grupo L');

-- SEDES (16 estadios oficiales)
INSERT INTO sedes (ciudad, pais, estadio, capacidad) VALUES
('Nueva York / Nueva Jersey', 'EE.UU.',  'MetLife Stadium',         82500),  -- 1
('Los Ángeles',               'EE.UU.',  'SoFi Stadium',            70240),  -- 2
('Dallas',                    'EE.UU.',  'AT&T Stadium',            80000),  -- 3
('San Francisco',             'EE.UU.',  'Levi''s Stadium',         68500),  -- 4
('Miami',                     'EE.UU.',  'Hard Rock Stadium',       65326),  -- 5
('Atlanta',                   'EE.UU.',  'Mercedes-Benz Stadium',   71000),  -- 6
('Seattle',                   'EE.UU.',  'Lumen Field',             69000),  -- 7
('Houston',                   'EE.UU.',  'NRG Stadium',             72220),  -- 8
('Kansas City',               'EE.UU.',  'Arrowhead Stadium',       76416),  -- 9
('Boston',                    'EE.UU.',  'Gillette Stadium',        65878),  -- 10
('Philadelphia',              'EE.UU.',  'Lincoln Financial Field', 69176),  -- 11
('Ciudad de México',          'México',  'Estadio Azteca',          87523),  -- 12
('Monterrey',                 'México',  'Estadio BBVA',            53500),  -- 13
('Guadalajara',               'México',  'Estadio Akron',           49850),  -- 14
('Toronto',                   'Canadá',  'BMO Field',               45000),  -- 15
('Vancouver',                 'Canadá',  'BC Place',                54500);  -- 16

-- ============================================================
-- SELECCIONES (48 clasificadas al Mundial 2026)
-- CONMEBOL (9 cupos): ARG BRA URU COL ECU VEN PAR BOL PER
-- UEFA (16 cupos): ESP FRA GER ENG POR NED ITA BEL AUT TUR
--                  SRB SCO CRO DEN SUI SVK
-- CONCACAF (6 cupos): USA MEX CAN PAN HON JAM
-- CAF (9 cupos): MAR SEN NGA EGY CMR GHA CIV GUI ZAF
-- AFC (8 cupos + repechaje): JPN KOR IRN AUS SAU JOR IRQ PAL
--   (usamos 8 AFC para llegar a 48 sin repechajes externos)
-- OFC (1 cupo): NZL
-- ============================================================

INSERT INTO selecciones (nombre, codigo_fifa, id_confederacion, entrenador) VALUES
-- CONMEBOL (id_confederacion=1) — 9 selecciones
('Argentina',        'ARG', 1, 'Lionel Scaloni'),        -- 1
('Brasil',           'BRA', 1, 'Dorival Júnior'),        -- 2
('Uruguay',          'URU', 1, 'Marcelo Bielsa'),        -- 3
('Colombia',         'COL', 1, 'Néstor Lorenzo'),        -- 4
('Ecuador',          'ECU', 1, 'Sebastián Beccacece'),   -- 5
('Venezuela',        'VEN', 1, 'Fernando Batista'),      -- 6
('Paraguay',         'PAR', 1, 'Gustavo Alfaro'),        -- 7
('Bolivia',          'BOL', 1, 'Óscar Villegas'),        -- 8
('Perú',             'PER', 1, 'Jorge Fossati'),         -- 9
-- UEFA (id_confederacion=2) — 16 selecciones
('España',           'ESP', 2, 'Luis de la Fuente'),     -- 10
('Francia',          'FRA', 2, 'Didier Deschamps'),      -- 11
('Alemania',         'GER', 2, 'Julian Nagelsmann'),     -- 12
('Inglaterra',       'ENG', 2, 'Lee Carsley'),           -- 13
('Portugal',         'POR', 2, 'Roberto Martínez'),      -- 14
('Países Bajos',     'NED', 2, 'Ronald Koeman'),         -- 15
('Italia',           'ITA', 2, 'Luciano Spalletti'),     -- 16
('Bélgica',          'BEL', 2, 'Domenico Tedesco'),      -- 17
('Austria',          'AUT', 2, 'Ralf Rangnick'),         -- 18
('Turquía',          'TUR', 2, 'Vincenzo Montella'),     -- 19
('Serbia',           'SRB', 2, 'Dragan Stojković'),      -- 20
('Escocia',          'SCO', 2, 'Steve Clarke'),          -- 21
('Croacia',          'CRO', 2, 'Zlatko Dalić'),          -- 22
('Dinamarca',        'DEN', 2, 'Kasper Hjulmand'),       -- 23
('Suiza',            'SUI', 2, 'Murat Yakin'),           -- 24
('Eslovaquia',       'SVK', 2, 'Francesco Calzona'),     -- 25
-- CONCACAF (id_confederacion=3) — 6 selecciones
('México',           'MEX', 3, 'Javier Aguirre'),        -- 26
('Estados Unidos',   'USA', 3, 'Mauricio Pochettino'),   -- 27
('Canadá',           'CAN', 3, 'Jesse Marsch'),          -- 28
('Panamá',           'PAN', 3, 'Thomas Christiansen'),   -- 29
('Honduras',         'HON', 3, 'Reinaldo Rueda'),        -- 30
('Jamaica',          'JAM', 3, 'Heimir Hallgrímsson'),   -- 31
-- CAF (id_confederacion=4) — 9 selecciones
('Marruecos',        'MAR', 4, 'Walid Regragui'),        -- 32
('Senegal',          'SEN', 4, 'Aliou Cissé'),           -- 33
('Nigeria',          'NGA', 4, 'Finidi George'),         -- 34
('Egipto',           'EGY', 4, 'Hossam Hassan'),         -- 35
('Camerún',          'CMR', 4, 'Marc Brys'),             -- 36
('Ghana',            'GHA', 4, 'Otto Addo'),             -- 37
('Costa de Marfil',  'CIV', 4, 'Emerse Faé'),           -- 38
('Guinea',           'GUI', 4, 'Kaba Diawara'),          -- 39
('Sudáfrica',        'ZAF', 4, 'Hugo Broos'),            -- 40
-- AFC (id_confederacion=5) — 8 selecciones
('Japón',            'JPN', 5, 'Hajime Moriyasu'),       -- 41
('Corea del Sur',    'KOR', 5, 'Hong Myung-bo'),         -- 42
('Irán',             'IRN', 5, 'Amir Ghalenoei'),        -- 43
('Australia',        'AUS', 5, 'Tony Popovic'),          -- 44
('Arabia Saudita',   'SAU', 5, 'Hervé Renard'),          -- 45
('Jordania',         'JOR', 5, 'Hussein Ammouta'),       -- 46
('Irak',             'IRQ', 5, 'Jesús Casas'),           -- 47
-- OFC (id_confederacion=6) — 1 selección
('Nueva Zelanda',    'NZL', 6, 'Darren Bazeley');        -- 48

-- ============================================================
-- ÁRBITROS (6 ejemplos, uno por confederación)
-- ============================================================
INSERT INTO arbitros (nombre, nacionalidad, id_confederacion) VALUES
('Facundo Tello',    'Argentina',    1),
('Clément Turpin',   'Francia',      2),
('Ismail Elfath',    'Estados Unidos',3),
('Mustapha Ghorbal', 'Argelia',      4),
('Alireza Faghani',  'Irán',         5),
('Matthew Conger',   'Nueva Zelanda',6);

-- ============================================================
-- JUGADORES DESTACADOS
-- ============================================================

-- ARGENTINA (id_seleccion=1) — ya insertados arriba en datos.sql style
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Emiliano',  'Martínez',   '1992-09-02', 'Portero',        1,  1, FALSE),
('Nahuel',    'Molina',     '1998-04-06', 'Defensa',        26, 1, FALSE),
('Cristian',  'Romero',     '1998-04-27', 'Defensa',        13, 1, FALSE),
('Lisandro',  'Martínez',   '1998-01-18', 'Defensa',        14, 1, FALSE),
('Rodrigo',   'De Paul',    '1994-05-24', 'Mediocampista',  7,  1, FALSE),
('Enzo',      'Fernández',  '2001-01-17', 'Mediocampista',  24, 1, FALSE),
('Alexis',    'Mac Allister','1998-12-24', 'Mediocampista', 20, 1, FALSE),
('Lionel',    'Messi',      '1987-06-24', 'Delantero',      10, 1, TRUE),
('Lautaro',   'Martínez',   '1997-08-22', 'Delantero',      22, 1, FALSE),
('Julián',    'Álvarez',    '2000-01-31', 'Delantero',      9,  1, FALSE);

-- BRASIL (id_seleccion=2)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Alisson',   'Becker',     '1992-10-02', 'Portero',        1,  2, FALSE),
('Danilo',    'Luiz',       '1991-07-15', 'Defensa',        2,  2, TRUE),
('Marquinhos','Santos',     '1994-05-14', 'Defensa',        4,  2, FALSE),
('Éder',      'Militão',    '1998-01-18', 'Defensa',        3,  2, FALSE),
('Casemiro',  '',           '1992-02-23', 'Mediocampista',  5,  2, FALSE),
('Rodrygo',   'Goes',       '2001-01-09', 'Delantero',      11, 2, FALSE),
('Vinicius',  'Júnior',     '2000-07-12', 'Delantero',      7,  2, FALSE),
('Raphinha',  '',           '1996-12-14', 'Delantero',      10, 2, FALSE),
('Lucas',     'Paquetá',    '1997-08-27', 'Mediocampista',  8,  2, FALSE),
('Endrick',   'Felipe',     '2006-07-21', 'Delantero',      9,  2, FALSE);

-- FRANCIA (id_seleccion=11)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Mike',      'Maignan',    '1995-07-03', 'Portero',        16, 11, FALSE),
('Jules',     'Koundé',     '1998-11-12', 'Defensa',        5,  11, FALSE),
('Dayot',     'Upamecano',  '1998-10-27', 'Defensa',        4,  11, FALSE),
('Théo',      'Hernández',  '1997-10-06', 'Defensa',        22, 11, FALSE),
('N''Golo',   'Kanté',      '1991-03-29', 'Mediocampista',  13, 11, FALSE),
('Aurélien',  'Tchouaméni', '2000-01-27', 'Mediocampista',  8,  11, FALSE),
('Antoine',   'Griezmann',  '1991-03-21', 'Delantero',      7,  11, TRUE),
('Kylian',    'Mbappé',     '1998-12-20', 'Delantero',      10, 11, FALSE),
('Ousmane',   'Dembélé',    '1997-05-15', 'Delantero',      11, 11, FALSE),
('Marcus',    'Thuram',     '1997-08-06', 'Delantero',      9,  11, FALSE);

-- ESPAÑA (id_seleccion=10)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Unai',      'Simón',      '1997-06-11', 'Portero',        1,  10, FALSE),
('Dani',      'Carvajal',   '1992-01-11', 'Defensa',        2,  10, FALSE),
('Aymeric',   'Laporte',    '1994-05-27', 'Defensa',        14, 10, FALSE),
('Robin',     'Le Normand', '1996-11-11', 'Defensa',        12, 10, FALSE),
('Pedri',     'González',   '2002-11-25', 'Mediocampista',  16, 10, FALSE),
('Rodri',     'Hernández',  '1996-06-22', 'Mediocampista',  16, 10, FALSE),
('Fabian',    'Ruiz',       '1996-04-03', 'Mediocampista',  8,  10, FALSE),
('Álvaro',    'Morata',     '1992-10-23', 'Delantero',      7,  10, TRUE),
('Lamine',    'Yamal',      '2007-07-13', 'Delantero',      19, 10, FALSE),
('Nico',      'Williams',   '2002-07-12', 'Delantero',      17, 10, FALSE);

-- ALEMANIA (id_seleccion=12)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Manuel',    'Neuer',      '1986-03-27', 'Portero',        1,  12, FALSE),
('Joshua',    'Kimmich',    '1995-02-08', 'Defensa',        6,  12, FALSE),
('Antonio',   'Rüdiger',    '1993-03-03', 'Defensa',        2,  12, FALSE),
('Nico',      'Schlotterbeck','2000-01-01','Defensa',        4,  12, FALSE),
('Toni',      'Kroos',      '1990-01-04', 'Mediocampista',  8,  12, TRUE),
('Leon',      'Goretzka',   '1995-02-06', 'Mediocampista',  14, 12, FALSE),
('Jamal',     'Musiala',    '2003-02-26', 'Mediocampista',  10, 12, FALSE),
('Thomas',    'Müller',     '1989-09-13', 'Delantero',      25, 12, FALSE),
('Leroy',     'Sané',       '1996-01-11', 'Delantero',      10, 12, FALSE),
('Florian',   'Wirtz',      '2003-05-03', 'Delantero',      17, 12, FALSE);

-- INGLATERRA (id_seleccion=13)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Jordan',    'Pickford',   '1994-03-07', 'Portero',        1,  13, FALSE),
('Trent',     'Alexander-Arnold','2003-10-07','Defensa',    66, 13, FALSE),
('John',      'Stones',     '1994-05-28', 'Defensa',        5,  13, FALSE),
('Marc',      'Guéhi',      '2000-07-13', 'Defensa',        6,  13, FALSE),
('Declan',    'Rice',       '1999-01-14', 'Mediocampista',  4,  13, FALSE),
('Jude',      'Bellingham', '2003-06-29', 'Mediocampista',  10, 13, FALSE),
('Phil',      'Foden',      '2000-05-28', 'Mediocampista',  20, 13, FALSE),
('Harry',     'Kane',       '1993-07-28', 'Delantero',      9,  13, TRUE),
('Bukayo',    'Saka',       '2001-09-05', 'Delantero',      7,  13, FALSE),
('Cole',      'Palmer',     '2002-05-06', 'Delantero',      11, 13, FALSE);

-- PORTUGAL (id_seleccion=14)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Diogo',     'Costa',      '1999-09-19', 'Portero',        1,  14, FALSE),
('João',      'Cancelo',    '1994-05-27', 'Defensa',        20, 14, FALSE),
('Rúben',     'Dias',       '1997-05-14', 'Defensa',        6,  14, FALSE),
('Pepe',      '',           '1983-02-26', 'Defensa',        3,  14, FALSE),
('Bernardo',  'Silva',      '1994-08-10', 'Mediocampista',  10, 14, FALSE),
('Bruno',     'Fernandes',  '1994-09-08', 'Mediocampista',  8,  14, FALSE),
('Vitinha',   '',           '2000-02-13', 'Mediocampista',  16, 14, FALSE),
('Cristiano', 'Ronaldo',    '1985-02-05', 'Delantero',      7,  14, TRUE),
('Rafael',    'Leão',       '1999-06-10', 'Delantero',      11, 14, FALSE),
('Gonçalo',   'Ramos',      '2001-06-20', 'Delantero',      9,  14, FALSE);

-- MÉXICO (id_seleccion=26)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Guillermo', 'Ochoa',      '1985-07-13', 'Portero',        13, 26, FALSE),
('Jorge',     'Sánchez',    '1997-01-21', 'Defensa',        2,  26, FALSE),
('César',     'Montes',     '1997-03-24', 'Defensa',        3,  26, FALSE),
('Johan',     'Vásquez',    '1998-06-05', 'Defensa',        4,  26, FALSE),
('Edson',     'Álvarez',    '1997-10-24', 'Mediocampista',  18, 26, TRUE),
('Héctor',    'Herrera',    '1990-04-19', 'Mediocampista',  16, 26, FALSE),
('Hirving',   'Lozano',     '1995-07-30', 'Delantero',      22, 26, FALSE),
('Alexis',    'Vega',       '1997-11-15', 'Delantero',      14, 26, FALSE),
('Henry',     'Martín',     '1992-10-08', 'Delantero',      9,  26, FALSE),
('Santiago',  'Giménez',    '2001-04-18', 'Delantero',      10, 26, FALSE);

-- ESTADOS UNIDOS (id_seleccion=27)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Matt',      'Turner',     '1994-06-24', 'Portero',        1,  27, FALSE),
('Sergino',   'Dest',       '2000-11-03', 'Defensa',        2,  27, FALSE),
('Miles',     'Robinson',   '1997-05-20', 'Defensa',        5,  27, FALSE),
('Tim',       'Ream',       '1987-10-05', 'Defensa',        13, 27, FALSE),
('Weston',    'McKennie',   '1998-08-28', 'Mediocampista',  8,  27, FALSE),
('Tyler',     'Adams',      '1999-02-14', 'Mediocampista',  4,  27, TRUE),
('Christian', 'Pulisic',    '1998-09-18', 'Delantero',      10, 27, FALSE),
('Gio',       'Reyna',      '2002-11-13', 'Delantero',      7,  27, FALSE),
('Josh',      'Sargent',    '2000-02-20', 'Delantero',      9,  27, FALSE),
('Ricardo',   'Pepi',       '2003-01-09', 'Delantero',      11, 27, FALSE);

-- MARRUECOS (id_seleccion=32)
INSERT INTO jugadores (nombre, apellido, fecha_nac, posicion, dorsal, id_seleccion, capitan) VALUES
('Yassine',   'Bounou',     '1991-04-05', 'Portero',        1,  32, FALSE),
('Achraf',    'Hakimi',     '1998-11-04', 'Defensa',        2,  32, FALSE),
('Romain',    'Saïss',      '1990-03-26', 'Defensa',        5,  32, TRUE),
('Nayef',     'Aguerd',     '1996-03-30', 'Defensa',        6,  32, FALSE),
('Sofyan',    'Amrabat',    '1996-08-21', 'Mediocampista',  4,  32, FALSE),
('Azzedine',  'Ounahi',     '2000-07-19', 'Mediocampista',  8,  32, FALSE),
('Hakim',     'Ziyech',     '1993-03-19', 'Mediocampista',  7,  32, FALSE),
('Youssef',   'En-Nesyri',  '1997-06-01', 'Delantero',      19, 32, FALSE),
('Abdessamad','Ezzalzouli', '2001-11-13', 'Delantero',      17, 32, FALSE),
('Anass',     'Zaroury',    '2001-03-17', 'Delantero',      11, 32, FALSE);

-- ============================================================
-- ASIGNACIÓN DE SELECCIONES A GRUPOS
-- Distribución representativa (no oficial definitiva)
-- ============================================================
INSERT INTO grupos_selecciones (id_grupo, id_seleccion) VALUES
-- Grupo A: USA, Uruguay, Marruecos, Bolivia
('A', 27), ('A', 3), ('A', 32), ('A', 8),
-- Grupo B: Argentina, Sudáfrica, Honduras, Eslovaquia
('B', 1),  ('B', 40), ('B', 30), ('B', 25),
-- Grupo C: Francia, México, Arabia Saudita, Escocia
('C', 11), ('C', 26), ('C', 45), ('C', 21),
-- Grupo D: España, Japón, Camerún, Panamá
('D', 10), ('D', 41), ('D', 36), ('D', 29),
-- Grupo E: Brasil, Suiza, Serbia, Guinea
('E', 2),  ('E', 24), ('E', 20), ('E', 39),
-- Grupo F: Alemania, Corea del Sur, Costa de Marfil, Jamaica
('F', 12), ('F', 42), ('F', 38), ('F', 31),
-- Grupo G: Portugal, Colombia, Irán, Nueva Zelanda
('G', 14), ('G', 4),  ('G', 43), ('G', 48),
-- Grupo H: Inglaterra, Ecuador, Senegal, Irak
('H', 13), ('H', 5),  ('H', 33), ('H', 47),
-- Grupo I: Países Bajos, Venezuela, Nigeria, Jordania
('I', 15), ('I', 6),  ('I', 34), ('I', 46),
-- Grupo J: Bélgica, Paraguay, Egipto, Australia
('J', 17), ('J', 7),  ('J', 35), ('J', 44),
-- Grupo K: Italia, Canadá, Ghana, Perú
('K', 16), ('K', 28), ('K', 37), ('K', 9),
-- Grupo L: Austria, Turquía, Croacia, Dinamarca
('L', 18), ('L', 19), ('L', 22), ('L', 23);

-- ============================================================
-- POSICIONES iniciales (todas en cero, se actualiza con triggers o app)
-- ============================================================
INSERT INTO posiciones (id_grupo, id_seleccion)
SELECT gs.id_grupo, gs.id_seleccion FROM grupos_selecciones gs;

-- ============================================================
-- PARTIDOS DE EJEMPLO (4 finalizados)
-- ============================================================
INSERT INTO partidos
    (id_fase, id_grupo, id_sede, id_seleccion_local, id_seleccion_visit,
     fecha_hora, id_arbitro, estado, goles_local, goles_visitante)
VALUES
-- Partido 1: Argentina 3-0 Bolivia (Grupo B)
(1, 'B', 1,  1,  8,  '2026-06-13 17:00:00', 1, 'Finalizado', 3, 0),
-- Partido 2: Francia 2-1 México (Grupo C)
(1, 'C', 12, 11, 26, '2026-06-14 20:00:00', 2, 'Finalizado', 2, 1),
-- Partido 3: España 1-0 Japón (Grupo D)
(1, 'D', 3,  10, 41, '2026-06-15 17:00:00', 3, 'Finalizado', 1, 0),
-- Partido 4: Brasil 0-0 Suiza (Grupo E)
(1, 'E', 5,  2,  24, '2026-06-16 14:00:00', 4, 'Finalizado', 0, 0);

-- Partidos programados (ejemplos adicionales)
INSERT INTO partidos
    (id_fase, id_grupo, id_sede, id_seleccion_local, id_seleccion_visit,
     fecha_hora, estado)
VALUES
(1, 'B', 6,  40, 25, '2026-06-13 14:00:00', 'Programado'),  -- Sudáfrica vs Eslovaquia
(1, 'C', 13, 45, 21, '2026-06-14 17:00:00', 'Programado'),  -- Arabia Saudita vs Escocia
(1, 'D', 14, 36, 29, '2026-06-15 14:00:00', 'Programado'),  -- Camerún vs Panamá
(1, 'E', 8,  20, 39, '2026-06-16 17:00:00', 'Programado'),  -- Serbia vs Guinea
(1, 'A', 7,  27,  3, '2026-06-17 20:00:00', 'Programado'),  -- USA vs Uruguay
(1, 'A', 10, 32,  8, '2026-06-17 17:00:00', 'Programado'),  -- Marruecos vs Bolivia
(1, 'F', 9,  12, 42, '2026-06-18 14:00:00', 'Programado'),  -- Alemania vs Corea del Sur
(1, 'G', 11, 14,  4, '2026-06-18 17:00:00', 'Programado'),  -- Portugal vs Colombia
(1, 'H', 2,  13,  5, '2026-06-19 20:00:00', 'Programado'),  -- Inglaterra vs Ecuador
(1, 'I', 4,  15,  6, '2026-06-20 14:00:00', 'Programado');  -- Países Bajos vs Venezuela

-- ============================================================
-- GOLES de los partidos finalizados
-- ============================================================

-- Partido 1: Argentina 3-0 Bolivia
-- Messi = id_jugador 8, Lautaro = 9, Julián = 10
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(1, 8,  23, 'Penal'),
(1, 9,  57, 'Normal'),
(1, 10, 78, 'Normal');

-- Partido 2: Francia 2-1 México
-- Mbappé = id 28, Thuram = 30, Giménez (MEX) = 80
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(2, 28, 34, 'Normal'),
(2, 30, 61, 'Normal'),
(2, 80, 88, 'Normal');

-- Partido 3: España 1-0 Japón
-- Morata = id 48, Álvaro Morata
INSERT INTO goles (id_partido, id_jugador, minuto, tipo) VALUES
(3, 48, 72, 'Normal');

-- ============================================================
-- TARJETAS de los partidos finalizados
-- ============================================================
INSERT INTO tarjetas (id_partido, id_jugador, tipo, minuto) VALUES
-- Partido 1
(1, 4,  'Amarilla', 45),   -- Rodrigo De Paul
-- Partido 2
(2, 77, 'Amarilla', 55),   -- Edson Álvarez (MEX)
(2, 21, 'Amarilla', 82),   -- N'Golo Kanté (FRA)
-- Partido 3
(3, 41, 'Roja',     90);   -- algún jugador de Japón (Danilo placeholder)
