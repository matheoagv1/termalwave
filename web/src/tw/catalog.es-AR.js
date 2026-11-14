// catalogo de textos es-AR (registro SGO)
// voseo con imperativo de tuteo, preterito perfecto compuesto, sin guiones largos

const NUM = (n, d = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const F = {
  num: NUM,
  value: (v, unit, d = 0) => (v == null ? null : unit === "índice" ? NUM(v, d) : `${NUM(v, d)} ${unit}`),
  delta: (dv, unit, d = 0) => {
    const s = dv > 0 ? "+" : "\u2212";
    const a = NUM(Math.abs(dv), d);
    return unit === "índice" ? `${s}${a}` : `${s}${a} ${unit}`;
  },
  bytes: (b) => (b >= 1e6 ? `${NUM(b / 1e6, 1)} MB` : `${NUM(Math.round(b / 1e3))} KB`),
  lat: (v) => `${NUM(Math.abs(v), 2)}° ${v < 0 ? "S" : "N"}`,
  lon: (v) => `${NUM(Math.abs(v), 2)}° ${v < 0 ? "O" : "E"}`,
  year: (iso) => iso.slice(0, 4),
};

export const T = {
  locale: "es-AR",
  brand: "TermalWave",
  mock: { tag: "Datos de ejemplo", detail: "Valores inventados. No son mediciones." },

  top: { search: "Buscar lugar o coordenadas", searchOpen: "Abrir búsqueda", searchClose: "Cerrar búsqueda", help: "Ayuda" },
  search: {
    none: (q) => `Sin resultados para "${q}". Probá con el nombre del área o con latitud y longitud.`,
    going: (label) => `Yendo a ${label}`,
  },

  status: {
    online: "En línea",
    offline: "Sin conexión",
    offlineDetail: "Mapa base apagado. Se muestran las imágenes guardadas en este equipo.",
    terrainOff: "Relieve no disponible",
    terrainOffDetail: "El territorio se muestra plano y la inclinación queda en 0°.",
    loading: "Cargando datos del área",
  },

  entry: {
    kicker: "Área de estudio",
    lead: "Mirá cómo ha cambiado la superficie de este territorio a lo largo del tiempo, con radar satelital NISAR (NASA e ISRO).",
    enter: "Entrar al área",
    explore: "Explorar el mundo",
    backToArea: "Ir al área de estudio",
    dragHint: "Arrastrá para girar la Tierra.",
    coords: (lat, lon) => `${lat} · ${lon}`,
    range: (a, b) => `${a} a ${b}`,
    layers: (n) => (n === 1 ? "1 capa" : `${n} capas`),
    points: (n) => (n === 1 ? "1 punto en el tiempo" : `${n} puntos en el tiempo`),
  },

  error: {
    title: "No se ha podido leer la configuración del área",
    detail: "Revisá los límites, la lista de capas y los tramos de tiempo del archivo de configuración.",
    code: "Código",
    retry: "Volver a intentar",
    explore: "Explorar el mundo",
  },

  camera: {
    group: "Cámara",
    orbit: "Tierra completa",
    approach: "Aproximación",
    territory: "Territorio",
    detail: "Detalle",
    reset: "Volver a la Tierra completa",
    northUp: "Norte arriba",
    northFree: "Norte libre",
    tilt: "Inclinación",
    tiltUp: "Más inclinación",
    tiltDown: "Menos inclinación",
    tiltOff: "Sin relieve, vista plana",
    deg: (n) => `${n}°`,
  },

  layers: { title: "Capas", gapHere: "Sin imagen en este punto", partial: "Imagen parcial" },
  legend: { title: "Leyenda" },

  // agregado: la interfaz es opcional frente al globo
  hud: {
    hide: "Ocultar interfaz",
    show: "Mostrar interfaz",
    dockClose: "Plegar capas",
    dockOpen: "Desplegar capas",
    tlClose: "Plegar línea de tiempo",
    tlOpen: "Desplegar línea de tiempo",
  },

  // agregado: pestana Fuentes de la ficha
  sources: {
    lead: "De dónde salen los datos de esta área y cuáles se usaron.",
    updated: (d) => `Actualizado el ${d}`,
    empty: "Este conjunto de datos no trae información de fuentes.",
    selected: "Fuentes usadas",
    tried: "Consultadas",
    none: "ninguna cumplió el criterio de selección",
    records: (n) => (n === 1 ? "1 registro" : `${n} registros`),
    fromCache: "Desde copia guardada",
    failed: "Sin respuesta",
    kind: { fires: "Focos de calor", weather: "Clima", optical: "Imagen óptica", radar: "Radar" },
    status: { ok: "Disponible", cache: "Copia guardada", unavailable: "No disponible" },
    strategy: {
      union_dedupe: "Se juntan todas las fuentes y se quitan los repetidos",
      first_available: "Se usa la primera fuente que responde",
      least_cloudy_near_nisar: "Se elige la imagen con menos nubes cerca de la pasada de NISAR",
      prefer_validated: "Se prefieren los datos ya validados",
    },
    provider: {
      firms_viirs_sp: "FIRMS VIIRS (procesado)",
      firms_viirs_nrt: "FIRMS VIIRS (casi en tiempo real)",
      firms_modis: "FIRMS MODIS",
      open_meteo_archive: "Open-Meteo (archivo)",
      meteomatics: "Meteomatics",
      planetary_computer_s2: "Sentinel-2 (Planetary Computer)",
      earthdata_nisar_gcov: "NISAR GCOV (Earthdata)",
    },
  },

  card: {
    tabArea: "Área",
    tabReading: "Lectura",
    tabSources: "Fuentes",
    sheet: "Ficha del área",
    open: "Abrir ficha",
    close: "Plegar ficha",
    value: "Valor medio en el área",
    noValue: "Sin dato",
    delta: (d, label) => `${d} respecto de ${label}`,
    noChange: (label) => `Sin cambio respecto de ${label}`,
    deltaNone: "Sin punto anterior para comparar",
    series: "Serie",
    image: "Imagen",
    kind: "Tipo",
    resolution: "Resolución",
    source: "Fuente",
    quality: "Cobertura",
    size: "Tamaño",
    qualityOk: "Completa",
    qualityPartial: "Parcial",
    meters: (n) => `${n} m`,
    bounds: "Límites",
    readingLead: "Elegí un oficio para leer qué mirar en esta área.",
    readingSample: "Texto de ejemplo",
    readingEmpty: "Todavía no se han cargado textos para esta área.",
  },

  kind: { composite: "Compuesto", acquisition: "Pasada" },
  tickName: (kind, label) => (kind === "composite" ? `Compuesto ${label}` : `Pasada del ${label}`),
  gran: {
    year: "1 punto = 1 año",
    quarter: "1 punto = 1 trimestre",
    month: "1 punto = 1 mes",
    week: "1 punto = 1 semana",
    day: "1 punto = 1 día",
  },
  granEvery: { year: "cada año", quarter: "cada trimestre", month: "cada mes", week: "cada semana", day: "cada día" },
  acqEvery: (d) => `pasada cada ${d} días`,

  map: {
    label: (layer, tick) => `${layer} · ${tick}`,
    gap: (layer) => `Sin imagen de ${layer} en este punto`,
    gapHint: "Elegí otro punto o mirá otra capa.",
    approach: "Aproximación al área",
    orbit: "Tierra completa",
    loading: "Cargando imágenes del área",
  },

  detail: { close: "Cerrar tarjeta", layer: "Capa", at: "Momento", delta: "Cambio" },

  timeline: {
    region: "Línea de tiempo",
    play: "Reproducir",
    pause: "Pausar",
    prev: "Punto anterior",
    next: "Punto siguiente",
    full: "Vista completa",
    zoom: (seg) => `Ver los puntos de ${seg}`,
    scopeAll: "Todo el eje",
    scopeSeg: "Este tramo",
    compare: "Comparar",
    compareOff: "Dejar de comparar",
    target: "Punto que se mueve",
    a: "A",
    b: "B",
    points: (n) => (n === 1 ? "1 punto" : `${n} puntos`),
    crossing: (seg, gran) => `Ahora: ${seg}, ${gran}`,
    scaleNote: "Cada punto ocupa el mismo ancho. La franja de abajo muestra el tiempo real.",
    realTime: "Tiempo real",
    kindComposite: "Compuesto",
    kindAcquisition: "Pasada",
    gapLegend: "Sin imagen",
    event: (label) => `Evento: ${label}`,
    emptySeg: "Sin datos en este tramo",
    singlePoint: "Hay un solo punto disponible.",
    loading: "Cargando línea de tiempo",
    missing: (list) => `Sin imagen: ${list}`,
    keysHint: "Flechas: punto a punto. Re Pág y Av Pág: tramo. Inicio y Fin: extremos.",
  },

  compare: {
    banner: (b, a) => `Izquierda B: ${b} · Derecha A: ${a}`,
    mixed: "Estás comparando un compuesto con una pasada. El compuesto promedia varias pasadas y la pasada es una sola adquisición, así que los valores no son equivalentes.",
    curtain: "Cortina de comparación. Usá las flechas para moverla.",
  },

  help: {
    title: "Teclado",
    close: "Cerrar",
    keys: [
      ["← →", "Punto anterior o siguiente"],
      ["Re Pág · Av Pág", "Tramo anterior o siguiente"],
      ["Inicio · Fin", "Primer o último punto"],
      ["Espacio", "Reproducir o pausar"],
      ["C", "Comparar"],
      ["O", "Volver a la Tierra completa"],
      ["H", "Ocultar o mostrar la interfaz"],
      ["Esc", "Cerrar tarjeta, ficha o ayuda"],
      ["?", "Mostrar u ocultar esta ayuda"],
    ],
  },
};
