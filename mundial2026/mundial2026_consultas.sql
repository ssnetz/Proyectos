-- ============================================================
--  CONSULTAS ÚTILES: MUNDIAL FIFA 2026
-- ============================================================

USE mundial2026;

-- 1. Tabla de posiciones de un grupo
SELECT
    s.nombre        AS seleccion,
    p.pj, p.pg, p.pe, p.pp,
    p.gf, p.gc,
    (p.gf - p.gc)   AS dif_goles,
    p.pts
FROM posiciones p
JOIN selecciones s ON s.id_seleccion = p.id_seleccion
WHERE p.id_grupo = 'A'
ORDER BY p.pts DESC, (p.gf - p.gc) DESC, p.gf DESC;

-- 2. Goleadores del torneo
SELECT
    CONCAT(j.nombre, ' ', j.apellido) AS jugador,
    s.nombre AS seleccion,
    COUNT(g.id_gol) AS goles
FROM goles g
JOIN jugadores j ON j.id_jugador = g.id_jugador
JOIN selecciones s ON s.id_seleccion = j.id_seleccion
WHERE g.tipo <> 'Autogol'
GROUP BY g.id_jugador
ORDER BY goles DESC
LIMIT 10;

-- 3. Resultados de todos los partidos finalizados
SELECT
    f.nombre        AS fase,
    local.nombre    AS local,
    p.goles_local,
    p.goles_visitante,
    visit.nombre    AS visitante,
    se.estadio,
    p.fecha_hora
FROM partidos p
JOIN fases      f     ON f.id_fase           = p.id_fase
JOIN selecciones local ON local.id_seleccion = p.id_seleccion_local
JOIN selecciones visit ON visit.id_seleccion = p.id_seleccion_visit
JOIN sedes       se   ON se.id_sede          = p.id_sede
WHERE p.estado = 'Finalizado'
ORDER BY p.fecha_hora;

-- 4. Jugadores con tarjeta roja
SELECT
    CONCAT(j.nombre, ' ', j.apellido) AS jugador,
    s.nombre AS seleccion,
    t.tipo,
    t.minuto,
    CONCAT(loc.nombre, ' vs ', vis.nombre) AS partido
FROM tarjetas t
JOIN jugadores   j   ON j.id_jugador   = t.id_jugador
JOIN selecciones s   ON s.id_seleccion = j.id_seleccion
JOIN partidos    p   ON p.id_partido   = t.id_partido
JOIN selecciones loc ON loc.id_seleccion = p.id_seleccion_local
JOIN selecciones vis ON vis.id_seleccion = p.id_seleccion_visit
WHERE t.tipo IN ('Roja','Doble amarilla')
ORDER BY p.fecha_hora;

-- 5. Partidos de una selección específica (ej: Argentina)
SELECT
    f.nombre AS fase,
    CASE WHEN p.id_seleccion_local = 1 THEN 'Local' ELSE 'Visitante' END AS rol,
    CONCAT(loc.nombre, ' ', p.goles_local,
           ' - ', p.goles_visitante, ' ', vis.nombre) AS resultado,
    se.estadio,
    p.fecha_hora
FROM partidos p
JOIN fases       f   ON f.id_fase            = p.id_fase
JOIN selecciones loc ON loc.id_seleccion     = p.id_seleccion_local
JOIN selecciones vis ON vis.id_seleccion     = p.id_seleccion_visit
JOIN sedes       se  ON se.id_sede           = p.id_sede
WHERE 1 IN (p.id_seleccion_local, p.id_seleccion_visit)
ORDER BY p.fecha_hora;

-- 6. Goles en el partido (línea de tiempo)
SELECT
    g.minuto,
    g.minuto_extra,
    CONCAT(j.nombre, ' ', j.apellido) AS goleador,
    s.nombre AS seleccion,
    g.tipo
FROM goles g
JOIN jugadores   j ON j.id_jugador   = g.id_jugador
JOIN selecciones s ON s.id_seleccion = j.id_seleccion
WHERE g.id_partido = 1   -- cambiar por el id del partido deseado
ORDER BY g.minuto, g.minuto_extra;
