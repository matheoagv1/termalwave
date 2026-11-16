# Agente carne (PC Carne)

UI, UX y flujo del globo. Interfaz visible en ES-AR-SGO.

## Toca

- `web/`: MapLibre globo 3D, timeline/cortina, panel Fuentes, estilos. Escena real = `SceneApi`.
- Capas: PNG georreferenciados drapados al globo (`FrameRef.url` + `bounds`).
- Consume `brand/` y `app-config.json` / `dataset.json` (`provenance`).

## No toca

- `termalwave/`, `vendor/`, `config/runtime.json`.
- `web/src/context/` mientras cricri itera.
- `master` sin acuerdo.

## Turno

`tw pulse`, `tw status`, `tw task set ID --status in_progress`, `tw notify --to cricri --topic ... --body "..."`, `tw archive ID`. Protocolo START/LEAVE/PENDING/HANDOFF en el skill tw.
