// contrato entre la interfaz y el exterior
// los componentes solo conocen DataProvider y SceneApi
// los agregados respecto del handoff original estan marcados con "agregado"

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
  // agregado: decimales para formatear valores de la ficha y la serie
  decimals?: number;
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
  // agregado: el id es estable entre momentos de la misma capa ("suelo-0")
  // asi la tarjeta de detalle sigue abierta mientras se arrastra el tiempo
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
export interface ContextEntry { trade: string; text: string }

// agregado: resultado de busqueda de lugar o coordenadas
export interface SearchResult {
  kind: "area" | "coords";
  label: string;
  lonlat: [number, number];
}

// agregado: de donde salen los datos (provenance del backend)
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
  // agregado: opcional, lo llena el backend
  sources?: SourceGroup[];
  sourcesAt?: Iso;
  area: Area;
  layers: LayerDef[];
  segments: TimeSegment[];
  events: EventMark[];
  context: ContextEntry[];
  isMock: boolean;
}

export interface DataProvider {
  load(): Promise<Dataset>;
  series(layer: LayerId): Promise<SeriesPoint[]>;
  hotspots(layer: LayerId, tickId: string): Promise<Hotspot[]>;
  // agregado
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

export interface BasemapOption {
  id: string;
  label: string;
  url: string;
  tileSize: number;
  maxzoom: number;
  attribution: string;
}

export interface SceneApi {
  mount(el: HTMLElement): void;
  // agregado: set acepta null en compare y focus para borrarlos
  set(next: Partial<Omit<SceneState, "compare" | "focus">> & {
    compare?: SceneState["compare"] | null;
    focus?: SceneState["focus"] | null;
  }, opt?: { instant?: boolean }): void;   // agregado: instant omite el vuelo (arranque desde la URL)
  getState(): SceneState;
  flyTo(camera: CameraMode): Promise<void>;
  resetToOrbit(): Promise<void>;
  onChange(cb: (state: SceneState) => void): () => void;
  onPick(cb: (hotspotId: string | null) => void): () => void;
  status(): { online: boolean; terrain: boolean; basemap: boolean };
  // opcional: cambia el mapa base raster (solo la escena real)
  setBasemap?(b: BasemapOption): void;

  // agregados
  setDataset(ds: Dataset): void;               // la escena necesita limites y urls de cada imagen
  setHotspots(list: Hotspot[]): void;          // puntos de interes del momento y capa activos
  setPadding(p: Padding): void;                // espacio que ocupan los paneles flotantes
  project(lonlat: [number, number]): { x: number; y: number } | null; // para anclar la tarjeta de detalle
  setReducedMotion(on: boolean): void;
  refreshStyle(): void;                        // relee variables css al cambiar de tema
  destroy(): void;
}
