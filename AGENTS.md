# TermalWave — AGENTS.md (global)

Un solo repo. Ruta VPS: `/srv/sites/nasaspaceappchallenge`.

| Rol | Humano | Rama | Worktree |
|---|---|---|---|
| vps | Farid / Matheo (servidor) | `master` | `/srv/sites/nasaspaceappchallenge` |
| cricri | Cristian | `work/cricri` | `/srv/sites/nasaspaceappchallenge-cricri` |
| carne | Emir | `work/carne` | `/srv/sites/nasaspaceappchallenge-carne` |

No hay un segundo repo. Mergean a `master` cuando el trabajo del rol esta listo; el VPS integra.

### Coordinacion (obligatorio cada turno) — lean

**Leer poco.** Fuente unica: harness + board.

1. `python3 scripts/comms.py pulse` (o hook briefing)
2. Si actuás: [`comms/NOW.md`](comms/NOW.md) + tu task (`paths` / `seat`)
3. Inbox nuevo → `archive`
4. `agents/<tu-rol>/AGENTS.md` solo si dudas ownership

**Idle/standby:** stop. No explores. **No leer:** archives, `board.done.toml`, `STEERS.archive.md`, `references/`, `vendor/`.

CLI: `pulse|seat|check|status|notify|task|archive|milestone|link-worktrees` ([`comms/README.md`](comms/README.md)).

Notify ≤280. `status` = solo tuyas (`--all` si hace falta). Tras corte: `milestone --label …`.

`references/` **no** es documentacion de agentes. Solo drops de codigo.

---

## De que se trata

TermalWave es una app interactiva que usa radar **NISAR** (NASA-ISRO, SAR) para **ver cambio de superficie** en el tiempo. La escena principal es un **globo 3D** (norte: Gods Eye View en `references/`, solo codigo). Las capas SAR y de fenomeno se **amoldan al terreno** del globo. La UI 2D (timeline, capas, fuentes, rangos) es **opcional**: sirve para elegir datos y parametros, no para reemplazar la vista.

- Enunciado NASA (alcance): app interactiva; datos NISAR SAR; track/visualize surface change; audiencia amplia; medio digital usable.
- AOI por defecto: **Santiago del Estero** (`config/santiago.toml`). Cualquier zona del mundo = otro TOML (bounds, paths, stems, web). Cero ciudad hardcodeada en el codigo de UI: sale de `app-config.json`.
- Pipeline: HDF5 → PNG + JSON (numpy/h5py/Pillow vendored, Python 3.11, sin GDAL). Offline real.
- UI: MapLibre GL **globo** + cortina/timeline + capas `radar`, `suelo`, `contaminacion`, `incendios` + panel lateral colapsable.
- Analisis en escena: hotspots, series, comparar fechas, leer estado del lugar y factores (clima, fuego, suelo, radar) sin sacar al usuario del globo. Predicciones = capas/series derivadas cuando el dato alcanza; no inventar certeza en copy.

## Por que lo estamos haciendo

Hackathon **NASA Space Apps**. El entregable tiene que cerrar el challenge de NASA y, a la vez, convencer a un jurado local con perfiles concretos (abajo). El producto se tiene que sostener solo como herramienta de observacion terrestre: no como pitch de hackathon en la pantalla.

## A quien se lo mostramos (jurado / evaluacion) — solo agentes

Esto es perfilado interno. **Nunca** va a la UI, README de usuario final, tooltips, demos visibles, ni strings del mapa. No menciones jurado, scoring, Space Apps judging, ni “para impresionar evaluadores” en nada que vea un usuario.

Disená features, demos y narrativa tecnica para que cada arquetipo encuentre algo concreto. En UI hablá del fenomeno y de la herramienta, nunca del arquetipo.

