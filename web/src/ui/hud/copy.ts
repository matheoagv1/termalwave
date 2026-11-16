// Copy for the top bar, the status strip and the About dialog. It lives here
// so the shared locale catalogs are not edited by several hands at once.
type Lang = "en" | "es";

const en = {
  tagline: "NISAR radar: see how the ground changes",
  about: "About",
  aboutTitle: "About Termal Wave",
  what: "Termal Wave shows how the land surface changes, as seen by the NISAR L-band radar. Radar sees through cloud and smoke, by day and by night. Fires, clouds, wind and satellite orbits are drawn on the same globe for context.",
  why: "Use it to find where the ground changed between two dates, and to check what else was happening there: fire, weather, a satellite pass.",
  entry: "Entry for the NASA Space Apps Challenge 2026.",
  honestyTitle: "How to read the labels",
  honesty: [
    ["measured", "Measured", "A sensor recorded it. Shown as received."],
    ["derived", "Derived", "Computed from measured data with a stated formula."],
    ["example", "Example", "Sample values that show how a layer will look. Not a measurement."],
  ],
  sourcesTitle: "Data sources",
  sources: [
    ["Radar", "NASA NISAR L2 GCOV, found through NASA Earthdata CMR and distributed by ASF DAAC"],
    ["Fires", "NASA FIRMS (VIIRS S-NPP and MODIS active fire detections)"],
    ["Clouds", "NOAA nowCOAST, NESDIS global infrared mosaic"],
    ["Wind and weather", "Open-Meteo (CC BY 4.0)"],
    ["Optical", "Sentinel-2 through Microsoft Planetary Computer"],
    ["Orbits and sky", "CelesTrak orbital elements, NASA JPL Horizons"],
    ["Basemaps", "NASA GIBS, CARTO, OpenFreeMap, EOX Sentinel-2 cloudless"],
    ["Place search", "Photon, Nominatim and Open-Meteo geocoding (OpenStreetMap data)"],
  ],
  sourcesNote: "The Sources panel lists which of these answered for the area on screen.",
  keysTitle: "Keyboard",
  view: "View",
  date: "Date",
  data: "Data",
  sourcesShort: "Sources",
  sourcesOk: (ok: number, n: number): string => `${ok} of ${n} available`,
  openSources: "Open the sources panel",
  facts: { what: "Layer", where: "Place", when: "Date", honesty: "Data type" },
};

const es: typeof en = {
  tagline: "Radar NISAR: vea cómo cambia el suelo",
  about: "Acerca de",
  aboutTitle: "Acerca de Termal Wave",
  what: "Termal Wave muestra cómo cambia la superficie terrestre según el radar de banda L de NISAR. El radar ve a través de nubes y humo, de día y de noche. Los incendios, las nubes, el viento y las órbitas de satélites se dibujan en el mismo globo como contexto.",
  why: "Sirve para encontrar dónde cambió el suelo entre dos fechas y para revisar qué más pasaba ahí: fuego, clima, el paso de un satélite.",
  entry: "Proyecto presentado al NASA Space Apps Challenge 2026.",
  honestyTitle: "Cómo leer las etiquetas",
  honesty: [
    ["measured", "Medido", "Lo registró un sensor. Se muestra como llegó."],
    ["derived", "Derivado", "Calculado a partir de datos medidos con una fórmula declarada."],
    ["example", "Ejemplo", "Valores de muestra que enseñan cómo se verá una capa. No es una medición."],
  ],
  sourcesTitle: "Fuentes de datos",
  sources: [
    ["Radar", "NASA NISAR L2 GCOV, localizado con NASA Earthdata CMR y distribuido por ASF DAAC"],
    ["Incendios", "NASA FIRMS (detecciones de fuego activo de VIIRS S-NPP y MODIS)"],
    ["Nubes", "NOAA nowCOAST, mosaico infrarrojo global de NESDIS"],
    ["Viento y clima", "Open-Meteo (CC BY 4.0)"],
    ["Óptico", "Sentinel-2 mediante Microsoft Planetary Computer"],
    ["Órbitas y cielo", "Elementos orbitales de CelesTrak, NASA JPL Horizons"],
    ["Mapas base", "NASA GIBS, CARTO, OpenFreeMap, EOX Sentinel-2 sin nubes"],
    ["Búsqueda de lugares", "Geocodificación de Photon, Nominatim y Open-Meteo (datos de OpenStreetMap)"],
  ],
  sourcesNote: "El panel Fuentes indica cuáles respondieron para el área en pantalla.",
  keysTitle: "Teclado",
  view: "Vista",
  date: "Fecha",
  data: "Datos",
  sourcesShort: "Fuentes",
  sourcesOk: (ok: number, n: number): string => `${ok} de ${n} disponibles`,
  openSources: "Abrir el panel de fuentes",
  facts: { what: "Capa", where: "Lugar", when: "Fecha", honesty: "Tipo de dato" },
};

export type HudCopy = typeof en;

export function hudCopy(lang: Lang): HudCopy {
  return lang === "es" ? es : en;
}
