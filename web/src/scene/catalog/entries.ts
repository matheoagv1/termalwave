import { parseTomlTables, type TomlTable } from "./toml";

export type CatalogTier = "raw" | "processed" | "prediction";
export type CatalogKind = "raster_tiles" | "geojson_points" | "geojson_polygons" | "geojson_grid";
export type CatalogHonesty = "measured" | "derived" | "model" | "example";

export type CatalogInput = { name?: string; agency?: string; product?: string; url?: string };

export type CatalogEntry = {
  id: string;
  tier: CatalogTier;
  kind: CatalogKind;
  url: string;
  time: "daily" | "static" | "timeline";
  date_lag_days?: number;
  // fixed {date} for static products; "default" asks the server for its latest
  date?: string;
  min_zoom?: number;
  max_zoom?: number;
  opacity?: number;
  tile_size?: number;
  // false: the url is a whole feed, do not append bbox/date
  query?: boolean;
  value_prop?: string;
  unit?: string;
  range?: [number, number];
  ramp?: Array<[string, number]>;
  honesty: CatalogHonesty;
  confidence_prop?: string;
  confidence?: number;
  attribution?: string;
  source_url?: string;
  theme?: string;
  product?: string;
  formula?: string;
  inputs?: CatalogInput[];
  // bilingual copy: label_en, what_es, method_en ...
  [k: string]: unknown;
};

const TIERS = new Set(["raw", "processed", "prediction"]);
const KINDS = new Set(["raster_tiles", "geojson_points", "geojson_polygons", "geojson_grid"]);
const HONESTY = new Set(["measured", "derived", "model", "example"]);

// every config/catalog*.toml, read at build time so the layers work without a fresh app-config
const files = import.meta.glob<string>("../../../../config/catalog*.toml", { query: "?raw", import: "default", eager: true });

// Drops rows that break the contract instead of failing the whole catalog.
export function normalizeEntry(row: TomlTable | Record<string, unknown>): CatalogEntry | null {
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  if (!id || !TIERS.has(String(r.tier)) || !KINDS.has(String(r.kind)) || typeof r.url !== "string" || !r.url) return null;
  const e: CatalogEntry = {
    ...r,
    id,
    tier: r.tier as CatalogTier,
    kind: r.kind as CatalogKind,
    url: r.url,
    time: r.time === "daily" || r.time === "timeline" ? r.time : "static",
    honesty: HONESTY.has(String(r.honesty)) ? (r.honesty as CatalogHonesty) : "example",
  };
  const range = r.range;
  e.range = Array.isArray(range) && range.length === 2 && range.every((n) => Number.isFinite(Number(n)))
    ? [Number(range[0]), Number(range[1])]
    : undefined;
  const ramp = Array.isArray(r.ramp)
    ? (r.ramp as unknown[])
        .filter((s): s is [string, number] => Array.isArray(s) && typeof s[0] === "string" && Number.isFinite(Number(s[1])))
        .map((s) => [s[0], Number(s[1])] as [string, number])
        .sort((a, b) => a[1] - b[1])
    : [];
  e.ramp = ramp.length ? ramp : undefined;
  const conf = Number(r.confidence);
  e.confidence = r.confidence != null && Number.isFinite(conf) && conf >= 0 && conf <= 1 ? conf : undefined;
  e.inputs = Array.isArray(r.inputs) ? (r.inputs as CatalogInput[]).filter((x) => x && typeof x === "object") : undefined;
  return e;
}

// sorted by file name, first id wins
export function mergeRows(sources: Array<[string, Array<Record<string, unknown>>]>): CatalogEntry[] {
  const seen = new Set<string>();
  const out: CatalogEntry[] = [];
  for (const [name, rows] of sources) {
    for (const row of rows) {
      const e = normalizeEntry(row);
      if (!e) {
        console.warn(`catalog: ${name}: entry skipped, it breaks the contract`, row?.id);
        continue;
      }
      if (seen.has(e.id)) {
        console.warn(`catalog: ${name}: duplicate id ${e.id}, keeping the first`);
        continue;
      }
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

export function bundledEntries(): CatalogEntry[] {
  const sources: Array<[string, Array<Record<string, unknown>>]> = [];
  for (const path of Object.keys(files).sort()) {
    try {
      sources.push([path, parseTomlTables(files[path], "catalog")]);
    } catch (err) {
      console.warn(`catalog: ${path} unreadable`, err);
    }
  }
  return mergeRows(sources);
}

// Fills {date}. Daily products lag behind today; timeline products follow the timeline.
export function entryDate(e: CatalogEntry, timeline: string | null, today = new Date(), daily: string | null = null): string {
  if (e.time === "daily" && daily) return daily;
  if (e.time === "static") return typeof e.date === "string" && e.date ? e.date : "default";
  if (e.time === "timeline" && timeline) return timeline;
  const lag = Number.isFinite(Number(e.date_lag_days)) ? Number(e.date_lag_days) : 1;
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - lag * 86400000);
  return d.toISOString().slice(0, 10);
}

export function rampGradient(e: CatalogEntry): string {
  const ramp = e.ramp ?? [];
  if (!ramp.length) return "var(--tw-radar)";
  if (ramp.length === 1) return ramp[0][0];
  return `linear-gradient(90deg,${ramp.map(([c, at]) => `${c} ${Math.round(at * 100)}%`).join(",")})`;
}

export function text(e: CatalogEntry, key: string, lang: string): string {
  const v = e[`${key}_${lang}`] ?? e[`${key}_en`];
  return typeof v === "string" ? v : "";
}
