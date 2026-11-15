import type { LayerDef } from "../tw/contract";
import layersCopy from "../context/layers.json";

// Interino: unidad/rango/rampa locales; la nota de capa sale de
// web/src/context/layers.json (cricri) cuando existe.
type LayersCopy = {
  capas?: Record<string, string>;
  fuentes?: Record<string, string>;
  aviso?: string;
};

const copy = layersCopy as LayersCopy;

const DEFAULTS: Record<string, Omit<LayerDef, "id" | "label">> = {
  radar: {
    unit: "dB",
    range: [-20, -4],
    decimals: 1,
    ramp: [
      { at: 0, color: "#0c1622" },
      { at: 0.35, color: "#24476a" },
      { at: 0.7, color: "#6fa3c4" },
      { at: 1, color: "#e2f1f8" },
    ],
    note: "Retrodispersión de banda L. Los valores altos indican superficies rugosas o con más humedad.",
  },
  suelo: {
    unit: "%",
    range: [20, 50],
    decimals: 0,
    ramp: [
      { at: 0, color: "#6b4423" },
      { at: 0.3, color: "#b0823f" },
      { at: 0.55, color: "#d8c98a" },
      { at: 0.78, color: "#6fae86" },
      { at: 1, color: "#2a6f78" },
    ],
    note: "Estado del suelo estimado a partir del radar. Los verdes y azules indican más humedad.",
  },
  contaminacion: {
    unit: "índice",
    range: [0, 1],
    decimals: 2,
    ramp: [
      { at: 0, color: "#140f24" },
      { at: 0.35, color: "#4b2a7a" },
      { at: 0.65, color: "#b0428a" },
      { at: 1, color: "#ffb26b" },
    ],
    note: "Firma anómala respecto de la señal habitual del área. Un índice alto pide revisión en el terreno.",
  },
  incendios: {
    unit: "ha",
    range: [0, 60],
    decimals: 0,
    ramp: [
      { at: 0, color: "#24211f" },
      { at: 0.35, color: "#5e2617" },
      { at: 0.7, color: "#d0521f" },
      { at: 1, color: "#ffd36b" },
    ],
    note: "Cicatrices de fuego detectadas por cambio de señal. Se mide en hectáreas quemadas.",
  },
};

const GENERIC: Omit<LayerDef, "id" | "label"> = {
  unit: "",
  range: [0, 1],
  decimals: 2,
  ramp: [
    { at: 0, color: "#1a1d22" },
    { at: 1, color: "#e6e9ec" },
  ],
  note: "",
};

// Labels con tilde: el config actual las trae sin tilde ("Contaminacion").
const LABELS: Record<string, string> = {
  contaminacion: "Contaminación",
  suelo: "Suelo",
};

// Espejo de config/layers.toml (el backend es la fuente; esto cubre configs viejos).
const TAXONOMY: Record<string, Pick<LayerDef, "category" | "core">> = {
  radar: { category: "data", core: true },
  incendios: { category: "data" },
  suelo: { category: "inference" },
  contaminacion: { category: "inference" },
};

// Espejo de los presets de config/layers.toml, por nombre de rubro. El radar (core) no se lista: siempre esta.
export const PRESETS: Record<string, string[]> = {
  "GestiÃ³n de emergencias": ["incendios"],
  Agricultura: ["suelo"],
  "Ambiente y conservaciÃ³n": ["suelo", "incendios"],
};

export function layerDef(id: string, label: string): LayerDef {
  const tax = TAXONOMY[id] ?? { category: "data" as const };
  const base: LayerDef = { id, label: LABELS[id] ?? label, ...(DEFAULTS[id] ?? GENERIC), ...tax };
  const fromContext = copy.capas?.[id];
  return fromContext ? { ...base, note: fromContext } : base;
}

export function sourceNote(provider: string): string | undefined {
  return copy.fuentes?.[provider];
}

export function layersAviso(): string | undefined {
  return copy.aviso;
}
