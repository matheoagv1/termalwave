import type {
  Bounds,
  ContextEntry,
  DataProvider,
  Dataset,
  FrameRef,
  Hotspot,
  LayerId,
  SearchResult,
  SeriesPoint,
  TimeTick,
} from "../tw/contract";
import { layerDef } from "./layer-defaults";

// Formato actual del backend (app-config.json): una lista plana de años.
type LegacyConfig = {
  aoi: Bounds & { name?: string };
  timeline: {
    years: number[];
    layers: Array<{ id: string; label: string }>;
    frames: Record<string, Record<string, { png: string; bounds: Bounds }>>;
    synthetic?: boolean;
  };
};

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

function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export class ConfigProvider implements DataProvider {
  private ds: Dataset | null = null;

  constructor(private readonly base = "./") {}

  async load(): Promise<Dataset> {
    // Contrato nuevo: el backend publica dataset.json con tramos.
    const direct = await tryJson<Dataset>(this.base + "dataset.json");
    if (direct && Array.isArray(direct.segments)) {
      this.check(direct);
      this.ds = direct;
      return direct;
    }

    // Contrato actual: se arma un solo tramo anual desde app-config.json.
    const cfg = await tryJson<LegacyConfig>(this.base + "app-config.json");
    if (!cfg) throw new ConfigError("config", "No se pudo leer app-config.json");
    const ds = this.fromLegacy(cfg);
    ds.context = (await tryJson<ContextEntry[]>(this.base + "context.json")) ?? [];
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
    return {
      area: {
        name: aoi.name ?? "Área de estudio",
        bounds,
        center: [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2],
      },
      layers: timeline.layers.map((l) => layerDef(l.id, l.label)),
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
      // Mientras el backend procese datos sintéticos se avisa en pantalla.
      isMock: timeline.synthetic !== false,
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
    const text = q.trim();
    if (!ds || !text) return [];
    const m = text.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
    if (m) {
      const lat = parseFloat((m[1] ?? "").replace(",", "."));
      const lon = parseFloat((m[2] ?? "").replace(",", "."));
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return [{ kind: "coords", label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lonlat: [lon, lat] }];
      }
    }
    if (norm(ds.area.name).includes(norm(text))) {
      return [{ kind: "area", label: ds.area.name, lonlat: ds.area.center }];
    }
    return [];
  }
}
