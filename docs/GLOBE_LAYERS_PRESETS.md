# Globo global + capas + presets de rubro

Investigación 2026-11-14. Referencia: `references/` (pull actualizado).

## Qué vemos hoy en TermalWave

- MapLibre **globo** con basemap mundial (GIBS/CARTO/EOX).
- Capas de fenómeno = `image` source con **4 esquinas del AOI** (`ds.area.bounds`). Por eso se ve un solo cuadrante brillante (Santiago), no una envoltura global.
- Cámara / Urbano-Campo encuadran ese rectángulo.
- Rubros (`trades.json`) solo cambian el **texto** de Lectura. No prenden ni apagan capas. Por eso “Gestión de emergencias” no activa incendios ni nada.

## Cómo lo hace la referencia

- Cesium: capas drapeadas al **globo entero** (`Rectangle.MAX_VALUE` / tiling worldwide).
- FIRMS: heatmap full-globe + detalle por viewport.
- Weather/wind: rasters tiles globales.
- Catálogo de capas con enable/disable independiente (`LayerPanel` + manager).
- “Presets” = estilos visuales (CRT/NVG/FLIR) y modos (Contacts / Global Context), **no** rubros de oficio.
- Búsqueda: presets de ciudad bundled → Photon → Nominatim.

## Modelo que queremos (producto)

Tres **categorías** de capas (separadas en UI y en config):

1. **Datos** — observación / provenance (radar NISAR, FIRMS, clima, óptico…).
2. **Predicciones** — series/capas derivadas con horizonte temporal explícito.
3. **Extrapolaciones / inferencias** — mezcla y algoritmos nuestros (índices, “suelo/contaminación” sintéticos, etc.) con disclaimer.

**Rubros = presets**, no otra categoría:

- Un preset prende un set de capas (de las 3 categorías).
- El usuario puede seguir prendiendo/apagando capas a mano.
- Se pueden guardar presets propios.
- El texto de oficio (cricri) acompaña el preset; no lo reemplaza.

## Camino técnico

1. Dejar el AOI como **caso/focus**, no como único footprint de capa.
2. Capas globales = tiles WMTS/XYZ o heatmap full-globe (patrón FIRMS/weather), no un PNG único del AOI.
3. PNG AOI queda para radar local / caso Santiago.
4. Contrato JSON: `layers[].category = data|prediction|inference` + `presets[]` con `layerIds`.
5. UI Capas agrupada por las 3 categorías; panel Rubros aplica preset sin bloquear toggles.


## Núcleo obligatorio — NASA Space Apps 2026 (*Dancing with the SARs*)

Los datos **centrales** del producto son los del challenge: radar **NISAR SAR** y la visualización de **cambio de superficie en el tiempo** (timeline / cortina / capas radar drapadas).

Reglas:

1. Esas capas están **siempre activas**. No las apaga un rubro ni un preset de usuario.
2. En contrato: `core = true` (o `category = data` + `required = true`) para `radar` / productos NISAR GCOV y el eje temporal de surface change.
3. Rubros y presets solo suman o quitan capas **satélite** (óptico, FIRMS, clima) y capas de **predicción / inferencia**. Nunca dejan el globo sin SAR.
4. Copy UI: hablar de radar, NISAR, backscatter, cambio de superficie — no de “challenge” ni scoring.
5. Basemap (GIBS/CARTO/…) es escenario visual; no reemplaza el núcleo SAR.

IDs mínimos always-on (v1): `radar` (+ timeline frames NISAR). El resto (`suelo`, `contaminacion`, `incendios`, clima, óptico, predicciones) es opt-in vía preset o toggle.
