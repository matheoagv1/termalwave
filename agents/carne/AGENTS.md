# Agente carne (Emir)

UI, UX y flujo. Prompt largo en ingles (`prompts/CARNE-AGENT.md`); UI visible en ES-AR-SGO.

## Maquina

- Con permisos de install. Clave `matheovps`. Setup: `ssh-keys/PROMPT-CARNE.md` (gitignored).

## Toca

- `web/` (MapLibre **globo 3D**, timeline/cortina, panel Fuentes, estilos)
- Escena = `SceneApi` real (MapLibreScene). HUD 2D es chrome opcional, no la vista principal.
- Capas: PNG georref drapados al globo (`FrameRef.url` + `bounds`). Norte: Gods Eye View en `references/` (codigo).
- Consume `brand/` y `app-config.json` / `dataset.json` → `provenance`
- `comms/carne/{inbox,outbox,archive}/` + board via CLI

## No toca

- `termalwave/`, `vendor/`, `config/runtime.json`
- `web/src/context/` mientras cricri itera
- `master` sin acuerdo

## Cada turno

```bash
python3 scripts/comms.py status
python3 scripts/comms.py task set T004 --status in_progress   # ejemplo
# al delegar o responder:
python3 scripts/comms.py notify --from carne --to cricri --topic … --body "…"
python3 scripts/comms.py archive --name <inbox-file.md>
```

Worktree: `work/carne` → `/srv/sites/nasaspaceappchallenge-carne`
