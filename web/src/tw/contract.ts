// contrato entre la interfaz y el exterior
// los componentes solo conocen DataProvider y SceneApi

export type LayerId = string;
export type Iso = string;

export interface Bounds { west: number; east: number; south: number; north: number }

export interface Area {
  name: string;
  bounds: Bounds;
  center: [lon: number, lat: number];
}

export interface LayerDef {
  id: LayerId;
  label: string;
  unit: string;
  range: [min: number, max: number];
  ramp: Array<{ at: number; color: string }>;
  note: string;
  decimals?: number;
  honesty?: string;
  pol?: string;
  // taxonomia de capas (config/layers.toml): el nucleo SAR nunca se apaga
  category?: "data" | "prediction" | "inference";
  core?: boolean;
  /** Agrupa el panel Capas por tema */
  theme?: string;
}

export type Granularity = "year" | "quarter" | "month" | "week" | "day";
export type FrameKind = "composite" | "acquisition";

export interface FrameRef {
  url: string;
  bounds: Bounds;
  kind: FrameKind;
  resolutionM?: number;
  bytes?: number;
  source?: string;
  quality?: "ok" | "partial";
  honesty?: string;
}

export interface TimeTick {
  id: string;
  start: Iso;
  end: Iso;
  label: string;
  frames: Record<LayerId, FrameRef | null>;
}

export interface TimeSegment {
  id: string;
  label: string;
  from: Iso;
  to: Iso;
  granularity: Granularity;
  kind: FrameKind;
  ticks: TimeTick[];
}

export interface EventMark { id: string; date: Iso; layer?: LayerId; label: string }

export interface Hotspot {
  // id estable entre ticks de la misma capa para no cerrar la ficha al scrubear
  id: string;
  layer: LayerId;
  tickId: string;
  lonlat: [number, number];
  title: string;
  value: string;
  delta?: string;
  // valor numerico para armar la mini serie del punto mientras se mueve el tiempo
  sample?: number;
}

export interface SeriesPoint { tickId: string; date: Iso; value: number | null }
export interface ContextEntry {
  /** Preset id (cambio, ambiente, …) cuando viene de topics.json */
  id?: string;
  /** Etiqueta corta para chips; si falta, se usa trade */
  label?: string;
  trade: string;
  text: string;
}

export interface LayerTheme {
  id: string;
  label: string;
}

export interface SearchResult {
  kind: "area" | "coords";
  label: string;
  lonlat: [number, number];
}

export interface SourceTry { provider: string; ok: boolean; count?: number }
export interface SourceGroup {
  kind: string;          // "fires" | "weather" | "optical" | "radar" | ...
  strategy: string;
  status: string;        // "ok" | "cache" | "unavailable"
  selected: string[];
  tried: SourceTry[];
  fromCache: boolean;
  count: number;
}

export interface Dataset {
  sources?: SourceGroup[];
  sourcesAt?: Iso;
  area: Area;
  layers: LayerDef[];
  // preset id -> ids de capas que prende (el nucleo core no se lista: siempre esta); lo publica el backend
  presets?: Record<string, string[]>;
  preset_labels?: Record<string, string>;
  themes?: LayerTheme[];
  segments: TimeSegment[];
  events: EventMark[];
  context: ContextEntry[];
  isMock: boolean;
  timelineSynthetic?: boolean;
}

export interface DataProvider {
  load(): Promise<Dataset>;
  series(layer: LayerId): Promise<SeriesPoint[]>;
  hotspots(layer: LayerId, tickId: string): Promise<Hotspot[]>;
  search(q: string): Promise<SearchResult[]>;
}

export type CameraMode = "orbit" | "approach" | "territory" | "detail";
export type ViewScale = "campo" | "urbano";

export interface SceneState {
  camera: CameraMode;
  layer: LayerId;
  tickId: string;
  compare?: { tickId: string; split: number };
  tilt: number;
  northUp: boolean;
  viewScale: ViewScale;
  focus?: { lonlat: [number, number]; zoom: number };
}

export interface Padding { top: number; right: number; bottom: number; left: number }

export interface SceneOptions {
  online: boolean;
  terrain: boolean;
  basemap: boolean;
  reducedMotion: boolean;
  // textos accesibles de controles que dibuja la escena, vienen del catalogo
  labels: { curtain: string };
}

export interface BasemapTiles {
  url: string;
  tileSize: number;
  maxzoom: number;
  attribution: string;
}

export interface BasemapOption extends BasemapTiles {
  id: string;
  label: string;
  // capa de fondo continua debajo, tapa los huecos de las pasadas diarias
  underlay?: BasemapTiles;
}

export interface SceneApi {
  mount(el: HTMLElement): void;
  // null en compare/focus los borra; instant salta animacion (p. ej. deep link)
  set(next: Partial<Omit<SceneState, "compare" | "focus">> & {
    compare?: SceneState["compare"] | null;
    focus?: SceneState["focus"] | null;
  }, opt?: { instant?: boolean }): void;
  getState(): SceneState;
  flyTo(camera: CameraMode): Promise<void>;
  resetToOrbit(): Promise<void>;
  // two-phase return to the wide view; does not clear panels, layers, or the search
  backToEarth?(): Promise<void>;
  fitBounds?(bounds: Bounds): Promise<void>;
  onChange(cb: (state: SceneState) => void): () => void;
  onPick(cb: (hotspotId: string | null) => void): () => void;
  status(): { online: boolean; terrain: boolean; basemap: boolean };
  // opcional: cambia el mapa base raster (solo la escena real)
  setBasemap?(b: BasemapOption): void;
  // opcional: capas extra superpuestas a la activa (nucleo + las que sume el usuario o un rubro)
  setExtras?(ids: string[]): void;

  setDataset(ds: Dataset): void;               // la escena necesita limites y urls de cada imagen
  setHotspots(list: Hotspot[]): void;          // puntos de interes del momento y capa activos
  setPadding(p: Padding): void;                // espacio que ocupan los paneles flotantes
  project(lonlat: [number, number]): { x: number; y: number } | null; // para anclar la tarjeta de detalle
  setReducedMotion(on: boolean): void;
  refreshStyle(): void;                        // relee variables css al cambiar de tema
  // opcional: prende o apaga cielo, satelites, nubes, cuerpos
  setSpaceLayer?(id: string, on: boolean): void;
  // opcional: marcadores globales (p. ej. "firms") como GeoJSON; null los quita
  setEntities?(id: string, data: unknown | null): void;
  // zona activa (busqueda): bounds del estudio; null apaga chrome AOI
  setActivePlace?(bounds: Bounds | null): void;
  destroy(): void;
}
