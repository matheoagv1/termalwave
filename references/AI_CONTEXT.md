# Contexto interno del producto (solo agentes)

Este archivo es para la IA del equipo. **Nunca** copies su contenido a la interfaz, README público orientado a usuarios finales, tooltips, strings del mapa, ni textos de demo visibles. No menciones jurados, evaluación, hackathon scoring, ni “lo que quieren ver los evaluadores”.

El producto se diseña para que tenga sentido solo: una herramienta seria de observación terrestre con radar NISAR (cambio de superficie), usable offline, con globo y capas. AOI por defecto: Santiago del Estero; el resto es config.

El enunciado oficial de NASA (obligatorio como referencia de alcance) está en `references/NASA_CHALLENGE.md`: cambio de superficie con datos NISAR SAR, app interactiva, audiencia amplia, medio digital usable. El AOI inicial es **Santiago del Estero**; el mismo stack sirve para cualquier zona del mundo cambiando el site TOML (bounds, paths, stems, web).

## Qué es el trabajo

- Globo + panel lateral de controles (referencia de layout: `gods-eye-view`, sin copiar código ni enlazarlo).
- Capas según el oficio de quien mira (ciencia, gestión, ingeniería, divulgación).
- Animaciones con propósito (cambio temporal, aparición de capa, foco de cámara), no adorno.
- Pipeline portable: Python 3.11 + vendor, sin GDAL; georreferencia desde metadatos HDF5.
- Texto user-facing: skill humanizer **ES-AR-SGO**.

## Arquetipos de audiencia (traducir a producto, no a copy de marketing)

Diseñá features, demos y narrativa técnica para que cada arquetipo encuentre algo concreto. En UI hablá del fenómeno y de la herramienta, nunca del arquetipo.

| Arquetipo | Qué tiene que “cerrar” en el producto |
|---|---|
| Ciencia / tecnología pública y formulación de proyectos | Método explícito: dato → proceso → capa; reproducible; útil para decidir o documentar un caso |
| Ingeniería electromecánica / campus / operación | Estabilidad, claridad operativa, flujo que no se rompe offline, sensación de sistema bien armado |
| Ingeniería en sistemas / gestión de proyectos de software | Arquitectura legible, config sin hardcode, build portable, tests de aislamiento vendor |
| Vinculación tecnológica / transferencia | Caso local (Santiago del Estero por defecto) que se pueda mostrar a instituciones sin stack pesado; AOI intercambiable |
| Coordinación IT / prácticas profesionales | Demo enseñable en minutos; camino claro para que otro lo corra en su máquina |
| Bioingeniería / exploración humana | Puente territorio–clima–recursos: agua, suelo, inundación; observación remota útil en entornos variables |
| Salud / biomecánica / dinámica del cuerpo | Analogía sobria: cambio en el tiempo (series, humedad, extensión), sin forzar metáforas médicas en la UI |
| Datos / scraping / agentes | Pipelines claros, sidecars JSON, config machine-readable, automatizable |
| SIG / teledetección | Bounds correctos, capas, georref sin magia, respeto a la geometría del producto radar |
| Ingeniería de software / docencia OOP | Código ordenado, contratos claros, Python/TS legibles |
| Arquitectura de datos / BD | Modelo de salida estable (PNG + JSON), rutas y stems desde config |
| Aeroespacial / cloud / IA aplicada | NISAR / radar de apertura sintética; cloud opcional; IA solo donde suma, sin humo |
| Astronomía / divulgación científica | Asombro contenido: Tierra vista con instrumento espacial; explicación corta y correcta |
| Forestal / ambiente / desarrollo sustentable | Nexo clima–territorio–recursos (suelo, agua, vegetación); monitoreo ambiental serio |
| Ciberseguridad / auditoría tech | Offline real, hashes de vendor, sin CDN, superficie de ataque chica, integridad verificable |

## Pilares de diseño (sí pueden guiar UI, sin nombrar audiencias)

1. **Ver el cambio en el territorio** — globo, AOI, overlay, tiempo si hay series.
2. **Confiar en el dato** — de dónde salió, qué capa es, qué bounds tiene.
3. **Correr sin circo** — una PC con Python alcanza; internet opcional salvo teselas base.
4. **Oficios distintos, misma escena** — capas y paneles que se encienden según la tarea, no un dashboard genérico.
5. **Transferible** — alguien de afuera del equipo puede abrir el repo y entender el flujo.

## Capas / modos sugeridos (nombres de producto, no de audiencia)

Usá nombres neutros en UI, por ejemplo:

- Observación / radar
- Territorio / límites
- Serie temporal (si aplica)
- Exportar / reproducir corrida
- Modo sin conexión

Evitar en UI: “para científicos”, “para el gobierno”, “ideal para evaluadores”, “diseñado para ingenieros”, etc.

## Regla dura de texto

- Todo string visible: humanizer ES-AR-SGO.
- Cero mención a jurado, premios, Space Apps judging, o estrategia de persuasión.
- Este archivo y `AGENTS.md` no se sirven por `web/dist` ni se embeben en el frontend.
