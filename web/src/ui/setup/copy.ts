import type { Lang } from "../../app/i18n";

// Setup copy lives here, not in the shared catalogs, so the first run can
// change without touching files other people edit.
const en = {
  title: "TermalWave setup",
  kicker: "TERMALWAVE · FIRST LOOK",
  step: (n: number, of: number): string => `${n} / ${of}`,
  h1: "See where the ground changed",
  lead:
    "A 3D globe that puts NASA's NISAR radar next to fires, clouds and wind. It answers one question: where did the surface change, and what was happening around it?",
  pickTopic: "Choose your first view",
  turnsOn: "Turns on",
  missions: {
    cambio: {
      title: "SURFACE CHANGE",
      sub: "NISAR L-band radar on the timeline. Compare two dates to see where the ground changed.",
      on: "NISAR radar",
    },
    fuego: {
      title: "FIRES",
      sub: "NASA FIRMS fire detections on the whole globe. The demo area also has a fire layer.",
      on: "FIRMS hotspots, Fires",
    },
    clima: {
      title: "CLOUDS AND WIND",
      sub: "Cloud cover and wind over the globe, to read the sky around a radar pass. Not a forecast.",
      on: "Clouds, Wind",
    },
    ambiente: {
      title: "SOIL AND ENVIRONMENT",
      sub: "Soil condition and pollution layers. They are examples derived from radar, not measurements.",
      on: "Soil condition, Pollution",
    },
    explore: {
      title: "EXPLORE MANUALLY",
      sub: "Start with radar only and turn layers on yourself.",
      on: "",
    },
  },
  tags: { measured: "MEASURED", model: "MODEL", example: "EXAMPLE" },
  radarAlways: "NISAR radar stays on in every view.",
  h2: "Pick a place",
  lead2: (view: string): string => `First view: ${view}. Now choose where the camera goes.`,
  demoArea: "Demo area",
  demoSub: "The radar images of this build are here.",
  demoSubMock: "The radar images of this build are here. They are example data.",
  radarTag: "RADAR",
  examples: "Other places",
  examplesNote:
    "Outside the demo area you get fires, clouds, wind and the list of NISAR passes. There is no radar image there yet.",
  places: {
    ibera: { label: "Iberá wetlands, Argentina", sub: "Wetland where large fires burned in 2022." },
    rondonia: { label: "Rondônia, Brazil", sub: "Amazon forest edge with heavy clearing." },
    reykjanes: { label: "Reykjanes, Iceland", sub: "Ground that lifts and cracks before eruptions." },
  },
  search: "Search any place",
  searchPh: "City, region or lat, lon",
  searchNone: "No places found.",
  searchWait: "Search works once the area data has loaded.",
  next: "What to do next",
  nextTimeline: "Timeline, at the bottom: move between dates and compare two of them.",
  nextLayers: "Layers panel: turn layers on and off and read what each one means.",
  nisar2025: "NISAR data starts in 2025. Earlier dates on the timeline are marked.",
  back: "Back",
  skip: "Skip setup",
  skipKey: "Esc",
  reopen: "Setup",
  tip: "You can open this setup again from the guide in the corner.",
};

const es: typeof en = {
  title: "Configuración de TermalWave",
  kicker: "TERMALWAVE · PRIMERA MIRADA",
  step: (n: number, of: number): string => `${n} / ${of}`,
  h1: "Mirá dónde cambió el suelo",
  lead:
    "Un globo 3D que pone el radar NISAR de la NASA junto a incendios, nubes y viento. Responde una pregunta: ¿dónde cambió la superficie y qué pasaba alrededor?",
  pickTopic: "Elegí tu primera vista",
  turnsOn: "Activa",
  missions: {
    cambio: {
      title: "CAMBIO DE SUPERFICIE",
      sub: "Radar NISAR de banda L en la línea de tiempo. Compará dos fechas para ver dónde cambió el suelo.",
      on: "Radar NISAR",
    },
    fuego: {
      title: "FUEGO",
      sub: "Detecciones de fuego de NASA FIRMS en todo el globo. El área de demostración suma una capa de incendios.",
      on: "Focos FIRMS, Incendios",
    },
    clima: {
      title: "NUBES Y VIENTO",
      sub: "Nubosidad y viento sobre el globo, para leer el cielo cerca de una pasada de radar. No es un pronóstico.",
      on: "Nubes, Viento",
    },
    ambiente: {
      title: "SUELO Y AMBIENTE",
      sub: "Capas de estado del suelo y contaminación. Son ejemplos derivados del radar, no mediciones.",
      on: "Estado del suelo, Contaminación",
    },
    explore: {
      title: "EXPLORAR A MANO",
      sub: "Empezá solo con el radar y activá las capas vos.",
      on: "",
    },
  },
  tags: { measured: "MEDIDO", model: "MODELO", example: "EJEMPLO" },
  radarAlways: "El radar NISAR queda activo en todas las vistas.",
  h2: "Elegí un lugar",
  lead2: (view: string): string => `Primera vista: ${view}. Ahora elegí adónde va la cámara.`,
  demoArea: "Área de demostración",
  demoSub: "Las imágenes de radar de esta versión están acá.",
  demoSubMock: "Las imágenes de radar de esta versión están acá. Son datos de ejemplo.",
  radarTag: "RADAR",
  examples: "Otros lugares",
  examplesNote:
    "Fuera del área de demostración ves incendios, nubes, viento y la lista de pasadas de NISAR. Ahí todavía no hay imagen de radar.",
  places: {
    ibera: { label: "Esteros del Iberá, Argentina", sub: "Humedal donde hubo grandes incendios en 2022." },
    rondonia: { label: "Rondônia, Brasil", sub: "Borde de la selva amazónica con mucho desmonte." },
    reykjanes: { label: "Reykjanes, Islandia", sub: "Suelo que se levanta y se agrieta antes de las erupciones." },
  },
  search: "Buscá cualquier lugar",
  searchPh: "Ciudad, región o lat, lon",
  searchNone: "No encontramos lugares.",
  searchWait: "La búsqueda funciona cuando terminan de cargar los datos del área.",
  next: "Qué hacer después",
  nextTimeline: "Línea de tiempo, abajo: movete entre fechas y compará dos.",
  nextLayers: "Panel de capas: activá y apagá capas y leé qué significa cada una.",
  nisar2025: "Los datos de NISAR empiezan en 2025. Las fechas anteriores están marcadas en la línea de tiempo.",
  back: "Volver",
  skip: "Saltar configuración",
  skipKey: "Esc",
  reopen: "Configuración",
  tip: "Podés volver a abrir esta configuración desde la guía de la esquina.",
};

export type SetupCopy = typeof en;

export function setupCopy(lang: Lang): SetupCopy {
  return lang === "es" ? es : en;
}
