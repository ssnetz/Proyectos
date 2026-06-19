-- ============================================================
--  BASE DE DATOS: MUNDIAL FIFA 2026
--  Asignatura: Aplicaciones Informáticas
-- ============================================================

CREATE DATABASE IF NOT EXISTS mundial2026
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mundial2026;

-- ------------------------------------------------------------
-- 1. CONFEDERACIONES (UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC)
-- ------------------------------------------------------------
CREATE TABLE confederaciones (
    id_confederacion INT AUTO_INCREMENT PRIMARY KEY,
    nombre           VARCHAR(50)  NOT NULL,
    sigla            VARCHAR(10)  NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- 2. SELECCIONES
-- ------------------------------------------------------------
CREATE TABLE selecciones (
    id_seleccion     INT AUTO_INCREMENT PRIMARY KEY,
    nombre           VARCHAR(60)  NOT NULL,
    codigo_fifa      CHAR(3)      NOT NULL UNIQUE,  -- ARG, BRA, FRA...
    id_confederacion INT          NOT NULL,
    entrenador       VARCHAR(80),
    FOREIGN KEY (id_confederacion) REFERENCES confederaciones(id_confederacion)
);

-- ------------------------------------------------------------
-- 3. SEDES (ciudades anfitrionas: USA, Canadá, México)
-- ------------------------------------------------------------
CREATE TABLE sedes (
    id_sede  INT AUTO_INCREMENT PRIMARY KEY,
    ciudad   VARCHAR(60) NOT NULL,
    pais     VARCHAR(40) NOT NULL,
    estadio  VARCHAR(80) NOT NULL,
    capacidad INT
);

-- ------------------------------------------------------------
-- 4. ÁRBITROS
-- ------------------------------------------------------------
CREATE TABLE arbitros (
    id_arbitro   INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(80) NOT NULL,
    nacionalidad VARCHAR(60),
    id_confederacion INT,
    FOREIGN KEY (id_confederacion) REFERENCES confederaciones(id_confederacion)
);

-- ------------------------------------------------------------
-- 5. JUGADORES
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 6. GRUPOS (A–L, 12 grupos de 4 equipos)
-- ------------------------------------------------------------
CREATE TABLE grupos (
    id_grupo CHAR(1) PRIMARY KEY,   -- 'A', 'B', ... 'L'
    nombre   VARCHAR(20) NOT NULL   -- 'Grupo A', etc.
);

CREATE TABLE grupos_selecciones (
    id_grupo     CHAR(1) NOT NULL,
    id_seleccion INT     NOT NULL,
    PRIMARY KEY (id_grupo, id_seleccion),
    FOREIGN KEY (id_grupo)     REFERENCES grupos(id_grupo),
    FOREIGN KEY (id_seleccion) REFERENCES selecciones(id_seleccion)
);

-- ------------------------------------------------------------
-- 7. FASES DEL TORNEO
-- ------------------------------------------------------------
CREATE TABLE fases (
    id_fase  INT AUTO_INCREMENT PRIMARY KEY,
    nombre   VARCHAR(40) NOT NULL,   -- 'Fase de Grupos', 'Octavos', etc.
    orden    TINYINT NOT NULL        -- 1=Grupos, 2=Octavos, 3=Cuartos...
);

-- ------------------------------------------------------------
-- 8. PARTIDOS
-- ------------------------------------------------------------
CREATE TABLE partidos (
    id_partido        INT AUTO_INCREMENT PRIMARY KEY,
    id_fase           INT  NOT NULL,
    id_grupo          CHAR(1),              -- NULL en fase eliminatoria
    id_sede           INT  NOT NULL,
    id_seleccion_local INT NOT NULL,
    id_seleccion_visit INT NOT NULL,
    fecha_hora        DATETIME NOT NULL,
    id_arbitro        INT,
    estado            ENUM('Programado','En curso','Finalizado','Suspendido')
                      DEFAULT 'Programado',
    -- Resultado al final del tiempo reglamentario
    goles_local       TINYINT UNSIGNED,
    goles_visitante   TINYINT UNSIGNED,
    -- Prórroga
    fue_prorroga      BOOLEAN DEFAULT FALSE,
    goles_local_pt    TINYINT UNSIGNED,     -- goles en prórroga (acumulado)
    goles_visit_pt    TINYINT UNSIGNED,
    -- Penales
    fue_penales       BOOLEAN DEFAULT FALSE,
    penales_local     TINYINT UNSIGNED,
    penales_visitante TINYINT UNSIGNED,
    FOREIGN KEY (id_fase)            REFERENCES fases(id_fase),
    FOREIGN KEY (id_grupo)           REFERENCES grupos(id_grupo),
    FOREIGN KEY (id_sede)            REFERENCES sedes(id_sede),
    FOREIGN KEY (id_seleccion_local) REFERENCES selecciones(id_seleccion),
    FOREIGN KEY (id_seleccion_visit) REFERENCES selecciones(id_seleccion),
    FOREIGN KEY (id_arbitro)         REFERENCES arbitros(id_arbitro),
    CHECK (id_seleccion_local <> id_seleccion_visit)
);

-- ------------------------------------------------------------
-- 9. GOLES
-- ------------------------------------------------------------
CREATE TABLE goles (
    id_gol      INT AUTO_INCREMENT PRIMARY KEY,
    id_partido  INT NOT NULL,
    id_jugador  INT NOT NULL,         -- quien marcó
    id_asistente INT,                 -- quien asistió (opcional)
    minuto      TINYINT UNSIGNED NOT NULL,
    minuto_extra TINYINT UNSIGNED,    -- tiempo adicional (ej: 90+3)
    tipo        ENUM('Normal','Penal','Autogol','Prorroga') DEFAULT 'Normal',
    FOREIGN KEY (id_partido)   REFERENCES partidos(id_partido),
    FOREIGN KEY (id_jugador)   REFERENCES jugadores(id_jugador),
    FOREIGN KEY (id_asistente) REFERENCES jugadores(id_jugador)
);

-- ------------------------------------------------------------
-- 10. TARJETAS (amarilla / roja)
-- ------------------------------------------------------------
CREATE TABLE tarjetas (
    id_tarjeta  INT AUTO_INCREMENT PRIMARY KEY,
    id_partido  INT NOT NULL,
    id_jugador  INT NOT NULL,
    tipo        ENUM('Amarilla','Roja','Doble amarilla') NOT NULL,
    minuto      TINYINT UNSIGNED NOT NULL,
    minuto_extra TINYINT UNSIGNED,
    FOREIGN KEY (id_partido) REFERENCES partidos(id_partido),
    FOREIGN KEY (id_jugador) REFERENCES jugadores(id_jugador)
);

-- ------------------------------------------------------------
-- 11. SUSTITUCIONES
-- ------------------------------------------------------------
CREATE TABLE sustituciones (
    id_sustitucion INT AUTO_INCREMENT PRIMARY KEY,
    id_partido     INT NOT NULL,
    id_jugador_sale INT NOT NULL,
    id_jugador_entra INT NOT NULL,
    minuto         TINYINT UNSIGNED NOT NULL,
    FOREIGN KEY (id_partido)      REFERENCES partidos(id_partido),
    FOREIGN KEY (id_jugador_sale) REFERENCES jugadores(id_jugador),
    FOREIGN KEY (id_jugador_entra) REFERENCES jugadores(id_jugador)
);

-- ------------------------------------------------------------
-- 12. TABLA DE POSICIONES (calculada, pero útil para cache)
-- ------------------------------------------------------------
CREATE TABLE posiciones (
    id_grupo     CHAR(1) NOT NULL,
    id_seleccion INT     NOT NULL,
    pj  TINYINT UNSIGNED DEFAULT 0,  -- partidos jugados
    pg  TINYINT UNSIGNED DEFAULT 0,  -- ganados
    pe  TINYINT UNSIGNED DEFAULT 0,  -- empatados
    pp  TINYINT UNSIGNED DEFAULT 0,  -- perdidos
    gf  TINYINT UNSIGNED DEFAULT 0,  -- goles a favor
    gc  TINYINT UNSIGNED DEFAULT 0,  -- goles en contra
    dg  TINYINT          DEFAULT 0,  -- diferencia de goles
    pts TINYINT UNSIGNED DEFAULT 0,  -- puntos
    PRIMARY KEY (id_grupo, id_seleccion),
    FOREIGN KEY (id_grupo)     REFERENCES grupos(id_grupo),
    FOREIGN KEY (id_seleccion) REFERENCES selecciones(id_seleccion)
);
