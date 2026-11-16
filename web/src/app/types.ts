import type { Lang } from "./i18n";
import type { BasemapOption,
  CameraMode,
  Dataset,
  DataProvider,
  Hotspot,
  SceneApi,
  SceneOptions,
  SceneState,
  SearchResult,
  SeriesPoint,
  TimeSegment,
  TimeTick,
} from "../tw/contract";

export type Flat = { seg: TimeSegment; tick: TimeTick };

export type Status = { online: boolean; terrain: boolean; basemap: boolean };

export type AppError = { code?: string; message?: string };

export type RailL = "" | "data" | "models" | "inference" | "utilities" | "annotate" | "visual";
export type RailR = "" | "area" | "insight" | "sources" | "legend" | "inspect";

export type ActivePlace = {
  label: string;
  lonlat: [number, number];
  bounds?: { west: number; east: number; south: number; north: number };
};

export type AppState = {
  ready: boolean;
  ds: Dataset | null;
  err: AppError | null;
  scene: SceneState;
  W: number;
  H: number;
  tlH: number;
  hotspots: Hotspot[];
  spotTrail: Record<string, Array<{ tickId: string; v: number }>>;
  series: Record<string, SeriesPoint[]>;
  pick: string | null;
  pickPos: { x: number; y: number } | null;
  zoomSeg: string | null;
  playing: boolean;
  scope: "all" | "seg";
  cmpTarget: "A" | "B";
  q: string;
  results: SearchResult[];
  searched: boolean;
  searchOpen: boolean;
  // null al abrir: el AOI no aparece hasta que haya busqueda (o demo area)
  activePlace: ActivePlace | null;
  toast: string;
  help: boolean;
  ficha: boolean;
  sheet: boolean;
  tab: "area" | "read" | "sources";
  trade: number;
  explore: boolean;
  status: Status;
  // la interfaz 2D es opcional: se pliega por partes o se oculta entera
  dockOpen: boolean;
  tlOpen: boolean;
  immersive: boolean;
  introOpen: boolean;
  introDone: boolean;
  userName: string;
  userTrade: string;
  soundOn: boolean;
  moniOpen: boolean;
  basemap: string;
  helpText: string;
  extras: string[];
  // focos de calor globales (FIRMS): estado de la consulta, no del mapa
  nisar: { status: "idle" | "loading" | "ok" | "empty" | "error"; count: number; msg: string };
  firms: { status: "idle" | "loading" | "ok" | "empty" | "error"; count: number; msg: string };
  clouds: { status: "idle" | "loading" | "ok" | "unavailable"; msg: string };
  lang: Lang;
  railL: RailL;
  railR: RailR;
};

export type AppProps = {
  makeProvider: (scenario: string) => DataProvider;
  makeScene: (opts: SceneOptions & Status) => SceneApi;
  // en modo real el escenario siempre es "normal"
  allowScenarios: boolean;
  // la escena real puede mostrar relieve si hay conexion
  realTerrain: boolean;
  theme: "dark" | "light";
  reducedMotion: boolean;
  // mapas base elegibles (el primero es el que arranca)
  basemaps?: BasemapOption[];
};

export type { CameraMode };
