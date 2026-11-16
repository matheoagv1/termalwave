# TermalWave: plan de ejecución

Este archivo es la fuente de verdad para construir el prototipo. Seguilo en orden. Si algo no está definido acá, decidí lo mínimo y anotalo en la sección "Notas de integración" de `TermalWave Sistema.dc.html`.

Archivos que ya existen y no se reescriben: `tw/contract.ts` (contrato con agregados), `tw/catalog.es-AR.js` (catálogo de textos y formateadores `F`). Si falta un texto, se agrega al catálogo, nunca en un componente.

## 0. Archivos a producir

```
tw/contract.ts            listo
tw/catalog.es-AR.js       listo
tw/mock-provider.js       MockProvider (ES module)
tw/mock-scene.js          MockScene (ES module, globo canvas + territorio DOM)
TermalWave.dc.html        prototipo navegable (un solo DC)
TermalWave Estados.dc.html  tablero de estados con iframes del prototipo
TermalWave Sistema.dc.html  sistema visual, movimiento, componentes, catálogo, notas
```

El DC carga los tres módulos en `componentDidMount` con
`import(new URL('tw/x.js', document.baseURI).href)`. Nada de `fetch`. La interfaz se muestra cuando el catálogo está listo (milisegundos); los datos llegan después.

## 1. Dirección visual

Instrumento de observación: oscuro, denso, cantos rectos (radius 0 en todo), sin sombras, sin degradados salvo rampas de datos y el sombreado del globo. Paneles translúcidos con `backdrop-filter: blur(10px)` y borde de 1 px. Mayúsculas solo donde el idioma las pide (nada de `text-transform: uppercase`).

### Tokens (en `<helmet><style>` como variables, única excepción a estilos en línea, necesaria para tema claro/oscuro)

Oscuro (`:root, [data-tw-theme="dark"]`):
```
--bg #06080a        --panel rgba(10,13,16,.84)   --panel-solid #0b0f12
--sel rgba(255,255,255,.06)   --line #232c34   --line2 #3a4651
--fg #e8ecef   --fg2 #a2acb5   --fg3 #7c8792
--acc oklch(0.82 0.15 78)   --acc-ink #14110a   --acc-fg oklch(0.82 0.15 78)   (momento A, foco)
--accB oklch(0.80 0.11 215) --accB-ink #061218                                (momento B al comparar)
--warn oklch(0.80 0.14 55)  --ok oklch(0.78 0.13 155)
--hatch rgba(240,200,140,.38)
--scene-sphere #0c1217  --scene-land #5d6b77  --scene-grid rgba(150,170,190,.14)
--scene-ground #10161b  --scene-ground-hi #1d262d  --scene-line rgba(160,180,200,.16)
--scene-label #8c98a3   --scene-hatch rgba(255,200,120,.22)  --scene-outline rgba(230,235,240,.55)
--scene-spot #f2f4f5
```
Claro (`[data-tw-theme="light"]`):
```
--bg #e7eaec   --panel rgba(248,249,250,.9)   --panel-solid #f6f7f8   --sel rgba(0,0,0,.05)
--line #cdd3d8   --line2 #9aa4ad   --fg #0e1215   --fg2 #47515a   --fg3 #5d6770
--acc oklch(0.80 0.15 78)  --acc-ink #14110a  --acc-fg oklch(0.50 0.12 65)
--accB oklch(0.62 0.12 230)  --accB-ink #ffffff
--warn oklch(0.55 0.15 50)  --ok oklch(0.55 0.13 155)  --hatch rgba(150,80,10,.4)
--scene-sphere #dfe4e8  --scene-land #7d8a95  --scene-grid rgba(40,60,80,.14)
--scene-ground #d9dee2  --scene-ground-hi #eef1f3  --scene-line rgba(30,50,70,.16)
--scene-label #4e5862   --scene-hatch rgba(170,90,10,.28)  --scene-outline rgba(15,20,25,.6)
--scene-spot #111417
```
Regla de acento: `--acc` se usa como relleno (con `--acc-ink` encima); `--acc-fg` como texto o línea. Nunca texto acento sobre fondo claro con `--acc`.

