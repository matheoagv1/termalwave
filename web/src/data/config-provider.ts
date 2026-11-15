import type {
  Bounds,
  ContextEntry,
  DataProvider,
  Dataset,
  FrameRef,
  Hotspot,
  LayerDef,
  LayerId,
  LayerTheme,
  SearchResult,
  SeriesPoint,
  TimeTick,
} from "../tw/contract";
import bundledThemes from "../context/themes.json";
import bundledTopics from "../context/topics.json";
import { layerDef } from "./layer-defaults";
import {
  createPlaceSearch,
  searchConfigFromApp,
  type SearchConfig,
} from "./search";

// Formato actual del backend (app-config.json): una lista plana de años.
type DatasetFile = Dataset & {
  layers_taxonomy?: LegacyConfig["layers_taxonomy"];
};

type LegacyConfig = {
  aoi: Bounds & { name?: string };
  timeline: {
    years: number[];
    layers: Array<{ id: string; label: string; category?: string; core?: boolean }>;
    frames: Record<string, Record<string, { png: string; bounds: Bounds }>>;
    synthetic?: boolean;
  };
  presets?: Record<string, string[]>;
  preset_labels?: Record<string, string>;
  layers_taxonomy?: {
    layers?: Array<{ id: string; category?: string; core?: boolean; label?: string; theme?: string }>;
    themes?: LayerTheme[];
  };
  provenance?: { generated_at?: string };
  search?: {
    providers?: string[];
    endpoints?: Record<string, string>;
    user_agent?: string;
    google_maps_enabled?: boolean;
  };
  scene?: { google_maps_enabled?: boolean };
  data_sources?: Record<
    string,
    {
      strategy: string;
      status: string;
      selected_sources?: string[];
      tried?: Array<{ provider: string; ok: boolean; count?: number }>;
      from_cache?: boolean;
      count?: number;
    }
  >;
};

// Lectura por oficio: la escribe cricri en web/src/context/trades.json
// como [{ "trade": "...", "text": "..." }]. Si no existe, la lista queda vacía.
const tradeFiles = import.meta.glob<ContextEntry[]>("../context/trades.json", {
  eager: true,
  import: "default",
});
const bundledTrades: ContextEntry[] = Object.values(tradeFiles)[0] ?? [];

type TopicJson = { id: string; label: string; text: string };

function topicsToContext(rows: TopicJson[]): ContextEntry[] {
  return rows.map((t) => ({ id: t.id, label: t.label, trade: t.label, text: t.text }));
}

function resolveContext(remote: ContextEntry[] | undefined): ContextEntry[] {
  const topics = bundledTopics as TopicJson[];
  if (Array.isArray(topics) && topics.length > 0) return topicsToContext(topics);
  if (Array.isArray(remote) && remote.length > 0) return remote;
  return bundledTrades;
}

function resolveThemes(cfg: LegacyConfig | null | undefined): LayerTheme[] {
  const fromCfg = cfg?.layers_taxonomy?.themes;
  if (fromCfg?.length) return fromCfg;
  const bundled = bundledThemes as LayerTheme[];
  return Array.isArray(bundled) ? bundled : [];
}

type TaxonomySource = Pick<LegacyConfig, "layers_taxonomy"> | null | undefined;

function mergeLayerTaxonomy(layers: LayerDef[], cfg: TaxonomySource): LayerDef[] {
  const taxRows = cfg?.layers_taxonomy?.layers ?? [];
  const taxById = Object.fromEntries(taxRows.map((r) => [r.id, r]));
  return layers.map((l) => {
    const tax = taxById[l.id];
    return {
      ...l,
      theme: l.theme ?? tax?.theme,
      category: l.category ?? (tax?.category as LayerDef["category"]),
      core: l.core ?? tax?.core,
    };
  });
}

function attachMeta(ds: Dataset, cfg: LegacyConfig | null | undefined): void {
  ds.themes = ds.themes?.length ? ds.themes : resolveThemes(cfg);
  if (!ds.preset_labels && cfg?.preset_labels) ds.preset_labels = cfg.preset_labels;
}

export class ConfigError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function tryJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function validBounds(b: Bounds | undefined): b is Bounds {
  return (
    !!b &&
    [b.west, b.east, b.south, b.north].every((n) => Number.isFinite(n)) &&
    b.east > b.west &&
    b.north > b.south
  );
}

export class ConfigProvider implements DataProvider {
  private ds: Dataset | null = null;
  private searchCfg: SearchConfig = searchConfigFromApp(undefined);
  private runSearch = createPlaceSearch(this.searchCfg);

  constructor(private readonly base = "./") {}

  private setSearchFromConfig(cfg: Pick<LegacyConfig, "search" | "scene"> | null | undefined): void {
    this.searchCfg = searchConfigFromApp(cfg?.search, cfg?.scene?.google_maps_enabled);
    this.runSearch = createPlaceSearch(this.searchCfg);
  }

