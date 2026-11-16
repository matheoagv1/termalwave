import React from "react";
import { BUNDLED_INPUTS, BUNDLED_META } from "../../layers/layer-copy";

// One source for "where it comes from and how it is made": the bundled layer copy,
// the taxonomy in app-config (config/layers.toml) and every [[catalog]] entry.
export type Input = { name?: string; agency?: string; product?: string; url?: string; date?: string };
export type LayerMeta = Record<string, unknown> & { id: string };

type Cfg = Record<string, unknown> & { layers_taxonomy?: Record<string, unknown> };

// A bundled catalog fallback, if the catalog loader ships one as JSON.
const bundled = import.meta.glob<unknown>(["../../../context/catalog*.json", "../../../data/catalog*.json"], {
  eager: true,
  import: "default",
});

function rowsOf(v: unknown): LayerMeta[] {
  const list = Array.isArray(v) ? v : v && typeof v === "object" && Array.isArray((v as { catalog?: unknown }).catalog) ? (v as { catalog: unknown[] }).catalog : [];
  return list.filter((r): r is LayerMeta => !!r && typeof r === "object" && typeof (r as { id?: unknown }).id === "string");
}

function catalogOf(cfg: Cfg): LayerMeta[] {
  const tax = cfg.layers_taxonomy ?? {};
  return [cfg.catalog, cfg.layers_catalog, cfg.catalog_layers, tax.catalog].flatMap(rowsOf);
}

type Loaded = { taxonomy: LayerMeta[]; catalog: LayerMeta[] };

let loaded: Loaded | null = null;
const waiting: Array<(l: Loaded) => void> = [];

const pending: Promise<Loaded> = fetch("./app-config.json")
  .then((r) => (r.ok ? (r.json() as Promise<Cfg>) : ({} as Cfg)))
  .catch(() => ({}) as Cfg)
  .then((cfg) => {
    const fromFiles = Object.values(bundled).flatMap(rowsOf);
    const byId = new Map<string, LayerMeta>();
    for (const r of [...fromFiles, ...catalogOf(cfg)]) byId.set(r.id, { ...(byId.get(r.id) ?? {}), ...r });
    loaded = { taxonomy: rowsOf(cfg.layers_taxonomy?.layers), catalog: [...byId.values()] };
    for (const w of waiting.splice(0)) w(loaded);
    return loaded;
  });

// Until app-config answers every id passes, so a preset never loses a catalog layer to a race.
export function isCatalogId(id: string): boolean {
  return !loaded || loaded.catalog.some((r) => r.id === id);
}

// Catalog ids whose `theme` matches a preset; "todo" takes every catalog layer.
export function catalogThemeIds(theme: string): string[] {
  return (loaded?.catalog ?? []).filter((r) => theme === "todo" || r.theme === theme).map((r) => r.id);
}

function merge(l: Loaded | null): Record<string, LayerMeta> {
  const out: Record<string, LayerMeta> = {};
  for (const [id, row] of Object.entries(BUNDLED_META)) out[id] = BUNDLED_INPUTS[id] ? { ...row, id, inputs: BUNDLED_INPUTS[id] } : { ...row, id };
  for (const r of [...(l?.taxonomy ?? []), ...(l?.catalog ?? [])]) out[r.id] = { ...(out[r.id] ?? {}), ...r };
  return out;
}

export function useLayerMeta(): Record<string, LayerMeta> {
  const [l, setL] = React.useState<Loaded | null>(loaded);
  React.useEffect(() => {
    let live = true;
    void pending.then((x) => {
      if (live) setL(x);
    });
    return () => {
      live = false;
    };
  }, []);
  return React.useMemo(() => merge(l), [l]);
}

export function str(m: LayerMeta | undefined, key: string): string {
  const v = m?.[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export function pickLang(m: LayerMeta | undefined, key: string, lang: string): string {
  return str(m, `${key}_${lang}`) || str(m, `${key}_en`) || str(m, key);
}

export function inputsOf(m: LayerMeta | undefined): Input[] {
  const v = m?.inputs;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Input => !!x && typeof x === "object").map((x) => ({
    name: typeof x.name === "string" ? x.name : undefined,
    agency: typeof x.agency === "string" ? x.agency : undefined,
    product: typeof x.product === "string" ? x.product : undefined,
    url: typeof x.url === "string" && /^https?:\/\//.test(x.url) ? x.url : undefined,
    date: typeof x.date === "string" ? x.date : undefined,
  }));
}

export function tierOfMeta(m: LayerMeta | undefined): "raw" | "processed" | "prediction" {
  const t = str(m, "tier");
  if (t === "processed" || t === "prediction") return t;
  const c = str(m, "category");
  return c === "inference" ? "processed" : c === "prediction" ? "prediction" : "raw";
}

export function confidenceText(m: LayerMeta | undefined): string {
  const n = Number(m?.confidence);
  if (m?.confidence != null && m.confidence !== "" && Number.isFinite(n) && n >= 0 && n <= 1) return `${Math.round(n * 100)} %`;
  return "";
}