Tipografía (local, sin CDN; en prototipo cae a sistema):
```
--sans "IBM Plex Sans", "Segoe UI", system-ui, sans-serif     interfaz
--mono "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace   fechas, valores, coordenadas, marca
```
Escala: 11 (meta mono) · 12 (secundario) · 13 (base) · 15 (título de panel) · 20 (valor de ficha, mono) · 32 (nombre del área en entrada).

Espaciado: base 4. Márgenes de paneles al borde 12 px (escritorio) y 8 px (móvil). Padding interno de panel 12 px. Gap entre paneles 8 px.

Controles: alto 32 px escritorio, 44 px móvil (prop `lay.hit`). Botón primario: fondo `--acc`, texto `--acc-ink`. Secundario: borde `--line2`, fondo transparente. Activo/pulsado: fondo `--sel` + borde `--acc-fg`. Foco: `:focus-visible { outline: 2px solid var(--acc) !important; outline-offset: 1px }` en helmet.

Íconos: sin fuente de íconos. Formas CSS simples: play (triángulo con bordes), pausa (dos barras), brújula (triángulo rotado), globo (círculo con borde), más/menos (texto). Nada de SVG complejo.

Rampas por capa (las define el MockProvider, la leyenda las lee del dato):
```
radar          dB      [-20,-4]  #0c1622 0 · #24476a .35 · #6fa3c4 .7 · #e2f1f8 1       decimals 1
suelo          %       [20,50]   #6b4423 0 · #b0823f .3 · #d8c98a .55 · #6fae86 .78 · #2a6f78 1   decimals 0
contaminacion  índice  [0,1]     #140f24 0 · #4b2a7a .35 · #b0428a .65 · #ffb26b 1       decimals 2
incendios      ha      [0,60]    #24211f 0 · #5e2617 .35 · #d0521f .7 · #ffd36b 1       decimals 0
```
Color "swatch" de una capa (pips de la línea de tiempo) = color de la rampa más cercano a `at = .7`.

## 2. Layout

### Escritorio (ancho del root ≥ 760)
```
top 12: [marca + área + "Datos de ejemplo"]  [buscar (max 440, centrado)]  [estado] [?]
left 12, top 64:  dock de capas (220 px, columna)
left 12, bottom tlH+24: controles de cámara (columna: brújula, tilt −/valor/+, volver a la Tierra)
right 12, top 64, bottom tlH+24, 300 px: columna flex: ficha (flex 1, overflow auto) + leyenda (abajo)
top 64 centrado: rótulo del mapa (aria-live="polite"), debajo el aviso de comparar
left 12, right 12, bottom 12: línea de tiempo (alto medido con ResizeObserver → tlH)
tarjeta de detalle: anclada al punto con scene.project(), 240 px, limitada al área libre
toast de cruce de tramo: centrado, justo arriba de la línea de tiempo
```
Padding que se le pasa a la escena: `{top:64, left:250, right:330, bottom:tlH+28}` en territorio. En órbita: `{top:60, right:20, bottom:20, left:460}` (la tarjeta de entrada está a la izquierda, el globo queda centrado en el espacio libre).

### Móvil (< 760)
```
top 8: [marca + "Datos de ejemplo"] [lupa abre buscador a todo el ancho] [punto de estado] [?]
top 52: capas como fila de chips con scroll horizontal
top 100 centrado: rótulo del mapa
right 8, top 100: controles de cámara en columna compacta
bottom 52: línea de tiempo (8 px a los lados)
bottom 0: hoja de ficha. Plegada: 44 px con "Ficha del área", valor actual y mini rampa. Desplegada: 70% del alto, tapa la línea de tiempo, contiene ficha + leyenda.
tarjeta de detalle: a lo ancho (8 px), arriba de la línea de tiempo
entrada: tarjeta abajo a lo ancho; padding del globo bottom 320
```

Todas las posiciones que cambian entre escritorio y móvil salen de un objeto `lay` en `renderVals()` (strings px) usado en holes de `style`. Es estado vivo de tamaño, permitido. Lo que no cambia va literal.

## 3. Estados de cámara y qué se ve

