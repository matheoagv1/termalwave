# TermalWave — AGENTS.md (global)

Un solo repo. Ruta VPS: `/srv/sites/nasaspaceappchallenge`.

| Rol | Humano | Rama | Worktree |
|---|---|---|---|
| vps | Farid / Matheo (servidor) | `master` | `/srv/sites/nasaspaceappchallenge` |
| cricri | Cristian | `work/cricri` | `/srv/sites/nasaspaceappchallenge-cricri` |
| carne | Emir | `work/carne` | `/srv/sites/nasaspaceappchallenge-carne` |
| anto | Anto | `work/anto` | `/srv/sites/nasaspaceappchallenge-anto` |

No hay un segundo repo. Mergean a `master` cuando el trabajo del rol esta listo; el VPS integra.

### Coordinacion (obligatorio cada turno) — hub next

**Leer poco.** Fuente unica: `twd` + hub UI (`http://…:7443`).

1. `twd whoami` · `twd sessions` · `twd wakes`
2. Si actuás: mensajes / `twd events` de tu sesión; responder con `twd send`
3. Abrir chat: `twd open --title "…" --agent <rol>` desde el worktree
4. `agents/<tu-rol>/AGENTS.md` solo si dudas ownership

**Idle / sin wakes:** stop. No explores. **No leer:** archives, `board.done.toml`, `STEERS.archive.md`, `references/`, `vendor/`.

**Legacy muerto:** no uses `tw`, `tw pulse`, `scripts/comms.py`, ni `.tw/`. Config: `.twd/config.json` (gitignored). Guía: `docs/handoff/hub-next-vps-matheo.txt`.

Sin board de tasks/pins: el estado se reporta por mensajes. LAND → FF en master ≤10 min → DEPLOY.

`references/` **no** es documentacion de agentes. Solo drops de codigo.

---

## De que se trata

TermalWave es una app interactiva que usa radar **NISAR** (NASA-ISRO, SAR) para **ver cambio de superficie** en el tiempo. La escena principal es un **globo 3D** (norte: referencia en `references/`, solo codigo). Las capas SAR y de fenomeno se **amoldan al terreno** del globo. La UI 2D (timeline, capas, fuentes, rangos) es **opcional**: sirve para elegir datos y parametros, no para reemplazar la vista.

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

## Guía de UI, UX y datos de Termal Wave

### Producto
- Termal Wave muestra cambios de superficie con radar NISAR y datos abiertos. Cada capa responde: **qué es, para quién, qué decisión ayuda a tomar**.
- El núcleo NISAR está siempre presente; el usuario elige qué vista de NISAR ver.
- Personas: brigada/Dirección de Bosques, asesor agro/INTA, docente/periodista.

### Honestidad de datos (no negociable)
- Toda capa declara su etiqueta: MEDIDO, DERIVADO, MODELO, INFERIDO o EJEMPLO, visible en la fila, la leyenda, la lectura y Fuentes.
- Lo que falta es **"sin dato"** con motivo. Nunca 0, nunca cielo despejado, nunca un valor interpolado sin avisar.
- Respuesta OK con 0 resultados = estado "sin datos en esta ventana" (neutro, no rojo).
- Conteos parciales llevan "SOLO VISTA ACTUAL".
- Fallback o cache: decirlo ("usando cache del 14 nov").
- Inferencias muestran su fórmula y supuestos. Sismicidad: "susceptibilidad", nunca "predicción".
- Paletas con rango físico fijo y unidades. Prohibido rotular dB una rampa 0–1.
- Productos NISAR: mostrar producto exacto (`NISAR_L2_GCOV_V1`…), fecha de adquisición y madurez (validado/provisional/beta).
- Lo decorativo (runas, brillos del HUD) se documenta como decorativo en el componente.
- Nada de textos para desarrolladores, ni de puntaje/jurado, en strings de la UI.

### Idiomas (ES/EN)
- La app es bilingüe completa: inglés y español rioplatense. Ningún string visible fuera de `t()`; ningún componente con texto literal.
- Diccionarios en `web/src/context/locales/{es,en}.ts` con las mismas claves. Una clave nueva se agrega en los dos a la vez.
- Orden de idioma: `?lang=` en la URL > elección guardada (`tw-lang`) > **inglés por defecto** (período de evaluación).
- Prohibido mezclar idiomas en una pantalla: datos externos (geocoder, Worker, `layers.toml`) también vienen en el idioma activo o se traducen por código.
- Números, fechas y unidades con `Intl` según el idioma (ES `−17,8 dB` · `2 nov 2026, 19:22 ART`; EN `−17.8 dB` · `Nov 2, 2026, 7:22 PM ART`). Zona horaria fija `America/Argentina/Buenos_Aires`.
- Traducir el sentido, no las palabras. El inglés suena nativo; el español usa voseo.

### Arquitectura de capas
- Una capa = fuente (consigue registros) + render (dibuja) + ficha (metadatos). Interfaz: init / enable / disable / update / destroy / getStats.
- La fuente no toca el mapa; el render no hace fetch.
- Secretos solo del lado servidor (Worker o pipeline). Nunca en el bundle, el board, notify ni la UI.
- Capa nueva = ficha completa en `config/layers.toml` (id, label corto, category, honesty, what, decision, unit, range, ramp, nodata, source, product, resolution, cadence, license, needs_key, fetch, formula, caveats) + entrada en Fuentes + captura y video corto en el PR.
- No redistribuir datos sin permiso: si la licencia no lo deja, se pide en runtime.

### Layout y navegación
- El globo manda; la UI es vidrio oscuro en los bordes.
- Rail izquierdo: Datos · Modelos y pronósticos · Inferencias · Utilidades · Anotación y análisis · Visual.
- Rail derecho: Área · Lectura · Fuentes · Leyenda · Inspección.
- Un panel abierto por lado. El encabezado del panel queda fijo fuera del área con scroll.
- Fila de capa: toggle + nombre corto + una línea meta (fuente · fecha · etiqueta). Ajustes en la tarjeta, plegados.
- "Volver a la Tierra" = alejarse manteniendo el centro (~2,8 s) y luego ir a la vista inicial. No borra paneles, capas ni anotaciones.
- Mobile: barra inferior de pestañas y hojas inferiores.

### Estética de marca
- Tokens `--tw-*` del kit; cian = radar, brasa = calor, dorado = acento/inferencias, naranja = EJEMPLO.
- Press Start 2P solo para etiquetas cortas y HUD (8/16/24 px). Cuerpo en IBM Plex Sans; números en IBM Plex Mono. Fuentes servidas localmente con `@font-face`.
- Íconos: solo `lucide-react` a través de `web/src/ui/icons.ts`. SVG propio solo si Lucide no lo tiene (sombrero, báculo, runas, glifos NISAR), en `web/src/ui/icons/custom/`, grilla 24, mismo trazo.
- Animación con mesura: un elemento animado a la vez, 150–300 ms en UI, sin loops decorativos, todo apagable, respeta `prefers-reduced-motion`. Sonido apagado por defecto.
- El monigote reacciona a estados (cargando, sin datos, error, éxito); nunca tapa paneles ni leyendas.

### Calidad antes de mergear
- Probar: panel abierto, plegado, oculto, deshabilitado y con error; foco de teclado; Escape; mouse y touch; último ítem con scroll; resize sin recargar; 390 px de ancho.
- Nombres accesibles cortos (`aria-label`), descripción en `aria-describedby`.
- Sin errores nuevos en consola; sin requests a endpoints inexistentes.
- Flujo: LAND → FF ≤ 10 min → DEPLOY. Verificar en vivo que el hash del bundle cambió.
