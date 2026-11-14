# TermalWave — AGENTS.md (global)

Un solo repo. Todos los agentes leen **este archivo primero**, despues `agents/<rol>/AGENTS.md`, despues su bandeja en `comms/`.

Ruta del repo en el VPS: `/srv/sites/nasaspaceappchallenge`  
Ramas / worktrees del mismo git:

| Rol | Humano | Rama | Worktree |
|---|---|---|---|
| vps | Farid / Matheo (servidor) | `master` | `/srv/sites/nasaspaceappchallenge` |
| cricri | Cristian | `work/cricri` | `/srv/sites/nasaspaceappchallenge-cricri` |
| carne | Emir | `work/carne` | `/srv/sites/nasaspaceappchallenge-carne` |

No hay un segundo repo. Mergean a `master` cuando el trabajo del rol esta listo; el VPS integra.

`references/` **no** es documentacion de agentes. Ahi solo se dropean proyectos de codigo para mirar patrones (ver seccion abajo).

---

## De que se trata

TermalWave es una app interactiva que usa radar **NISAR** (NASA-ISRO, SAR) para **ver cambio de superficie** en el tiempo: overlays georreferenciados sobre un mapa MapLibre, con timeline tipo Timelapse y capas por fenomeno.

- Enunciado NASA (alcance): app interactiva; datos NISAR SAR; track/visualize surface change; audiencia amplia; medio digital usable.
- AOI por defecto: **Santiago del Estero** (`config/santiago.toml`). Cualquier zona del mundo = otro TOML (bounds, paths, stems, web). Cero ciudad hardcodeada en el codigo de UI: sale de `app-config.json`.
- Pipeline: HDF5 → PNG + JSON (numpy/h5py/Pillow vendored, Python 3.11, sin GDAL). Offline real.
- UI: MapLibre GL + barra de anos + capas `radar`, `suelo`, `contaminacion`, `incendios` + panel lateral.

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

1. Ver el cambio en el territorio (mapa, AOI, overlay, anos).
2. Confiar en el dato (origen, capa, bounds).
3. Correr sin circo (Python 3.11 + vendor; internet opcional salvo teselas base).
4. Oficios distintos, misma escena (capas/paneles por tarea).
5. Transferible (alguien de afuera entiende el flujo).

### Challenge NASA → nuestro mapeo

| Pedido NASA | Nuestro approach |
|---|---|
| App interactiva | Mapa + controles laterales + timeline + capas |
| NISAR SAR | HDF5 → overlays PNG georref |
| Surface change | Timeline multi-ano; capas de fenomeno |
| Audiencia amplia | UI neutra; contextos por oficio (cricri); portable |
| Insights accionables | Scrub temporal, capas, AOI estable, offline |

Vocabulario preferido en copy visible: radar, NISAR, backscatter, capa, cambio, suelo, agua, fecha, area de estudio. Evitar meta de challenge en la UI.

## Reglas y directivas (todos)

1. **Un repo, tres roles.** Lee global → `agents/<rol>/AGENTS.md` → `comms/<rol>/inbox/` + `comms/from-vps/`.
2. **Ownership:**
   - **vps**: `termalwave/`, `vendor/`, `scripts/`, `tests/`, `config/`, `data/`, `brand/` (kit de marca), contrato timeline, scaffold mapa cuando haga falta, `comms/from-vps/`.
   - **carne (Emir)**: `web/` UX/flujo/MapLibre/timeline chrome; consume assets desde `brand/`. Lee feedback de cricri y vps.
   - **cricri (Cristian)**: `web/src/context/` + tester de gusto + deposita el **monigote** en `brand/monigote/`. Escribe `comms/cricri/outbox/` y `comms/carne/inbox/`.
3. **Branding:** todo en `brand/` (iconos, wordmark, paleta, fonts, social, monigote). No dupliques fuentes de verdad en otros trees.
4. **Texto user-facing:** humanizer **ES-AR-SGO**. Cero slop de IA. Cero menciones a jurado/scoring/audiencias en strings visibles.
5. **Sin hardcode de sitio** en TS: todo sale de config / `app-config.json`.
6. **Portable:** Python pin en `config/runtime.json`; vendor linux/musl/win amd64 cp311; `web/dist` commiteado; sin GDAL; sin CDN obligatorio para el core.
7. **`references/`:** solo drops de codigo de referencia. No documentacion de agentes ahi. No copies codigo de esos proyectos ni los linkees como producto. Patrones actuales en disco (pueden no ir en git por tamano): `references/SgoLinea/`, `references/gods-eye-view/`.
8. **Comms:** formato en `comms/README.md`. No uses el chat entre roles como fuente de verdad: deja md en la bandeja.
9. **Master:** el VPS integra. carne/cricri no committees a `master` sin acuerdo. Empujan su rama `work/<rol>` y avisan.

## Orden de lectura por turno

1. `/AGENTS.md` (este archivo)
2. `agents/<tu-rol>/AGENTS.md`
3. `comms/<tu-rol>/inbox/` y `comms/from-vps/`
4. Si sos carne: tambien `comms/cricri/outbox/`
5. Si sos cricri: feedback pendiente hacia carne antes de pedir rediseños

## Que no es este archivo

Este archivo y `agents/*/AGENTS.md` **no** se sirven por `web/dist` ni se embeben en el frontend.
