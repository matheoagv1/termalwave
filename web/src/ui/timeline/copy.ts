// Copy for the timeline bar. It lives here so the shared locale catalogs are
// not edited by several hands at once.
type Lang = "en" | "es";

const en = {
  latest: "Latest",
  latestTitle: "Go to the latest date",
  atLatest: "Showing the latest date",
  measured: "Measured",
  derived: "Derived",
  model: "Model",
  inferred: "Inferred",
  example: "Example, not a measurement",
  noData: (layer: string): string => (layer ? `No data for ${layer}` : "No data for this layer"),
  beforeNisar: "Before NISAR",
  legendExample: "Example",
  legendBefore: "Before NISAR (to Jul 2025)",
  trackHint: "Drag or click to pick a date. Arrows step, Home and End jump, Space plays.",
};

const es: typeof en = {
  latest: "Última",
  latestTitle: "Ir a la fecha más reciente",
  atLatest: "Se muestra la fecha más reciente",
  measured: "Medido",
  derived: "Derivado",
  model: "Modelo",
  inferred: "Inferido",
  example: "Ejemplo, no es una medición",
  noData: (layer: string): string => (layer ? `Sin dato para ${layer}` : "Sin dato para esta capa"),
  beforeNisar: "Antes de NISAR",
  legendExample: "Ejemplo",
  legendBefore: "Antes de NISAR (hasta jul. 2025)",
  trackHint: "Arrastrá o hacé clic para elegir una fecha. Flechas: un paso. Inicio y Fin: extremos. Espacio: reproducir.",
};

export type TimelineCopy = typeof en;

export function timelineCopy(lang: Lang | string): TimelineCopy {
  return lang === "es" ? es : en;
}
