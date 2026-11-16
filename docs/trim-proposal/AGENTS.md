# TermalWave: AGENTS.md

Un repo, tres roles. Coordinacion por el hub **tw** (ver `docs/trim-proposal/SKILL-tw.md` o `tw prompt`). Esta version recortada; el texto completo esta en `docs/archive/AGENTS-full.md`.

| Rol | Maquina | Rama | Worktree |
|---|---|---|---|
| vps | Master (servidor) | `master` | `/srv/sites/nasaspaceappchallenge` |
| carne | PC Carne | `work/carne` | `/srv/sites/nasaspaceappchallenge-carne` |
| cricri | PC Cricri | `work/cricri` | `/srv/sites/nasaspaceappchallenge-cricri` |

Master integra a `master`. carne y cricri no commitean a `master` sin acuerdo.

## Cada turno (lean)

1. `tw pulse`. Idle sin inbox ni wakes: parar, no explorar.
2. Si actuas: tu tarea (`tw status`) y el inbox nuevo; `tw archive` lo resuelto.
3. `agents/<rol>/AGENTS.md` solo si dudas de ownership.
4. No leer: `docs/archive/`, `references/`, `vendor/`, `web/dist/assets/`.
5. Cierre: `tw task set ID --status ...`, `tw notify` si delegaste, `tw presence idle`.

El chat de la PC no cuenta como delegacion: vale `notify` + tarea con `paths`.

## Producto

TermalWave usa radar **NISAR** (SAR) para ver cambio de superficie en el tiempo. Escena principal: **globo 3D** MapLibre con capas `radar`, `suelo`, `contaminacion`, `incendios` drapadas al terreno. La UI 2D (timeline, capas, fuentes) es control opcional, no el producto.

- AOI por defecto: Santiago del Estero (`config/santiago.toml`). Otra zona = otro TOML; cero ciudad hardcodeada en TS (sale de `app-config.json`).
- Pipeline: HDF5 a PNG + JSON (numpy/h5py/Pillow vendored, Python 3.11, sin GDAL). Offline real.
- Analisis en escena: hotspots, series, comparar fechas, estado del lugar. No inventar certeza en copy.
- Challenge NASA: app interactiva, NISAR SAR, cambio de superficie, audiencia amplia, insights accionables.

## Pilares de diseno

1. Globo primero; paneles 2D son controles.
2. Ver el cambio en el territorio (AOI, capa drapada, anos, cortina).
3. Confiar en el dato (origen, capa, bounds, provenance).
4. Correr sin circo (Python 3.11 + vendor; internet solo para teselas base).
5. Oficios distintos, misma escena.
6. Transferible: alguien de afuera entiende el flujo.

Evaluacion: perfiles de jurado en `docs/archive/AGENTS-full.md`. Son solo para agentes: **nunca** jurado, scoring ni audiencias en la UI, README de usuario, tooltips ni strings del mapa.

## Ownership

- **vps**: `termalwave/`, `vendor/`, `scripts/`, `tests/`, `config/`, `data/`, `brand/`, docs de IA, scaffold de mapa; integra `master`.
- **carne**: `web/` (UX, flujo, MapLibre, timeline, panel Fuentes que lee `provenance`); consume `brand/`.
- **cricri**: `web/src/context/` (textos de fuentes y capas), tester, `brand/monigote/`.
- `tw guard` rechaza commits fuera de tus roots. Docs fuera de `web/`: prepara un parche y avisa a Master.

## Reglas

1. Secretos solo en `config/secrets.local.toml` o env. Nunca en prompts, tareas ni UI. Sin credencial, el adapter se saltea.
2. Branding en `brand/`; una sola fuente de verdad.
3. Texto visible: ES-AR-SGO, sin slop de IA.
4. Portable: Python pin en `config/runtime.json`; vendor linux/musl/win amd64 cp311; `web/dist` commiteado; sin CDN obligatorio.
5. `references/` es solo codigo de referencia, no documentacion.
6. Este archivo y `agents/*/AGENTS.md` no se sirven en `web/dist`.
