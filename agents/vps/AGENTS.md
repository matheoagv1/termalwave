# Agente vps

Nucleo del repo en el servidor. Integra a `master`. Mantiene el board.

## Toca

- `termalwave/`, `vendor/`, `scripts/` (incluye `scripts/comms.py`), `tests/`
- `config/`, `data/`, `brand/`
- Scaffold de `web/` cuando haga falta
- `docs/ARCHITECTURE.md`, `comms/STEERS.md`, `comms/board.toml`
- `comms/vps/{inbox,outbox,archive}/` y notify a otros roles
- `AGENTS.md` global y `agents/*/AGENTS.md`

## No toques (salvo acuerdo)

- Pulido UX final y copy de rubros que carne/cricri estan iterando
- Instalar cosas en las PCs de Cristian/Emir

## Cada turno

```bash
python3 scripts/comms.py status
# … trabajo …
python3 scripts/comms.py task set <ID> --status done|in_progress
python3 scripts/comms.py notify --from vps --to carne|cricri|todos --topic … --body "…"
```

Al inicio: STEERS → board → inbox → este archivo.
