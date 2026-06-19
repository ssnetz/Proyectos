# Diagrama Entidad-Relación — Mundial FIFA 2026

```mermaid
erDiagram
    confederaciones {
        int id_confederacion PK
        varchar nombre
        varchar sigla
    }

    selecciones {
        int id_seleccion PK
        varchar nombre
        char codigo_fifa
        int id_confederacion FK
        varchar entrenador
    }

    jugadores {
        int id_jugador PK
        varchar nombre
        varchar apellido
        date fecha_nac
        enum posicion
        tinyint dorsal
        int id_seleccion FK
        boolean capitan
    }

    grupos {
        char id_grupo PK
        varchar nombre
    }

    grupos_selecciones {
        char id_grupo FK
        int id_seleccion FK
    }

    sedes {
        int id_sede PK
        varchar ciudad
        varchar pais
        varchar estadio
        int capacidad
    }

    arbitros {
        int id_arbitro PK
        varchar nombre
        varchar nacionalidad
        int id_confederacion FK
    }

    fases {
        int id_fase PK
        varchar nombre
        tinyint orden
    }

    partidos {
        int id_partido PK
        int id_fase FK
        char id_grupo FK
        int id_sede FK
        int id_seleccion_local FK
        int id_seleccion_visit FK
        datetime fecha_hora
        int id_arbitro FK
        enum estado
        tinyint goles_local
        tinyint goles_visitante
        boolean fue_prorroga
        boolean fue_penales
    }

    goles {
        int id_gol PK
        int id_partido FK
        int id_jugador FK
        int id_asistente FK
        tinyint minuto
        tinyint minuto_extra
        enum tipo
    }

    tarjetas {
        int id_tarjeta PK
        int id_partido FK
        int id_jugador FK
        enum tipo
        tinyint minuto
        tinyint minuto_extra
    }

    sustituciones {
        int id_sustitucion PK
        int id_partido FK
        int id_jugador_sale FK
        int id_jugador_entra FK
        tinyint minuto
    }

    posiciones {
        char id_grupo FK
        int id_seleccion FK
        tinyint pj
        tinyint pg
        tinyint pe
        tinyint pp
        tinyint gf
        tinyint gc
        tinyint dg
        tinyint pts
    }

    confederaciones ||--o{ selecciones        : "agrupa"
    confederaciones ||--o{ arbitros           : "pertenece"
    selecciones     ||--o{ jugadores          : "tiene"
    selecciones     }o--o{ grupos_selecciones : "participa"
    grupos          ||--o{ grupos_selecciones : "contiene"
    grupos          ||--o{ partidos           : "fase de grupos"
    grupos          ||--o{ posiciones         : "clasifica"
    selecciones     ||--o{ posiciones         : "posee"
    fases           ||--o{ partidos           : "pertenece"
    sedes           ||--o{ partidos           : "alberga"
    arbitros        ||--o{ partidos           : "dirige"
    selecciones     ||--o{ partidos           : "juega como local"
    selecciones     ||--o{ partidos           : "juega como visitante"
    partidos        ||--o{ goles              : "contiene"
    partidos        ||--o{ tarjetas           : "registra"
    partidos        ||--o{ sustituciones      : "incluye"
    jugadores       ||--o{ goles              : "anota"
    jugadores       ||--o{ goles              : "asiste"
    jugadores       ||--o{ tarjetas           : "recibe"
    jugadores       ||--o{ sustituciones      : "sale"
    jugadores       ||--o{ sustituciones      : "entra"
```

## Descripción de relaciones clave

| Relación | Cardinalidad | Descripción |
|---|---|---|
| confederaciones → selecciones | 1:N | Cada confederación agrupa varias selecciones |
| confederaciones → arbitros | 1:N | Los árbitros pertenecen a una confederación |
| selecciones ↔ grupos | N:M | Mediante la tabla `grupos_selecciones` |
| grupos → posiciones | 1:N | Cada grupo tiene una fila de posición por selección |
| fases → partidos | 1:N | Un partido pertenece a una fase del torneo |
| sedes → partidos | 1:N | Una sede puede albergar múltiples partidos |
| partidos → goles | 1:N | Un partido puede tener cero o muchos goles |
| partidos → tarjetas | 1:N | Un partido puede tener cero o muchas tarjetas |
| jugadores → goles | 1:N | Un jugador puede anotar varios goles (también aparece como asistente) |
| jugadores → sustituciones | 1:N | Un jugador puede entrar o salir en distintos partidos |
