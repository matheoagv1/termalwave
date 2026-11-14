import type {
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

export type AppState = {
  ready: boolean;
  ds: Dataset | null;
  err: AppError | null;
  scene: SceneState;
  W: number;
  H: number;
  tlH: number;
  hotspots: Hotspot[];
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
  toast: string;
  help: boolean;
  ficha: boolean;
  sheet: boolean;
  tab: "area" | "read" | "sources";
  trade: number;
  explore: boolean;
  status: Status;
};

export type AppProps = {
  makeProvider: (scenario: string) => DataProvider;
  makeScene: (opts: SceneOptions & Status) => SceneApi;
  // en modo real el escenario siempre es "normal"
  allowScenarios: boolean;
  theme: "dark" | "light";
  reducedMotion: boolean;
};

export type { CameraMode };
