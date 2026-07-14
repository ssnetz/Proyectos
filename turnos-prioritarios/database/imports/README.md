# Import: Base Depurada Programa Turnos Prioritarios Cosquín (2026-07-14)

Migración de la planilla real de turnos prioritarios (hoja "BASE DEPURADA")
al sistema, reemplazando los datos de prueba.

## Qué hace

1. **`2026-07-14_import_1_personas.sql`** (correr contra `stock_control`):
   inserta o actualiza 169 personas (por documento) en el padrón compartido.
   Si una persona ya existía, **no pisa** apellido/nombre/domicilio — solo
   completa `celular` si estaba vacío.
2. **`2026-07-14_import_2_turnos.sql`** (correr contra `turnos_prioritarios`):
   - Borra los turnos de prueba existentes (`DELETE FROM turnos_prioritarios`).
   - Crea las instituciones y profesionales nuevos detectados en la planilla
     (reutiliza "Hospital Cima" ya existente en vez de duplicarlo).
   - Inserta los 245 turnos parseados, con `estado` calculado según si la
     fecha ya pasó (`atendido`) o es futura (`pendiente`) respecto al
     14/07/2026, y `prioridad = 'media'` por defecto (la planilla no traía
     ese dato).

## Decisiones de mapeo (importante para auditoría)

- `fecha_nacimiento` y `email` quedan vacíos para las 169 personas: no
  estaban en la planilla origen.
- Apellido/nombre se separan tomando la primera palabra como apellido — en
  apellidos compuestos puede quedar mal partido, corregible después desde
  la pantalla Personas.
- 143 de los 245 turnos (58%) quedan con el profesional genérico
  `(sin dato)` por no tener nombre de profesional ni especialidad en la
  fila original de la planilla. Fecha, hora, persona e institución
  derivante sí se importan correctamente; el texto original de la fila
  queda completo en `observaciones`.
- "Institución derivante" (quién refiere al paciente) se modeló reusando
  la tabla `instituciones` existente, aunque conceptualmente es distinto a
  "dónde se da el turno". Cuando una fila tenía más de una institución
  derivante, se usó la primera y el resto quedó anotado en observaciones.
- 2 filas de la planilla tenían la fecha del turno con un formato roto
  (sin espacio entre día y mes) y se excluyeron del import de turnos — la
  persona sí se cargó igual.
- 9 personas de la planilla no tenían ninguna fecha de turno cargada; se
  importaron solo como persona, sin turno asociado.

## Cómo correrlo

```bash
curl -sSL https://raw.githubusercontent.com/ssnetz/Proyectos/claude/import-planilla-cosquin/turnos-prioritarios/database/imports/2026-07-14_import_1_personas.sql -o /tmp/import_1_personas.sql
curl -sSL https://raw.githubusercontent.com/ssnetz/Proyectos/claude/import-planilla-cosquin/turnos-prioritarios/database/imports/2026-07-14_import_2_turnos.sql -o /tmp/import_2_turnos.sql

mysql -u turnos_user -p'<password>' < /tmp/import_1_personas.sql
mysql -u turnos_user -p'<password>' < /tmp/import_2_turnos.sql
```

`turnos_user` tiene permisos suficientes para ambos (ALL en
`turnos_prioritarios`, y SELECT/INSERT/UPDATE en `stock_control.personas`).
