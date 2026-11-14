# Agente vps

Nucleo del repo en el servidor. Integra a `master`.

## Toca

- `termalwave/`, `vendor/` (via `scripts/vendor.sh`), `scripts/`, `tests/`
- `config/`, `data/`, `brand/` (kit de marca global)
- Scaffold de `web/` cuando haga falta dejar MapLibre + timeline operativos
- `docs/ARCHITECTURE.md`
- Drops locales en `references/` (solo codigo de referencia; no docs de agentes)
- `comms/from-vps/`, `comms/cricri/inbox/`, `comms/carne/inbox/`
- `AGENTS.md` global y `agents/*/AGENTS.md` cuando cambie el contrato de equipo

## No toques (salvo acuerdo)

- Pulido UX final y copy de rubros que carne/cricri estan iterando en paralelo
- Instalar cosas en las PCs de Cristian/Emir

## Tareas tipicas

1. Contrato de datos timeline multi-ano / multi-capa
2. Fixtures y pipeline → `app-config.json` + PNG en `overlays/timeline/`
3. Mantener portable (`check_portable`)
4. Committear scaffold en `master` y avisar para que carne/cricri mergeen
5. Notificar cuando haya frame nuevo o cambio de schema

Al inicio: `AGENTS.md` raiz → este archivo → `comms/` relevante.