| cámara | visible |
|---|---|
| orbit | barra superior, globo girando, tarjeta de entrada (o chip "Ir al área" + "Arrastrá para girar la Tierra." si explorando) |
| approach | barra superior, rótulo "Aproximación al área". Paneles ocultos |
| territory | todo el HUD |
| detail | todo el HUD + tarjeta de detalle; la escena hace zoom al punto |

Error de configuración: tarjeta centrada en lugar de la entrada (título, detalle, código mono, "Volver a intentar", "Explorar el mundo"); el globo sigue funcionando.

## 4. Línea de tiempo (pieza central)

### Estructura del panel
Fila 1 (cabecera):
- `[▶/❚❚]` `[‹]` `[›]`
- Nombre del momento en mono 15: `T.tickName(kind,label)` ("Compuesto 2022", "Pasada del 29 mar 2026")
- Meta en 11 mono `--fg2`: `segmento · granularidad (o "pasada cada 12 días") · resolución · fuente`, y si hay evento en ese punto `Evento: …`
- Derecha (solo escritorio): leyenda de tipos (`■ Compuesto`, `| Pasada`, `▨ Sin imagen`), selector "Reproducir: Todo el eje / Este tramo" (segmented), "Vista completa" (solo con zoom), "Comparar" (toggle, aria-pressed)
- Con comparar activo: dos chips "A · nombre" y "B · nombre" (rol radiogroup "Punto que se mueve"). El clic en la pista mueve el punto elegido. Al activar comparar, B queda elegido.

Fila 2 (pista, `data-tw-track`, `tabIndex=0`, `role="slider"`, `aria-valuemin/max/now`, `aria-valuetext` = nombre del momento):
- Columna fija a la izquierda (18 px) con la inicial de cada capa alineada a sus filas de pips.
- Segmentos en fila con `gap: 6px`. Cada segmento, de arriba abajo:
  1. Cabecera 18 px, clicable (zoom/desacople), con borde superior 2 px del tono del segmento, marca de tipo (cuadrado lleno = compuesto, cuadrado hueco con línea = pasada), rótulo y, si entra, meta (`1 punto = 1 año · 5 puntos`).
  2. Carril de eventos 14 px: rombo 7 px `--fg2` en la posición de la fecha; rótulo 10 px mono al lado en escritorio; `title` siempre.
  3. Barra de puntos 26 px, `gap 1px`. Cada punto es un `<button tabIndex=-1>`:
     - compuesto: bloque lleno con el tono del segmento al 55%
     - pasada: fondo transparente con línea vertical de 2 px del tono
     - activo (A): fondo `--acc`; en pasada la línea pasa a `--acc-ink` 3 px
     - B: fondo `--accB`
     - hueco en la capa activa: rayado `repeating-linear-gradient(135deg, var(--hatch) 0 2px, transparent 2px 5px)`
     - `title`/`aria-label`: nombre, resolución y fuente, y `Sin imagen: Contaminación, …` si faltan capas
  4. Matriz de disponibilidad: una fila de 4 px por capa (gap 1 px) debajo de cada punto. Con imagen = swatch de la capa; hueco = vacío con `box-shadow: inset 0 0 0 1px var(--line2)`; parcial = mitad llena. Fila de la capa activa a opacidad 1, resto .6.
  - Segmento sin ninguna imagen: rótulo "Sin datos en este tramo" centrado sobre la barra rayada.

Fila 3 (escala real): franja de 6 px donde cada segmento ocupa su duración real (flex por días), mismo tono que su cabecera; marcador A (2 px `--acc`) y B (`--accB`) en la fecha real; a la izquierda "Tiempo real", extremos con el año inicial y final; debajo, en escritorio, `T.timeline.scaleNote`.

### Regla de escala
Ancho por punto, no por tiempo. Segmento: `flex: max(n,2) 1 0`, `min-width: max(n·6, 24) px` (móvil n·3). La franja de tiempo real explica la deformación sin texto largo.

Tono de segmento i de n: oscuro `oklch(L 0.05 235)` con L de .42 (más viejo) a .82 (más nuevo); claro L de .62 a .32. Más fino = más contraste: es la lectura de la retención.

