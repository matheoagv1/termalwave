import type { Lang } from "../../app/i18n";
import { readPrefs, writePrefs } from "../../app/prefs";
import type { BasemapOption } from "../../tw/contract";

// Imagery first, then a street map. Daily GIBS true-colour is one date with
// orbit gaps, and CARTO raster answers "API KEY REQUIRED", so neither is a base.
type Base = { id: string; en: string; es: string; swatch: string };

export const BASEMAPS: readonly Base[] = [
  { id: "eox_s2cloudless_2025", en: "Satellite", es: "Satélite", swatch: "linear-gradient(135deg,#1d3b5a 0 38%,#3f5d2e 38% 62%,#8a7a55 62%)" },
  { id: "esri_world_imagery", en: "Esri imagery", es: "Imagen Esri", swatch: "linear-gradient(135deg,#1a4a28 0 40%,#c4a36a 40% 70%,#1d4e89 70%)" },
  { id: "gibs_blue_marble", en: "Blue Marble", es: "Blue Marble", swatch: "linear-gradient(135deg,#0c2a52 0 55%,#2f5a2a 55% 80%,#e8ecef 80%)" },
  { id: "osm_standard", en: "Streets", es: "Calles", swatch: "linear-gradient(90deg,transparent 0 46%,#f2c27a 46% 54%,transparent 54%),linear-gradient(0deg,transparent 0 46%,#ffffff 46% 54%,transparent 54%),#e6e1d6" },
];

const LEGACY = "tw-basemap";

// Allowlist order, default first; the App takes [0] as the start basemap.
export function pickBasemaps(list: BasemapOption[]): BasemapOption[] {
  const byId = new Map(list.map((o) => [o.id, o]));
  const out: BasemapOption[] = [];
  for (const b of BASEMAPS) {
    const o = byId.get(b.id);
    if (o) out.push({ ...o, label: b.en });
  }
  return out.length ? out : list;
}

export function basemapMeta(id: string, lang: Lang): { label: string; swatch: string } {
  const b = BASEMAPS.find((x) => x.id === id);
  return { label: b ? (lang === "es" ? b.es : b.en) : id, swatch: b?.swatch ?? "var(--line2)" };
}

function offered(list: BasemapOption[] | undefined, id: string | undefined): string {
  return id && list?.some((o) => o.id === id) ? id : "";
}

// A saved id that is no longer offered falls back to the default.
export function savedBasemap(list: BasemapOption[] | undefined): string {
  const first = list?.[0]?.id ?? "";
  const fromPrefs = offered(list, readPrefs()?.basemap);
  if (fromPrefs) return fromPrefs;
  try {
    return offered(list, localStorage.getItem(LEGACY) ?? undefined) || first;
  } catch {
    return first;
  }
}

export function saveBasemap(id: string): void {
  writePrefs({ basemap: id });
}
