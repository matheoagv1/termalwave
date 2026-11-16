// Copy for the About sections that answer the challenge and the hackathon
// rules: how NISAR is used, references, AI use, credits. Kept apart from the
// shared locale catalogs so other agents do not collide on them.
type Lang = "en" | "es";

export type AboutLink = { label: string; href: string; note: string };

const en = {
  nisarTitle: "How NISAR is used",
  nisar: [
    ["Radar layer", "NISAR L-band backscatter from the L2 GCOV product, in decibels. HH and HV polarizations use fixed scales so dates can be compared."],
    ["Change", "Later date minus earlier date, in dB, on the same grid. A derived value: the formula is shown in the layer detail."],
    ["Coverage", "The NISAR passes row asks NASA CMR which GCOV granules cover the area. Each pass shows date, track, frame, direction and polarization."],
    ["Other layers", "Fires, clouds, wind, optical and orbits are context. They never replace the radar layer, which stays on."],
  ],
  nisarNote: "Each layer and each date carries its own label: measured, derived or example. Read the label before you read a value.",
  refsTitle: "References",
  refs: [
    { label: "NASA Earthdata Search", href: "https://search.earthdata.nasa.gov/search", note: "NISAR data discovery" },
    { label: "NASA CMR", href: "https://cmr.earthdata.nasa.gov/search/", note: "Granule search used by the app" },
    { label: "ASF Data Search Vertex", href: "https://search.asf.alaska.edu/", note: "NASA SAR archive" },
    { label: "NISAR Data User Guide", href: "https://nisar-docs.asf.alaska.edu/", note: "GCOV product format" },
    { label: "Intro to SAR", href: "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar", note: "Polarization and scattering" },
    { label: "NASA FIRMS", href: "https://firms.modaps.eosdis.nasa.gov/", note: "Active fire detections" },
    { label: "NASA GIBS", href: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api", note: "Daily imagery basemaps" },
    { label: "MapLibre GL JS", href: "https://maplibre.org/", note: "Globe rendering, BSD-3-Clause" },
  ] as AboutLink[],
  aiTitle: "Use of AI tools",
  ai: "AI coding assistants (Claude Code, Cursor agents, Grok) helped write code, tests and documentation. People chose the data, the study area and the design, and reviewed the copy. The wizard picture is AI-generated and carries a small \"AI\" mark. No data value in the app was produced by an AI tool.",
  creditsTitle: "Credits",
  credits: "Fonts: Press Start 2P and IBM Plex (SIL Open Font License 1.1). Country shapes: Natural Earth (public domain). Map data: OpenStreetMap contributors (ODbL).",
  codeTitle: "Code",
  code: { label: "github.com/matheoagv1/termalwave", href: "https://github.com/matheoagv1/termalwave" },
};

const es: typeof en = {
  nisarTitle: "Cómo se usa NISAR",
  nisar: [
    ["Capa de radar", "Retrodispersión en banda L de NISAR, del producto L2 GCOV, en decibeles. Las polarizaciones HH y HV usan escalas fijas para poder comparar fechas."],
    ["Cambio", "Fecha posterior menos fecha anterior, en dB, sobre la misma grilla. Es un valor derivado: la fórmula figura en el detalle de la capa."],
    ["Cobertura", "La fila de pasadas de NISAR consulta a NASA CMR qué gránulos GCOV cubren el área. Cada pasada indica fecha, órbita, cuadro, dirección y polarización."],
    ["Otras capas", "Incendios, nubes, viento, óptico y órbitas son contexto. Nunca reemplazan a la capa de radar, que queda encendida."],
  ],
  nisarNote: "Cada capa y cada fecha lleva su etiqueta: medido, derivado o ejemplo. Conviene leer la etiqueta antes que el valor.",
  refsTitle: "Referencias",
  refs: [
    { label: "NASA Earthdata Search", href: "https://search.earthdata.nasa.gov/search", note: "Búsqueda de datos NISAR" },
    { label: "NASA CMR", href: "https://cmr.earthdata.nasa.gov/search/", note: "Búsqueda de gránulos que usa la app" },
    { label: "ASF Data Search Vertex", href: "https://search.asf.alaska.edu/", note: "Archivo SAR de la NASA" },
    { label: "NISAR Data User Guide", href: "https://nisar-docs.asf.alaska.edu/", note: "Formato del producto GCOV" },
    { label: "Intro to SAR", href: "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar", note: "Polarización y dispersión" },
    { label: "NASA FIRMS", href: "https://firms.modaps.eosdis.nasa.gov/", note: "Detecciones de fuego activo" },
    { label: "NASA GIBS", href: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api", note: "Mapas base de imágenes diarias" },
    { label: "MapLibre GL JS", href: "https://maplibre.org/", note: "Dibujo del globo, BSD-3-Clause" },
  ],
  aiTitle: "Uso de herramientas de IA",
  ai: "Asistentes de programación con IA (Claude Code, agentes de Cursor, Grok) ayudaron a escribir código, pruebas y documentación. Las personas del equipo eligieron los datos, el área de estudio y el diseño, y revisaron los textos. La imagen del mago fue generada con IA y lleva una pequeña marca \"AI\". Ningún valor de datos de la app salió de una herramienta de IA.",
  creditsTitle: "Créditos",
  credits: "Tipografías: Press Start 2P e IBM Plex (SIL Open Font License 1.1). Contornos de países: Natural Earth (dominio público). Datos de mapa: colaboradores de OpenStreetMap (ODbL).",
  codeTitle: "Código",
  code: en.code,
};

export type AboutCopy = typeof en;

export function aboutCopy(lang: Lang): AboutCopy {
  return lang === "es" ? es : en;
}