  async load(): Promise<Dataset> {
    // Contrato nuevo: el backend publica dataset.json con tramos.
    const direct = await tryJson<DatasetFile>(this.base + "dataset.json");
    if (direct && Array.isArray(direct.segments) && direct.layers?.length) {
      const cfg = await tryJson<LegacyConfig>(this.base + "app-config.json");
      const remoteCtx = await tryJson<ContextEntry[]>(this.base + "context.json");
      direct.context = resolveContext(
        Array.isArray(direct.context) && direct.context.length > 0 ? direct.context : remoteCtx ?? undefined,
      );
      // merge visual defaults with emitted taxonomy (category/core/theme)
      direct.layers = mergeLayerTaxonomy(
        direct.layers.map((l) => {
          const base = layerDef(l.id, l.label);
          return {
            ...base,
            ...l,
            category: l.category ?? base.category,
            core: l.core ?? base.core,
            note: l.note || base.note,
            ramp: l.ramp?.length ? l.ramp : base.ramp,
            unit: l.unit || base.unit,
            range: l.range ?? base.range,
          };
        }),
        cfg ?? (direct.layers_taxonomy ? { layers_taxonomy: direct.layers_taxonomy } : null),
      );
      if (!direct.themes?.length && direct.layers_taxonomy?.themes?.length) {
        direct.themes = direct.layers_taxonomy.themes;
      }
      if (!direct.presets && cfg?.presets) direct.presets = cfg.presets;
      attachMeta(direct, cfg);
      this.setSearchFromConfig(cfg);
      this.check(direct);
      this.ds = direct;
      return direct;
    }

    // Contrato actual: se arma un solo tramo anual desde app-config.json.
    const cfg = await tryJson<LegacyConfig>(this.base + "app-config.json");
    if (!cfg) throw new ConfigError("config", "No se pudo leer app-config.json");
    this.setSearchFromConfig(cfg);
    const ds = this.fromLegacy(cfg);
    const remoteCtx = await tryJson<ContextEntry[]>(this.base + "context.json");
    ds.context = resolveContext(remoteCtx ?? undefined);
    ds.layers = mergeLayerTaxonomy(ds.layers, cfg);
    attachMeta(ds, cfg);
    this.check(ds);
    this.ds = ds;
    return ds;
  }

  private check(ds: Dataset): void {
    if (!validBounds(ds.area?.bounds)) throw new ConfigError("bounds", "Límites del área inválidos");
    if (!ds.layers?.length) throw new ConfigError("layers", "No hay capas definidas");
    if (!ds.segments?.some((s) => s.ticks.length)) throw new ConfigError("timeline", "No hay puntos de tiempo");
  }

  private fromLegacy(cfg: LegacyConfig): Dataset {
    const { aoi, timeline } = cfg;
    const bounds: Bounds = { west: aoi.west, east: aoi.east, south: aoi.south, north: aoi.north };
    const ticks: TimeTick[] = timeline.years.map((year) => {
      const frames: Record<LayerId, FrameRef | null> = {};
      for (const layer of timeline.layers) {
        const f = timeline.frames[layer.id]?.[String(year)];
        frames[layer.id] = f ? { url: f.png, bounds: f.bounds, kind: "composite" } : null;
      }
      return { id: `y-${year}`, start: `${year}-01-01`, end: `${year}-12-31`, label: String(year), frames };
    });
    const first = timeline.years[0] ?? new Date().getFullYear();
    const last = timeline.years[timeline.years.length - 1] ?? first;
    const taxById = Object.fromEntries(
      (cfg.layers_taxonomy?.layers ?? []).map((r) => [r.id, r]),
    );
    return {
      area: {
        name: aoi.name ?? "Área de estudio",
        bounds,
        center: [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2],
      },
      layers: timeline.layers.map((l) => {
        const base = layerDef(l.id, l.label);
        const tax = taxById[l.id];
        return {
          ...base,
          category: (l.category as LayerDef["category"]) ?? tax?.category as LayerDef["category"] ?? base.category,
          core: l.core ?? tax?.core ?? base.core,
          theme: tax?.theme,
        };
      }),
      presets: cfg.presets,
      preset_labels: cfg.preset_labels,
      themes: resolveThemes(cfg),
      segments: [
        {
          id: "anual",
          label: "Años",
          from: `${first}-01-01`,
          to: `${last}-12-31`,
          granularity: "year",
          kind: "composite",
          ticks,
        },
      ],
      events: [],
      context: [],
      sourcesAt: cfg.provenance?.generated_at,
      sources: Object.entries(cfg.data_sources ?? {}).map(([kind, g]) => ({
        kind,
        strategy: g.strategy,
        status: g.status,
        selected: g.selected_sources ?? [],
        tried: (g.tried ?? []).map((t) => ({ provider: t.provider, ok: t.ok, count: t.count })),
        fromCache: !!g.from_cache,
        count: g.count ?? 0,
      })),
      timelineSynthetic: timeline.synthetic !== false,
      // pipeline fixture path is not MockProvider
      isMock: false,
    };
  }

  async series(layer: LayerId): Promise<SeriesPoint[]> {
    const ds = this.ds;
    if (!ds) return [];
    const remote = await tryJson<SeriesPoint[]>(`${this.base}series/${layer}.json`);
    if (remote) return remote;
    // Sin serie publicada: un punto por momento, sin valor.
    return ds.segments.flatMap((s) => s.ticks.map((t) => ({ tickId: t.id, date: t.start, value: null })));
  }

  async hotspots(layer: LayerId, tickId: string): Promise<Hotspot[]> {
    return (await tryJson<Hotspot[]>(`${this.base}hotspots/${layer}/${tickId}.json`)) ?? [];
  }

  async search(q: string): Promise<SearchResult[]> {
    const ds = this.ds;
    if (!ds) return [];
    return this.runSearch(q, ds.area);
  }
}