### Zoom
Clic en cabecera de segmento: ese segmento toma `min-width: n·34 px` (móvil n·30) y la pista hace scroll horizontal si no entra; los demás se pliegan a 20 px (sin rótulo, `title` con el nombre, gap 0 entre puntos), así el rango completo sigue visible. Clic en un plegado lo expande. "Vista completa" vuelve. En móvil sin zoom, tocar un punto expande su segmento y selecciona el punto (los puntos miden 3 px, no son blancos táctiles). Si el momento activo sale del segmento expandido (teclado o reproducción), el zoom sigue al momento.

### Reproducción
- Ritmo por punto: año 1300 ms, trimestre 1000, mes 650, semana 600, día 500, pasada 800.
- Al cruzar de segmento: toast `Ahora: Últimos 90 días, pasada cada 12 días` por 1800 ms y pausa extra de 1100 ms.
- Alcance "Todo el eje": termina en el último punto. "Este tramo": vuelve al primero del tramo (bucle).
- Si se aprieta play en el último punto, arranca del primero.
- Cualquier interacción manual con la pista detiene la reproducción.
- Un solo punto: play deshabilitado, nota `T.timeline.singlePoint`.

### Teclado
En la pista (y global si el foco no está en un input, un botón o la cortina): ← → punto, Re Pág/Av Pág primer punto del tramo anterior/siguiente, Inicio/Fin extremos. Mueven el punto que indica el selector A/B cuando se compara. Globales: Espacio play, C comparar, O órbita, ? ayuda, Esc cierra (ayuda > tarjeta > hoja).

### Estados de la pista
- cargando: 4 bloques esqueleto con `animation: tw-pulse 1.4s` y el texto "Cargando línea de tiempo"
- segmento sin datos, un solo segmento, un solo punto, rango muy largo (1990 a 2022 anual: los puntos quedan en el mínimo de 6 px; sigue clicable; zoom recomendado)
- móvil (ver arriba)

## 5. Ficha del área (pestañas "Área" y "Lectura", role tablist)

Área:
- nombre del área, límites en mono (`F.lat`/`F.lon`)
- rótulo de capa + "Valor medio en el área"; valor en mono 20 (`F.value`), o "Sin dato"
- cambio: `T.card.delta(F.delta(dv), labelAnterior)` contra el punto anterior con dato
- serie: SVG de 268×56 sin viewBox (coordenadas en px, atributos de trazo como `style`), x por índice de punto (misma regla que la pista), separadores de segmento punteados, huecos cortan la línea, punto A `--acc`, punto B `--accB`, años extremos debajo
- imagen: tipo, resolución, fuente, cobertura, tamaño (dl en 2 columnas)

Lectura: chips por oficio (de `dataset.context`), texto del oficio elegido, etiqueta "Texto de ejemplo" si `isMock`. Vacío: `T.card.readingEmpty`.

Leyenda: nombre + unidad, barra 10 px con `linear-gradient` armado desde `ramp`, mínimo y máximo con `F.value`, nota de la capa.

## 6. Escena mock (`tw/mock-scene.js`)

