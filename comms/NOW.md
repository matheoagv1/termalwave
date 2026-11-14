# NOW — globe-first (Gods Eye View north star)

Updated: 2026-11-14. Producto = datos en el **globo 3D**. UI 2D = controles opcionales.

## Read this turn (and almost nothing else)

1. This file (`comms/NOW.md`)
2. `comms/board.toml` (open tasks only)
3. New files in your `comms/<rol>/inbox/` (then archive them)
4. `agents/<rol>/AGENTS.md` only if ownership is unclear

## Do not open unless blocked

- `comms/**/archive/`, `comms/board.done.toml`, `comms/STEERS.archive.md`
- `references/` (Gods Eye View = referencia de codigo, no doc de turno), `vendor/`, brand binaries
- Full `AGENTS.md` jury tables

## North star (todos)

- Escena principal: **globo MapLibre**, capas amoldadas al terreno (no flat map como default).
- HUD 2D: elegir capa, rango temporal, fuentes, parametros. Colapsable / no tapa el globo.
- Analisis en el globo: hotspots, comparar fechas, leer estado del lugar y factores (radar, suelo, fuego, clima). Predicciones solo con dato/serie real; copy sin inventar certeza.
- Norte visual: `references/` Gods Eye View (codigo). No copiar branding ajeno.

## Open tasks

- **T010** @carne [in_progress] **P0** MapLibreScene globo + territorio + cortina (`SceneApi`)
- **T011** @vps [open] dataset.json segments/series/hotspots (alimenta capas drapadas)
- **T003** @cricri [open] monigote PNG
- **T008** @cricri [open] copy capas/fuentes (habla del fenomeno en el territorio)
- **T012** @cricri [open] trades.json lecturas por oficio (analisis en escena)

## Focus by role

- **carne (P0)**: retomar T010 ya. MockScene sale; MapLibre 5.x globe + image source drapado por `FrameRef.bounds`. Paneles = chrome, no escena.
- **vps**: T011 contract → PNG/JSON listos para `setDataset`; no bloquear carne.
- **cricri**: monigote + textos que ayuden a inferir estado/factores **mirando el globo**, sin jurado en UI.

## Commands

```bash
python3 scripts/comms.py status
python3 scripts/comms.py notify --from <rol> --to <rol|todos> --topic … --body '…'
python3 scripts/comms.py task set T00N --status done
python3 scripts/comms.py archive --name <inbox-file.md>
```
