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
      sub: "Compare two radar dates to see where the ground changed.",
      on: "Ground change radar",
    },
    fuego: {
      title: "FIRES",
      sub: "Hot spots seen by satellite and the wind that carries the smoke.",
      on: "Active fires, Wind, Smoke and haze, Fire weather",
    },
    clima: {
      title: "WEATHER",
      sub: "Clouds, wind and rain around a radar pass. Context, not a forecast.",
      on: "Clouds, Wind, Rain",
    },
    vegetacion: {
      title: "VEGETATION",
      sub: "How green and dense the plant cover is, and where it changed.",
      on: "Green vegetation, Greenness vs normal, Vegetation loss alerts",
    },
    agua: {
      title: "WATER",
      sub: "Wet soil, surface water and rain.",
      on: "Soil moisture, Flood water, Flood risk",
    },
    movimiento: {
      title: "GROUND MOTION",
      sub: "Where the ground rose, sank or slid between two radar passes.",
      on: "Earthquakes, Landslide risk",
    },
    todo: {
      title: "EVERYTHING",
      sub: "Every layer of this build at once. Turn off what you do not need.",
      on: "All layers",
    },
    explore: {
      title: "EXPLORE MANUALLY",
      sub: "Start with radar only and turn layers on yourself.",
      on: "",
    },
  },
  tags: { measured: "MEASURED", derived: "DERIVED", model: "MODEL", example: "EXAMPLE" },
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
    reykjanes: { label: "Reykjanes, Iceland", sub: "Ground that rises and cracks before eruptions." },
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
      sub: "Compará dos fechas del radar para ver dónde cambió el suelo.",
      on: "Radar de cambio del suelo",
    },
    fuego: {
      title: "INCENDIOS",
      sub: "Focos de calor vistos por satélite y el viento que lleva el humo.",
      on: "Incendios activos, Viento, Humo y bruma, Clima de fuego",
    },
    clima: {
      title: "TIEMPO",
      sub: "Nubes, viento y lluvia cerca de una pasada del radar. Es contexto, no un pronóstico.",
      on: "Nubes, Viento, Lluvia",
    },
    vegetacion: {
      title: "VEGETACIÓN",
      sub: "Qué tan verde y densa está la cobertura vegetal, y dónde cambió.",
      on: "Vegetación verde, Verdor vs normal, Alertas de pérdida de vegetación",
    },
    agua: {
      title: "AGUA",
      sub: "Suelo húmedo, agua en superficie y lluvia.",
      on: "Humedad del suelo, Agua de inundación, Riesgo de inundación",
    },
    movimiento: {
      title: "MOVIMIENTO DEL SUELO",
      sub: "Dónde el suelo subió, bajó o se deslizó entre dos pasadas del radar.",
      on: "Sismos, Riesgo de deslizamiento",
    },
    todo: {
      title: "TODO",
      sub: "Todas las capas de esta versión a la vez. Apagá lo que no uses.",
      on: "Todas las capas",
    },
    explore: {
      title: "EXPLORAR A MANO",
      sub: "Empezá solo con el radar y activá las capas vos.",
      on: "",
    },
  },
  tags: { measured: "MEDIDO", derived: "DERIVADO", model: "MODELO", example: "EJEMPLO" },
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
