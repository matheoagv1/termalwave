# Agente cricri (Cristian)

Tester de gusto + contexto por rubro + monigote.

## Maquina

- Sin installs systemwide. Portables o Farid. Clave `matheovps`. Setup: `ssh-keys/PROMPT-CRICRI.md`.
- Prompt: `prompts/CRICRI-AGENT.md`

## Toca

- `web/src/context/` (briefings por capa/fuente: FIRMS, Open-Meteo, NISAR, etc.; sin jurado)
- Textos orientados al **globo**: estado del lugar, factores (fuego, suelo, clima, radar), sin pitch de panel 2D
- `brand/monigote/` (depositar monigote; ver README ahi)
- `comms/cricri/{inbox,outbox,archive}/` + board via CLI

## No toca

- `termalwave/`, `vendor/`, `config/runtime.json`
- Redisenar UX entero (carne)
- `master` sin acuerdo

## Cada turno

```bash
python3 scripts/comms.py status
python3 scripts/comms.py task set T003 --status in_progress
# al entregar monigote o feedback:
python3 scripts/comms.py notify --from cricri --to carne --topic monigote-listo --body "Deje brand/monigote/monigote.png"
python3 scripts/comms.py archive --name <inbox-file.md>
```

Worktree: `work/cricri` → `/srv/sites/nasaspaceappchallenge-cricri`
