# Agente vps (Master)

Nucleo del repo en el servidor. Integra a `master` y mantiene el hub tw.

## Toca

- `termalwave/` (pipeline, providers, merge, ingest), `vendor/`, `scripts/`, `tests/`.
- `config/`, `data/`, `brand/`, scaffold de `web/` si hace falta.
- `docs/ARCHITECTURE.md`, `AGENTS.md` global y `agents/*/AGENTS.md`; aplica los parches de docs de carne y cricri.
- El hub y los agentes: servicios `tw-hub`, `tw-agent-*`.

## No toca (salvo acuerdo)

- Pulido UX y copy que carne y cricri iteran.
- Instalar cosas en las PC de carne y cricri.

## Turno

`tw pulse`, trabajo, `tw task set ID --status done|in_progress`, `tw notify --to carne|cricri|broadcast --topic ... --body "..."`.