| Arquetipo | Que tiene que “cerrar” en el producto |
|---|---|
| Ciencia / tecnologia publica y formulacion de proyectos | Metodo explicito: dato → proceso → capa; reproducible; util para decidir o documentar |
| Ingenieria electromecanica / campus / operacion | Estabilidad, flujo offline, sensacion de sistema bien armado |
| Ingenieria en sistemas / gestion de proyectos de software | Arquitectura legible, config sin hardcode, build portable, tests de aislamiento vendor |
| Vinculacion tecnologica / transferencia | Caso local (Santiago del Estero) mostrable sin stack pesado; AOI intercambiable |
| Coordinacion IT / practicas profesionales | Demo ensenable en minutos; camino claro para que otro lo corra |
| Bioingenieria / exploracion humana | Puente territorio–clima–recursos (agua, suelo, inundacion) |
| Salud / biomecanica / dinamica del cuerpo | Cambio en el tiempo (series, humedad, extension), sin metaforas medicas en la UI |
| Datos / scraping / agentes | Pipelines claros, sidecars JSON, config machine-readable |
| SIG / teledeteccion | Bounds correctos, capas, georref sin magia |
| Ingenieria de software / docencia OOP | Codigo ordenado, contratos claros, Python/TS legibles |
| Arquitectura de datos / BD | Modelo de salida estable (PNG + JSON), rutas y stems desde config |
| Aeroespacial / cloud / IA aplicada | NISAR / SAR; cloud opcional; IA solo donde suma |
| Astronomia / divulgacion cientifica | Tierra vista con instrumento espacial; explicacion corta y correcta |
| Forestal / ambiente / desarrollo sustentable | Nexo clima–territorio–recursos; monitoreo ambiental serio |
| Ciberseguridad / auditoria tech | Offline real, hashes de vendor, sin CDN obligatorio, superficie chica |

### Pilares de diseno (si guian UI, sin nombrar audiencias)

1. **Globo primero.** La verdad visual es 3D sobre la Tierra; paneles 2D son controles, no el producto.
2. Ver el cambio en el territorio (AOI, capa drapada, anos, cortina).
3. Confiar en el dato (origen, capa, bounds, provenance).
4. Correr sin circo (Python 3.11 + vendor; internet opcional salvo teselas base).
5. Oficios distintos, misma escena (contextos/capas por tarea, sin sacar del globo).
6. Transferible (alguien de afuera entiende el flujo).

### Challenge NASA → nuestro mapeo

| Pedido NASA | Nuestro approach |
|---|---|
| App interactiva | Globo 3D + controles laterales opcionales + timeline + capas |
| NISAR SAR | HDF5 → overlays PNG georref drapados al globo |
| Surface change | Timeline multi-ano; capas de fenomeno en escena |
| Audiencia amplia | UI neutra; contextos por oficio (cricri); portable |
| Insights accionables | Scrub temporal, hotspots, series, AOI estable, offline |

Vocabulario preferido en copy visible: radar, NISAR, backscatter, capa, cambio, suelo, agua, fecha, area de estudio. Evitar meta de challenge en la UI.

## Reglas y directivas (todos)

1. **Un repo, tres roles.** STEERS → board → inbox → este archivo → `agents/<rol>/AGENTS.md`.
2. **Ownership:**
   - **vps**: `termalwave/` (pipeline, providers, merge), `vendor/`, `scripts/`, `tests/`, `config/` (`apis.toml`, secrets locales), `data/`, `brand/`, board/STEERS, scaffold mapa, integra `master`.
   - **carne (Emir)**: `web/` UX/flujo/MapLibre/timeline + panel **Fuentes de datos** (lee `provenance`); consume `brand/`. Board + `comms/carne/`.
   - **cricri (Cristian)**: `web/src/context/` (incl. textos de fuentes/capas) + tester + `brand/monigote/`. Board + `comms/cricri/`.
   - **Secretos:** solo `config/secrets.local.toml` / env. Nunca en prompts, board ni UI. Sin credencial → adapter skip.
3. **Branding:** todo en `brand/`. No dupliques fuentes de verdad.
4. **Texto user-facing:** humanizer **ES-AR-SGO**. Cero slop de IA. Cero jurado/scoring/audiencias en UI.
5. **Sin hardcode de sitio** en TS: config / `app-config.json`.
6. **Portable:** Python pin en `config/runtime.json`; vendor linux/musl/win amd64 cp311; `web/dist` commiteado; sin GDAL; sin CDN obligatorio.
7. **`references/`:** solo codigo de referencia (puede estar gitignored por tamano).
8. **Comms / board:** unica fuente de delegacion. `notify` + `task set`. Chat de PC no cuenta.
9. **Master:** VPS integra. carne/cricri no committees a `master` sin acuerdo.

## Cierre de turno (todos)

1. `python3 scripts/comms.py task set <ID> --status …`
2. Si delegaste: `notify --from <rol> --to <rol|todos> …`
3. Archiva inbox resuelto: `archive --name …`
4. Si sos carne: mira tambien `comms/cricri/outbox/`
5. Si sos cricri: feedback a carne via `notify` o su inbox

## Que no es este archivo

Este archivo y `agents/*/AGENTS.md` **no** se sirven por `web/dist` ni se embeben en el frontend.
