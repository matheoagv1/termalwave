---
name: tw
description: Protocolo de coordinacion TermalWave por el hub tw (tareas, notify, wakes, presencia, archivos, pins)
---

# tw: hub de coordinacion

El tablero es **tw** (hub Go). `scripts/comms.py` y `comms/` quedaron como legado. Roles: `vps` (Master), `carne` (PC Carne), `cricri` (PC Cricri). Tu credencial fija quien sos; no inventes identidades humanas.

## Cada turno

1. `pulse` (MCP o `tw pulse`). Devuelve tareas abiertas, inbox, wakes, peers y `brief_hash`. Si aparece `ALERTA`, tenes pendientes sin atender: resolvelos primero.
2. `brief_fetch` solo si `brief_hash` cambio.
3. Sin inbox ni wakes y en idle: **parar**. No explorar.
4. Si actuas: `inbox_fetch` + `tasks_list`; `archive` cada notify ya atendido.

## Comandos (CLI y MCP equivalentes)

- `tw task add|set|list`, `tw status` (solo tuyas). `task set ID --status in_progress|blocked|done`.
- `tw notify --to ROLE|broadcast --topic T --re ID --body "..."` (`--re` encadena la respuesta).
- `tw presence idle|working|waiting|offline`. `working` mientras trabajas, `waiting` si dependes de otro.
- `tw wake --to ROLE --reason delegate`. `tw inbox`, `tw archive ID`.
- `tw file put PATH --to ROLE [--purpose handoff|asset|prompt]` y `tw file get ID`; `tw file list`.
- `tw pin add|list|clear`: avisos fijos que ven todos en el brief.
- `tw who`: roster con presencia, `stream_state` y alertas. `tw watcher ping`: lo llama el vigilante de la PC; si se calla sale VIGILANTE MUERTO.
- `tw guard --install`: rechaza commits fuera de tus roots. `tw doctor` ante dudas.

## Limites

Cuerpo de notify/resumen 8000 car., tema 40, titulo de tarea 120, notas 4000, pin 80, paths 32. Notifies cortos igual: detalle en el repo y apuntar la ruta. Nunca secretos ni material de jurado en notifies, tareas ni archivos.

## Protocolo (topics de notify)

- `pending`: al empezar y terminar el turno, con tus ids abiertos.
- `start`: tomaste una tarea (`task set ... in_progress`).
- `leave`: la soltas o la bloqueas, con motivo.
- `handoff` + wake: otro rol encaja mejor (vps=pipeline/config/deploy, carne=web/MapLibre/timeline, cricri=contexto/copy/presets).
- Al terminar: `task set ID --status done`; el creador se entera solo. Al delegar: `task add --owner ROL` (paths dentro de sus roots).

## Reglas

- Edita solo tus roots o los `paths` de la tarea. Lo demas se pide al duenio por notify.
- Master integra `master`; carne y cricri trabajan en `work/carne` / `work/cricri`. Docs fuera de `web/` los aplica Master.
- Texto visible al usuario: ES-AR-SGO, sin jurado ni scoring.
- Si falla MCP, la CLI hace lo mismo. Antes de parar: presence `idle` tras pending/leave/handoff.
