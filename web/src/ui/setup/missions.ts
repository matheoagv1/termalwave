import type { SearchResult } from "../../tw/contract";
import topics from "../../context/topics.json";
import { catalog } from "../../scene/catalog";

// Presets are themes of the world, picked in one tap, never professions.
export type MissionId = "cambio" | "fuego" | "clima" | "vegetacion" | "agua" | "movimiento" | "todo" | "explore";
export type Honesty = "measured" | "derived" | "model" | "example";
export type PlaceId = "ibera" | "rondonia" | "reykjanes";

// "area" means the dataset's own area of interest, resolved when it has loaded.
export type SetupPlace = SearchResult | "area";
export type SetupResult = { extras?: string[]; place?: SetupPlace };

export type Mission = {
  id: MissionId;
  // topic id in context/topics.json; empty keeps the current reading
  topic: string;
  extras: string[];
  honesty: Honesty | null;
  glyph: string;
};

// Layer ids per theme. Radar is the core and always on, so it is never listed.
// Catalog layers are named by id; ids that do not exist in this build are skipped.
export const THEME_LAYERS: Record<string, string[]> = {
  cambio: ["radar_sentinel1", "true_color_day", "natural_events", "ground_motion"],
  fuego: ["incendios", "firms", "wind", "haze_smoke", "fire_danger", "fire_danger_3d"],
  clima: ["clouds", "wind", "rain_now", "ground_heat_day"],
  vegetacion: ["green_vegetation", "veg_ndvi_now", "veg_ndvi_anomaly", "vegetation_loss", "biomass", "veg_greenup_next"],
  agua: ["suelo", "soil_moisture", "flood_water", "surface_water_radar", "rain_now", "flood_risk", "veg_water_outlook"],
  movimiento: ["ground_motion", "earthquakes", "landslide_risk", "landslide_3d"],
  ambiente: ["suelo", "contaminacion"],
};

const EVERYTHING = Array.from(new Set(Object.values(THEME_LAYERS).flat()));
THEME_LAYERS.todo = EVERYTHING;

export const MISSIONS: Mission[] = [
  { id: "cambio", topic: "cambio", extras: THEME_LAYERS.cambio, honesty: "measured", glyph: "◐" },
  { id: "fuego", topic: "fuego", extras: THEME_LAYERS.fuego, honesty: "measured", glyph: "▲" },
  { id: "clima", topic: "clima", extras: THEME_LAYERS.clima, honesty: "model", glyph: "≈" },
  { id: "vegetacion", topic: "vegetacion", extras: THEME_LAYERS.vegetacion, honesty: "derived", glyph: "♣" },
  { id: "agua", topic: "agua", extras: THEME_LAYERS.agua, honesty: "derived", glyph: "~" },
  { id: "movimiento", topic: "movimiento", extras: THEME_LAYERS.movimiento, honesty: "derived", glyph: "↕" },
  { id: "todo", topic: "todo", extras: EVERYTHING, honesty: null, glyph: "▦" },
  { id: "explore", topic: "", extras: [], honesty: null, glyph: "○" },
];

// Real places with a reason to look; the theme is what the place is known for.
export const PLACES: { id: PlaceId; lonlat: [number, number]; theme: MissionId }[] = [
  { id: "ibera", lonlat: [-57.2, -28.4], theme: "fuego" },
  { id: "rondonia", lonlat: [-63.2, -10.4], theme: "vegetacion" },
  { id: "reykjanes", lonlat: [-22.27, 63.89], theme: "movimiento" },
];

const noted = new Set<string>();

// Layers a theme turns on: the pipeline list (config/layers.toml), the list above and the
// catalog entries of that theme. Unknown ids are dropped with one console note each.
export function presetLayers(
  themeId: string,
  remote: Record<string, string[]> | undefined,
  known: ((id: string) => boolean) | null,
): string[] {
  const base = [...(remote?.[themeId] ?? []), ...(THEME_LAYERS[themeId] ?? [])];
  // catalog entries tagged with this theme join it, so new layers need no edit here
  const list = Array.from(new Set([...base, ...(themeId === "todo" ? THEME_LAYERS.todo : []), ...catalog.entries().filter((e) => themeId === "todo" || e.theme === themeId).map((e) => e.id)]));
  const ids = list.filter((id) => id !== "radar");
  if (!known) return ids;
  return ids.filter((id) => {
    if (known(id)) return true;
    if (!noted.has(id)) {
      noted.add(id);
      console.info(`[presets] layer "${id}" is not in this build; skipped`);
    }
    return false;
  });
}

type Topic = { id: string; label: string; text: string; label_es?: string; text_es?: string };

// Topic chips in the insight card, in the UI language (topics.json is EN with ES fields).
export function topicCopy(id: string | undefined, lang: string): { label: string; text: string } | null {
  const t = (topics as Topic[]).find((x) => x.id === id);
  if (!t) return null;
  return lang === "es" ? { label: t.label_es || t.label, text: t.text_es || t.text } : { label: t.label, text: t.text };
}