DOM que crea dentro de `el`:
```
canvas globo (inset 0)
stage (inset 0, perspective 1400px, perspective-origin en el centro del área libre)
  plane (preserve-3d, transform: rotateX(tilt) rotateZ(bearing) scale translate)
    canvas mapa base (todo el plane)
    area (rectángulo de los límites, outline 1px --scene-outline)
      img ×2 (fundido entre momentos, opacity .92, 260 ms linear)
      hueco (rayado, visible si frame null)
      cmp (div con background-image del momento B, clip-path inset(0 (1-split)% 0 0): B a la izquierda)
      handle cortina (24 px de ancho, línea 2 px + perilla 16 px, role slider, tabindex 0, data-scene-handle, flechas ±.05)
      spots (botones 32×32 con cuadrado 10 px borde 2 px --scene-spot)
      probe (para project())
```
- Globo: proyección ortográfica en canvas. Tierra como grilla de puntos cada 2,5° (puntos dentro de polígonos continentales gruesos: América del Sur, del Norte, Groenlandia, África, Eurasia, Oceanía), retícula cada 30°, sombreado de limbo por `cos c`. Anillo `--acc` en el centro del área con pulso (sin pulso en movimiento reducido). Rotación 3°/s en órbita (0 en movimiento reducido). Arrastrable con puntero en órbita. `focus` en órbita rota el globo hasta ese punto y marca una cruz.
- Geometría del plane: área libre = viewport − padding; el rectángulo de datos entra al 84% respetando aspecto `(Δlon·cos lat)/Δlat`; el plane es ese rectángulo × (1 + 2·0,6) para mostrar entorno.
- Mapa base: con `basemap` y `terrain`, sombreado de relieve procedural (fbm, luz NO) entre `--scene-ground` y `--scene-ground-hi`; con `basemap` sin `terrain`, textura plana; sin `basemap` (sin conexión), color plano. Siempre grilla cada 0,05° con rótulos de coordenadas en mono 10 px `--scene-label`.
- `terrain: false` fuerza tilt 0. `northUp: false` aplica bearing −18°.
- `detail` con `focus`: scale `focus.zoom` (1,7) y traslación para centrar el punto. Transición `transform 700ms cubic-bezier(.2,.7,.2,1)`; emite `onChange` en `transitionend`.
- Clic en un spot: `onPick(id)`. Clic en el plane fuera de un spot con cámara detail: `onPick(null)`.

## 7. Movimiento

| qué | normal | reducido |
|---|---|---|
| entrar (orbit → territory) | 2200 ms: globo centra el área (0 a .6), zoom k 1→9 (.15 a .8), globo se apaga (.7 a 1), plane aparece con scale .55→1 y tilt 0→valor (.55 a 1), easing cúbico in-out | fundido de 300 ms, sin escala ni tilt animados |
| volver a órbita | 1600 ms, inverso | fundido 300 ms |
| cambio de momento | fundido de imagen 260 ms linear | corte |
| detalle | 700 ms transform | corte |
| tilt / norte | 700 ms transform | corte |
| paneles (hoja, tarjeta) | opacity/background 100 ms linear | 0 |
| rotación del globo | 3°/s | detenida |
| pulso del anillo | 2 s | estático |

Se respeta `prefers-reduced-motion` y además la prop `movimientoReducido` y `#rm=1` en la URL.

## 8. Estado y URL

Un solo objeto `SceneState` vive en la escena; la interfaz lo refleja (`onChange`) y lo escribe en el hash con `history.replaceState`:
```
#c=territory&l=suelo&t=m-2024-03&cmp=y-2022,0.50&tilt=40&n=1&pick=suelo-0
```
Parámetros de preparación (solo lectura, para el tablero): `escenario`, `tema` (`claro`|`oscuro`), `zoom` (id de segmento), `ficha=1`, `tab=lectura`, `ayuda=1`, `explorar=1`, `rm=1`. Se conservan `escenario` y `tema` al reescribir el hash.

Arranque: si el hash trae `c=territory|detail` o el escenario no es `normal`/`error-config`, la escena arranca en territorio sin vuelo. Si no, órbita. Capa por defecto: la primera. Momento por defecto: el último.

## 9. Datos mock (`tw/mock-provider.js`)

`new MockProvider({ scenario })`. `load()` tarda 700 ms (`cargando`: nunca resuelve; `error-config`: rechaza con `{code:"bounds", message}`). `series` y `hotspots` tardan 150 ms. `isMock: true`.

Área: "Santiago del Estero", límites oeste −64.35, este −64.15, sur −27.90, norte −27.70, centro (−64.25, −27.80).

Segmentos (ids estables):
```
historia      "Historia"          2018 a 2022  year     composite  y-2018..y-2022          label "2022"          res 100 m
anio          "Año reciente"      2023         quarter  composite  q-2023-1..4             label "T3 2023"       res 60 m
meses         "Últimos 24 meses"  2024 a 2025  month    composite  m-2024-01..m-2025-12    label "marzo 2024"    res 30 m
pasadas       "Últimos 90 días"   ene a mar 2026  day   acquisition a-2026-01-04 cada 12 días ×8  label "4 ene 2026"  res 10 m
```
(El handoff dice "Últimos 12 meses" con 24 puntos; se usa "Últimos 24 meses" para que el rótulo no contradiga los puntos. Anotarlo.)
Fuente: `NISAR L2 · compuesto (ejemplo)` / `NISAR L-SAR · pasada (ejemplo)`. Bytes: compuesto 380 000, pasada 2 400 000.

