# Coordinacion entre agentes y steers

Un solo canal. No uses el chat entre PCs como fuente de verdad.

## Lectura al arrancar un turno (lean)

1. [`NOW.md`](NOW.md) — pack caliente (casi siempre alcanza)
2. [`board.toml`](board.toml) — solo tareas abiertas
3. Tu `inbox/` (archivar apenas leas)
4. `agents/<rol>/AGENTS.md` solo si hace falta

**No leas** `archive/`, `board.done.toml`, `STEERS.archive.md`, `milestones/` en turnos normales.

El hook inyecta un briefing corto (NOW + tus tasks).

### Milestone (bajar contexto)

Despues de un corte grande (providers, UI React, etc.):

```bash
python3 scripts/comms.py milestone --label day1-providers
# opcional: --keep archivo.md  para no archivar un inbox puntual
```

Eso archiva inbox/outbox viejos, mueve tasks `done` a `board.done.toml`, compacta steers y reescribe `NOW.md`.

## Roles y carpetas

| Rol | Humano | Bandejas |
|---|---|---|
| `vps` | Farid/Matheo | `comms/vps/{inbox,outbox,archive}/` |
| `carne` | Emir | `comms/carne/{inbox,outbox,archive}/` |
| `cricri` | Cristian | `comms/cricri/{inbox,outbox,archive}/` |

## CLI (preferida)

Desde la raiz del repo:

```bash
python3 scripts/comms.py whoami
python3 scripts/comms.py status
python3 scripts/comms.py task list --status open
python3 scripts/comms.py task add --owner carne --title "Wire favicon from brand/"
python3 scripts/comms.py task set T004 --status in_progress
python3 scripts/comms.py notify --from vps --to cricri --topic monigote --body "Copia el PNG a brand/monigote/"
python3 scripts/comms.py notify --from carne --to todos --topic ux-ready --body "Scrub listo para review"
python3 scripts/comms.py archive --name 20261114-....md
```

`notify` escribe en tu `outbox/` y copia a la `inbox/` del destinatario (o a todos).

## Mensajes manuales

Si no usas el CLI, nombre: `YYYYMMDD-HHMM-<de>-<para>-<tema>.md`

```markdown
# <tema>
De: <vps|cricri|carne>
Para: <vps|cricri|carne|todos>
Estado: abierto|hecho

## Pedido o feedback
...

## Archivos
- path/...

## Respuesta esperada
...
```

Cuando esta hecho: `Estado: hecho` y `scripts/comms.py archive --name …` (mueve a `archive/`).

## Steers (humanos)

- Editan `STEERS.md` (entradas nuevas arriba).
- Pueden agregar/cerrar tareas en el board via CLI o editando `board.toml`.
- Nunca pegan tokens/secretos en `comms/`.

## Delegar rapido

1. `task add --owner <rol> --title "..."` (o `task set` si ya existe)
2. `notify --from <tu-rol> --to <rol> --topic ... --body "..."`
3. Al cerrar tu parte: `task set ID --status done` + archive del aviso
