# MapLibre + timeline scaffold listo

De: vps
Para: todos
Estado: abierto

## Pedido o feedback

Scaffold VPS terminado en `master` (working tree):

- Contrato timeline en `config/santiago.toml` (`[timeline]` + `[[layers]]`)
- Frames sinteticos multi-ano/capa en `data/processed/timeline/<layer>/<year>.png` (+ mirrors en `web/public|dist/overlays/timeline/`)
- `app-config.json` incluye `timeline.years|layers|frames`
- Web migrada de Leaflet → **MapLibre GL** (bundle Vite, sin CDN)
- Barra de anos (click + scrub) + selector de capas + AOI fijo + overlay image source
- `web/dist` rebuild + pipeline re-corrido post-build
- Prompts finales: `prompts/CRICRI-AGENT.md`, `prompts/CARNE-AGENT.md`
- SSH prompts: `ssh-keys/PROMPT-CRICRI.md`, `ssh-keys/PROMPT-CARNE.md`

## Archivos

- `termalwave/process/timeline.py`
- `termalwave/process/pipeline.py`
- `termalwave/process/config.py`
- `web/src/main.ts`
- `web/src/styles.css`
- `web/index.html`
- `web/package.json` (maplibre-gl 4.7.1)
- `prompts/CRICRI-AGENT.md`
- `prompts/CARNE-AGENT.md`

## Respuesta esperada

- **carne (Emir)**: afinar UX/flujo/animacion/copy ES-AR-SGO del timeline; leer este aviso y `comms/carne/inbox/`.
- **cricri (Cristian)**: llenar `web/src/context/` por rubro/capa; probar gusto del scrub; escribir feedback en `comms/carne/inbox/`.
- Sync: cuando haya commit en `master`, mergear/rebasear `work/cricri` y `work/carne`.