Huecos: contaminacion en y-2018, y-2019, q-2023-2; incendios en a-2026-02-09. Parcial: radar en a-2026-02-21 (25% derecho transparente).

Escenarios: `normal`, `cargando`, `sin-conexion` (escena online/basemap false), `sin-relieve` (terrain false), `error-config`, `un-tramo` (solo pasadas), `un-punto` (un tramo con una pasada), `rango-largo` (historia desde 1990), `tramo-vacio` (todo 2023 en null).

Series: interpolación lineal por año decimal del punto entre anclas en 2018, 2020, 2022, 2024, 2026, más ruido determinista. suelo 41, 38, 33, 36, 29 (+ estacional ±4 en meses y pasadas); incendios 6, 18, 42, 21, 55; radar −12,5, −11,8, −13,6, −10,9, −9,7; contaminacion .12, .16, .34, .22, .41. Hueco → value null.

Imágenes: canvas 72×72 por capa y punto, generado en `load()`, `toDataURL()`. Ruido de valor + fbm con hash determinista (`Math.imul`). Por capa: radar parcelas (celdas 12×14 con brillo por hash) + ruido; suelo humedad base del valor + fbm + cauce más húmedo en diagonal; contaminación pluma gaussiana en (.62,.42) que deriva con el tiempo; incendios cicatrices donde fbm supera un umbral que baja con las ha. Valor 0..1 → rampa.

Puntos de interés (ids `capa-i`, mismas posiciones en todos los momentos, fracciones del área):
```
radar: Lotes del norte (.30,.25) · Bajo anegable (.70,.60) · Monte nativo (.20,.75)
suelo: Lote de siembra (.35,.30) · Bañado (.68,.58)
contaminacion: Firma anómala A (.62,.42) · Canal de desagüe (.45,.70)
incendios: Cicatriz norte (.25,.22) · Cicatriz del monte (.55,.80) · Borde de lote (.80,.35)
```
Valor = serie del punto × (1 + desvío fijo por spot), formateado; delta contra el punto anterior. Si la capa no tiene imagen en ese punto, lista vacía.

Eventos: `Sequía prolongada` 2022-07-01 (suelo) · `Temporada de incendios` 2024-08-20 (incendios) · `Lluvias intensas` 2026-02-15.

Textos por oficio (ejemplo):
- Producción agropecuaria: "Entre 2018 y 2026 la humedad del suelo ha bajado de 41 a 29 por ciento en el área. Mirá los meses de siembra en la línea de tiempo y compará con la campaña anterior antes de decidir la fecha."
- Gestión del agua: "En las pasadas recientes la retrodispersión ha subido en los bajos del sector este, algo que suele indicar suelo saturado. Revisá esos puntos con la capa Suelo y con el evento de lluvias intensas."

`search(q)`: coordenadas `lat, lon` → `{kind:"coords"}`; texto contenido en el nombre del área (sin tildes, minúsculas) → `{kind:"area"}`; si no, `[]`.

## 10. Lógica del DC (resumen de métodos)

`boot()` crea provider y escena según escenario, monta, suscribe, aplica hash, carga dataset, series de todas las capas y hotspots. `teardown()` limpia timers, suscripciones y `scene.destroy()`. Se vuelve a llamar si cambia la prop `escenario`.
`selectTick(id, fromPlay)`, `step(±1)`, `segStep(±1)`, `setLayer(id)`, `toggleCompare()`, `setCmpTarget('A'|'B')`, `togglePlay()/advance()/stopPlay()`, `enter()` → `flyTo('territory')`, `toOrbit()` → `resetToOrbit()`, `onPick(id)`, `closePick()`, `updatePickPos()`, `onSearch()`, `measure()` (ancho, alto, tlH), `padding()`.
Cambiar capa conserva momento y cámara; cambiar momento conserva capa y cámara; ambos recargan hotspots y la tarjeta de detalle sigue abierta si el id existe.
`renderVals()` arma todo lo visible: `t` (catálogo), `lay`, listas de capas, chips de estado, `tl.segs[].ticks[].pips[]`, `tl.real`, serie, filas de imagen, oficios, tarjeta. Ningún texto literal en el template: todo sale de `t.*` o del dato.

Props del DC (Tweaks): `tema` enum `oscuro|claro`; `escenario` enum de la sección 9; `movimientoReducido` boolean.

Reglas DC a respetar: estilos en línea, `sc-for`/`sc-if` con `hint-*`, holes solo de ruta, inputs y svg con atributos simples (sin `viewBox`, trazos vía `style`), `<input>` controlado con `value` + `onChange`.

## 11. Tablero de estados (`TermalWave Estados.dc.html`)

Modo canvas (`<meta name="design_doc_mode" content="canvas">`). Por estado: iframe escritorio 1280×800 a escala .5 y móvil 390×844 a escala .5, alternando tema (escritorio oscuro, móvil claro; repetir dos estados con los temas invertidos). `loading="lazy"`. Rótulo por estado. Estados y hash:
```
Primer uso                 #c=orbit
Explorar el mundo          #c=orbit&explorar=1
Cargando                   #escenario=cargando
Territorio                 #c=territory&l=suelo
Sin conexión               #escenario=sin-conexion&l=radar
Falta imagen de una capa   #c=territory&l=contaminacion&t=q-2023-2
Error de configuración     #escenario=error-config
Relieve no disponible      #escenario=sin-relieve&tilt=0
Tarjeta de detalle         #c=territory&l=suelo&pick=suelo-0
Modo comparar              #c=territory&l=incendios&t=a-2026-03-29&cmp=y-2022,0.5
Segmento expandido         #c=territory&zoom=meses&t=m-2024-08
Tramo sin datos            #escenario=tramo-vacio&zoom=anio
Un solo tramo              #escenario=un-tramo
Un solo punto              #escenario=un-punto
Rango muy largo            #escenario=rango-largo
Ficha como hoja (móvil)    #c=territory&ficha=1&tab=lectura
Ayuda de teclado           #c=territory&ayuda=1
```
Agregar `&tema=claro` u `&tema=oscuro` según la columna.

## 12. Documento de sistema (`TermalWave Sistema.dc.html`)

Página fluida, misma estética. Secciones: tokens (muestras de color de ambos temas), tipografía, espaciado y controles, íconos, rampas por capa (leídas del MockProvider), especificación de movimiento (tabla de la sección 7), lista de componentes con estados y props (TopBar, SearchField, StatusChips, EntryCard, ErrorCard, LayerDock, CameraControls, MapLabel, CompareBanner, GapNotice, AreaCard, Sparkline, Legend, Timeline, TimelineSegment, TimelineTick, AvailabilityMatrix, RealTimeStrip, PlaybackControls, DetailCard, SegmentToast, HelpOverlay, BottomSheet), catálogo `es-AR` renderizado desde `tw/catalog.es-AR.js` (claves y valores, las funciones con un ejemplo), y notas de integración (agregados del contrato tal como figuran en `tw/contract.ts`, supuestos sobre MapLibre: `padding`, `project`, capa raster con `coordinates` desde `bounds`, `raster-fade-duration` para el fundido, cortina como dos fuentes con `clip`/dos mapas sincronizados, relieve opcional con `setTerrain(null)` y tilt 0; el rótulo "Últimos 24 meses").

## 13. Orden de trabajo para el ejecutor

1. `tw/mock-provider.js` y `tw/mock-scene.js`.
2. `TermalWave.dc.html`: helmet con tokens → contenedor raíz + mount de escena → barra superior → entrada/error → dock → cámara → rótulo → ficha + leyenda → línea de tiempo → detalle, toast, ayuda → móvil.
3. Verificar cada escenario por hash.
4. `TermalWave Estados.dc.html`.
5. `TermalWave Sistema.dc.html`.

Copy: solo desde el catálogo; voseo con imperativo ("mirá", "elegí", "volvé", "arrastrá"), pretérito perfecto compuesto, sin "tenés" ni "podés", sin guiones largos, tildes completas, sin menciones a concurso o evaluación.
