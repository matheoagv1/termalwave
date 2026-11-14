import React from "react";
import { T } from "../tw/catalog.es-AR.js";
import type {
  Dataset,
  DataProvider,
  Hotspot,
  Padding,
  SceneApi,
  SceneState,
  SearchResult,
  TimeSegment,
  ViewScale,
} from "../tw/contract";
import { hashParams } from "./hash";
import { Hud } from "../ui/Hud";
import { readIntroPrefs, writeIntroPrefs } from "../ui/intro-prefs";
import { Sfx } from "../ui/sfx";
import type { Model } from "./view";
import { buildView } from "./view";
import type { AppProps, AppState, Flat, Status } from "./types";

const INITIAL_SCENE: SceneState = { camera: "orbit", layer: "", tickId: "", tilt: 35, northUp: true, viewScale: "campo" };
const intro0 = readIntroPrefs();

export class App extends React.Component<AppProps, AppState> implements Model {
  state: AppState = {
    ready: true,
    ds: null,
    err: null,
    scene: INITIAL_SCENE,
    W: 1280,
    H: 800,
    tlH: 200,
    hotspots: [],
    spotTrail: {},
    series: {},
    pick: null,
    pickPos: null,
    zoomSeg: null,
    playing: false,
    scope: "all",
    cmpTarget: "B",
    q: "",
    results: [],
    searched: false,
    searchOpen: false,
    toast: "",
    help: false,
    ficha: false,
    sheet: false,
    tab: "area",
    trade: 0,
    explore: false,
    status: { online: true, terrain: true, basemap: true },
    dockOpen: false,
    tlOpen: typeof window !== "undefined" ? window.innerWidth >= 760 : true,
    immersive: false,
    introOpen: !intro0.done,
    introDone: intro0.done,
    userName: intro0.name,
    userTrade: intro0.trade,
    soundOn: intro0.sound,
    moniOpen: false,
  };

  sceneRef = React.createRef<HTMLDivElement>();
  rootRef = React.createRef<HTMLDivElement>();
  tlRef = React.createRef<HTMLDivElement>();
  flat: Flat[] = [];
  idx: Record<string, number> = {};
  segRange: Record<string, { start: number; end: number }> = {};
  scene: SceneApi | null = null;
  provider: DataProvider | null = null;

  private ro: ResizeObserver | null = null;
  private tlRo: ResizeObserver | null = null;
  private tlEl: HTMLElement | null = null;
  private unC: (() => void) | null = null;
  private unP: (() => void) | null = null;
  private timer: number | undefined;
  private toastT: number | undefined;
  private qt: number | undefined;
  private posRaf = 0;
  private bootId = 0;
  private hsTok = 0;
  private extra = 0;
  private padKey: string | null = null;
  private themeKey: string | null = null;
  private rmKey: boolean | null = null;
  private scnKey: string | null = null;

  // ciclo de vida

  componentDidMount(): void {
    if (this.rootRef.current) {
      this.ro = new ResizeObserver(() => this.measure());
      this.ro.observe(this.rootRef.current);
    }
    document.addEventListener("keydown", this.onKeyDown);
    this.measure();
    void this.boot();
  }

  componentWillUnmount(): void {
    this.teardown();
    this.ro?.disconnect();
    this.tlRo?.disconnect();
    document.removeEventListener("keydown", this.onKeyDown);
  }

  componentDidUpdate(_pp: AppProps, ps: AppState): void {
    this.measure();
    const S = this.state;
    if (this.scene) {
      const key = [S.scene.camera, S.W, S.H, S.tlH, S.immersive, S.dockOpen, S.ficha].join();
      if (key !== this.padKey) {
        this.padKey = key;
        this.scene.setPadding(this.padding());
        this.trackPos();
      }
      if (this.theme !== this.themeKey) {
        this.themeKey = this.theme;
        this.scene.refreshStyle();
      }
      const rm = this.rm();
      if (rm !== this.rmKey) {
        this.rmKey = rm;
        this.scene.setReducedMotion(rm);
      }
      if (this.scenario() !== this.scnKey) void this.boot();
      if (S.pick !== ps.pick) this.trackPos();
    }
    const el = this.tlRef.current;
    if (el && this.tlEl !== el) {
      this.tlEl = el;
      if (!this.tlRo) this.tlRo = new ResizeObserver(() => this.measure());
      this.tlRo.disconnect();
      this.tlRo.observe(el);
    }
  }

  // parametros

  scenario(): string {
    return this.props.allowScenarios ? (hashParams().escenario ?? "normal") : "normal";
  }

  get theme(): "dark" | "light" {
    const v = hashParams().tema;
    if (v === "claro") return "light";
    if (v === "oscuro") return "dark";
    return this.props.theme;
  }

  rm(): boolean {
    return (
      this.props.reducedMotion ||
      hashParams().rm === "1" ||
      (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
    );
  }

  set = (patch: Partial<AppState>): void => {
    this.setState(patch as AppState);
  };

  measure(): void {
    const r = this.rootRef.current;
    if (!r) return;
    const S = this.state;
    const W = r.clientWidth;
    const H = r.clientHeight;
    const tlH = this.tlRef.current ? Math.round(this.tlRef.current.offsetHeight) : S.tlH;
    if (W !== S.W || H !== S.H || Math.abs(tlH - S.tlH) > 1) this.setState({ W, H, tlH });
  }

  teardown(): void {
    window.clearTimeout(this.timer);
    window.clearTimeout(this.toastT);
    cancelAnimationFrame(this.posRaf);
    this.unC?.();
    this.unP?.();
    this.unC = null;
    this.unP = null;
    if (this.scene) {
      this.scene.destroy();
      this.scene = null;
    }
    this.bootId += 1;
  }

  // arranque

  async boot(): Promise<void> {
    this.teardown();
    const my = this.bootId;
    const hp = hashParams();
    const sc = this.scenario();
    this.scnKey = sc;
    this.themeKey = this.theme;
    this.rmKey = this.rm();
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    const status: Status = this.props.allowScenarios
      ? { online: sc !== "sin-conexion", terrain: sc !== "sin-relieve", basemap: sc !== "sin-conexion" }
      : { online, terrain: this.props.realTerrain && online, basemap: online };
    this.provider = this.props.makeProvider(sc);
    this.scene = this.props.makeScene({
      ...status,
      reducedMotion: this.rmKey,
      labels: { curtain: T.compare.curtain },
    });
    const host = this.sceneRef.current;
    if (!host) return;
    this.scene.mount(host);
    this.unC = this.scene.onChange((st) => {
      const prev = this.state.scene;
      this.setState({ scene: st });
      if (prev.layer !== st.layer) {
        if (this.state.pick) this.onPick(null);
        this.setState({ spotTrail: {} });
      }
      if (prev.layer !== st.layer || prev.tickId !== st.tickId) void this.loadHotspots(st);
      this.writeHash(st);
    });
    this.unP = this.scene.onPick((id) => this.onPick(id));
    this.setState({
      ds: null,
      err: null,
      hotspots: [],
      spotTrail: {},
      series: {},
      pick: null,
      pickPos: null,
      zoomSeg: hp.zoom ?? null,
      playing: false,
      status,
      explore: hp.explorar === "1",
      help: hp.ayuda === "1",
      sheet: hp.ficha === "1",
      tab: hp.tab === "lectura" ? "read" : hp.tab === "fuentes" ? "sources" : "area",
      scene: INITIAL_SCENE,
    });
    this.padKey = null;
    this.scene.setPadding(this.padding());
    let start = hp.c ?? (sc !== "normal" && sc !== "error-config" ? "territory" : "orbit");
    if (start === "approach" || start === "detail") start = "territory";
    if (start !== "orbit") {
      this.scene.setPadding(this.padding("territory"));
      this.scene.set({ camera: "territory" }, { instant: true });
    }
    let ds: Dataset;
    try {
      ds = await this.provider.load();
    } catch (e) {
      if (my === this.bootId) this.setState({ err: e as { code?: string; message?: string } });
      return;
    }
    if (my !== this.bootId || !this.scene) return;
    this.derive(ds);
    await new Promise<void>((r) => this.setState({ ds }, r));
    this.scene.setDataset(ds);
    const lastSeg = ds.segments[ds.segments.length - 1];
    const lastTick = lastSeg?.ticks[lastSeg.ticks.length - 1];
    const layer = ds.layers.some((l) => l.id === hp.l) ? (hp.l as string) : (ds.layers[0]?.id ?? "");
    const tickId = hp.t && this.idx[hp.t] != null ? hp.t : (lastTick?.id ?? "");
    const tiltN = parseFloat(hp.tilt ?? "");
    const vista: ViewScale = hp.vista === "urbano" ? "urbano" : "campo";
    const set: Parameters<SceneApi["set"]>[0] = {
      layer,
      tickId,
      tilt: Number.isNaN(tiltN) ? 35 : tiltN,
      northUp: hp.n !== "0",
      viewScale: vista,
    };
    if (hp.cmp) {
      const [cid, sp] = hp.cmp.split(",");
      if (cid && this.idx[cid] != null) {
        const split = parseFloat(sp ?? "");
        set.compare = { tickId: cid, split: Number.isNaN(split) ? 0.5 : split };
      }
    }
    this.scene.set(set, { instant: true });
    if (set.compare) this.setState({ cmpTarget: "B" });
    const lists = await Promise.all(ds.layers.map((l) => this.provider!.series(l.id)));
    if (my !== this.bootId || !this.scene) return;
    const series: AppState["series"] = {};
    ds.layers.forEach((l, i) => {
      series[l.id] = lists[i] ?? [];
    });
    this.setState({ series });
    await this.loadHotspots(this.scene.getState());
    if (my === this.bootId && hp.pick) this.onPick(hp.pick);
    if (my === this.bootId && this.state.introDone) this.applyUserTrade();
  }

  applyUserTrade(): void {
    const ds = this.state.ds;
    if (!ds || !this.state.userTrade) return;
    const i = ds.context.findIndex((c) => c.trade === this.state.userTrade);
    if (i >= 0 && i !== this.state.trade) this.setState({ trade: i });
  }

  finishIntro = (name: string, trade: string): void => {
    writeIntroPrefs({ done: true, name, trade, sound: this.state.soundOn });
    this.setState({
      introOpen: false,
      introDone: true,
      userName: name,
      userTrade: trade,
      moniOpen: true,
    });
    this.applyUserTrade();
  };

  toggleMoni = (): void => {
    const next = !this.state.moniOpen;
    if (next && this.state.soundOn) Sfx.tip();
    this.setState({ moniOpen: next });
  };

  closeMoni = (): void => this.setState({ moniOpen: false });

  toggleSound = (): void => {
    const soundOn = !this.state.soundOn;
    writeIntroPrefs({ sound: soundOn });
    this.setState({ soundOn });
    if (soundOn) Sfx.blip();
  };

  derive(ds: Dataset): void {
    this.flat = [];
    this.idx = {};
    this.segRange = {};
    ds.segments.forEach((seg) => {
      const start = this.flat.length;
      seg.ticks.forEach((tick) => {
        this.idx[tick.id] = this.flat.length;
        this.flat.push({ seg, tick });
      });
      this.segRange[seg.id] = { start, end: this.flat.length - 1 };
    });
  }

  writeHash(st: SceneState): void {
    if (!st.layer || !st.tickId) return;
    const o = hashParams();
    const p: string[] = [];
    if (o.escenario) p.push("escenario=" + o.escenario);
    if (o.tema) p.push("tema=" + o.tema);
    if (o.mock) p.push("mock=" + o.mock);
    p.push("c=" + (st.camera === "approach" ? "territory" : st.camera), "l=" + st.layer, "t=" + st.tickId);
    if (st.compare) p.push(`cmp=${st.compare.tickId},${st.compare.split.toFixed(2)}`);
    p.push("tilt=" + Math.round(st.tilt), "n=" + (st.northUp ? 1 : 0));
    if (this.state.pick) p.push("pick=" + this.state.pick);
    if (this.state.zoomSeg) p.push("zoom=" + this.state.zoomSeg);
    if (st.viewScale && st.viewScale !== "campo") p.push("vista=" + st.viewScale);
    try {
      history.replaceState(null, "", "#" + p.join("&"));
    } catch {
      /* sin historial */
    }
  }

  async loadHotspots(st: SceneState): Promise<void> {
    if (!this.state.ds || !st.layer || !st.tickId || !this.provider) return;
    this.hsTok += 1;
    const tok = this.hsTok;
    let list: Hotspot[] = [];
    try {
      list = await this.provider.hotspots(st.layer, st.tickId);
    } catch {
      list = [];
    }
    if (tok !== this.hsTok || !this.scene) return;
    this.scene.setHotspots(list);
    const trail = { ...this.state.spotTrail };
    for (const h of list) {
      if (h.sample == null) continue;
      const key = JSON.stringify([st.layer, h.id]);
      const prev = trail[key] ?? [];
      const ix = prev.findIndex((p) => p.tickId === st.tickId);
      const pt = { tickId: st.tickId, v: h.sample };
      trail[key] = ix >= 0 ? prev.map((p, i) => (i === ix ? pt : p)) : [...prev, pt];
    }
    this.setState({ hotspots: list, spotTrail: trail });
    const pk = this.state.pick;
    if (pk && !list.find((h) => h.id === pk)) {
      this.setState({ pick: null });
      this.scene.set({ camera: "territory", focus: null });
    }
  }

  onPick(id: string | null): void {
    if (!this.scene) return;
    if (id == null) {
      if (this.state.pick) {
        this.setState({ pick: null });
        this.scene.set({ camera: "territory", focus: null });
      }
      return;
    }
    const h = this.state.hotspots.find((x) => x.id === id);
    if (!h) return;
    this.setState({ pick: id });
    this.scene.set({ camera: "detail", focus: { lonlat: h.lonlat, zoom: 1.7 } });
  }

  closePick = (): void => this.onPick(null);

  trackPos(ms = 1200): void {
    cancelAnimationFrame(this.posRaf);
    const t0 = performance.now();
    const f = (): void => {
      this.updatePickPos();
      if (performance.now() - t0 < ms) this.posRaf = requestAnimationFrame(f);
    };
    f();
  }

  updatePickPos(): void {
    const S = this.state;
    if (!this.scene) return;
    const h = S.pick ? S.hotspots.find((x) => x.id === S.pick) : undefined;
    if (!h) {
      if (S.pickPos) this.setState({ pickPos: null });
      return;
    }
    const p = this.scene.project(h.lonlat);
    const o = S.pickPos;
    if (p && (!o || Math.abs(o.x - p.x) > 0.5 || Math.abs(o.y - p.y) > 0.5)) this.setState({ pickPos: p });
  }

  padding(camOverride?: string): Padding {
    const S = this.state;
    const isM = S.W < 760;
    const cam = camOverride ?? S.scene.camera;
    if (cam === "orbit") {
      const cardB = isM ? 200 : 160;
      return isM
        ? { top: 52, right: 12, bottom: cardB, left: 12 }
        : { top: 52, right: 16, bottom: cardB, left: 16 };
    }
    if (S.immersive) return { top: 12, left: 12, right: 12, bottom: 12 };
    // el globo cede solo el espacio de los paneles que están desplegados
    return isM
      ? { top: 112, left: 8, right: 60, bottom: 52 + S.tlH + 20 }
      : {
          top: 64,
          left: S.dockOpen ? 236 : 48,
          right: S.ficha ? 300 : 56,
          bottom: S.tlH + 28,
        };
  }

  // linea de tiempo

  targetId(): string {
    const sc = this.state.scene;
    return this.state.cmpTarget === "B" && sc.compare ? sc.compare.tickId : sc.tickId;
  }

  setTarget(id: string): void {
    if (!this.scene) return;
    const sc = this.state.scene;
    if (this.state.cmpTarget === "B" && sc.compare) this.scene.set({ compare: { ...sc.compare, tickId: id } });
    else this.scene.set({ tickId: id });
    const f = this.flat[this.idx[id] ?? -1];
    if (this.state.zoomSeg && f && f.seg.id !== this.state.zoomSeg) this.setState({ zoomSeg: f.seg.id });
  }

  userSet(id: string): void {
    this.stopPlay();
    this.setTarget(id);
  }

  step = (d: number): void => {
    const i = this.idx[this.targetId()];
    if (i == null) return;
    const f = this.flat[Math.max(0, Math.min(this.flat.length - 1, i + d))];
    if (f) this.userSet(f.tick.id);
  };

  segStep(d: number): void {
    const i = this.idx[this.targetId()];
    const cur = i != null ? this.flat[i] : undefined;
    const ds = this.state.ds;
    if (!cur || !ds) return;
    const segs = ds.segments;
    const si = segs.findIndex((s) => s.id === cur.seg.id);
    const target = segs[Math.max(0, Math.min(segs.length - 1, si + d))];
    const range = target ? this.segRange[target.id] : undefined;
    const f = range ? this.flat[range.start] : undefined;
    if (f) this.userSet(f.tick.id);
  }

  tickClick = (id: string, segId: string): void => {
    if (this.state.W < 760 && this.state.zoomSeg !== segId) this.setState({ zoomSeg: segId });
    this.userSet(id);
  };

  segHead = (segId: string): void => this.setState({ zoomSeg: this.state.zoomSeg === segId ? null : segId });

  pace(seg: TimeSegment): number {
    if (seg.kind === "acquisition") return 800;
    return { year: 1300, quarter: 1000, month: 650, week: 600, day: 500 }[seg.granularity];
  }

  togglePlay = (): void => {
    if (this.state.playing) {
      this.stopPlay();
      return;
    }
    if (this.flat.length < 2) return;
    const i = this.idx[this.targetId()] ?? 0;
    const first = this.flat[0];
    if (this.state.scope === "all" && i >= this.flat.length - 1 && first) this.setTarget(first.tick.id);
    this.setState({ playing: true }, () => this.schedule());
  };

  stopPlay(): void {
    window.clearTimeout(this.timer);
    this.extra = 0;
    if (this.state.playing) this.setState({ playing: false });
  }

  schedule(): void {
    window.clearTimeout(this.timer);
    const cur = this.flat[this.idx[this.targetId()] ?? -1];
    if (!cur) return;
    const d = this.pace(cur.seg) + this.extra;
    this.extra = 0;
    this.timer = window.setTimeout(() => this.advance(), d);
  }

  advance(): void {
    if (!this.state.playing) return;
    const i = this.idx[this.targetId()] ?? 0;
    const cur = this.flat[i];
    if (!cur) return;
    let ni = i + 1;
    if (this.state.scope === "all") {
      if (ni >= this.flat.length) {
        this.stopPlay();
        return;
      }
    } else {
      const range = this.segRange[cur.seg.id];
      if (range && i >= range.end) ni = range.start;
    }
    const nx = this.flat[ni];
    if (!nx) return;
    if (nx.seg.id !== cur.seg.id) {
      this.showToast(T.timeline.crossing(nx.seg.label, this.granText(nx.seg)));
      this.extra = 1100;
    }
    this.setTarget(nx.tick.id);
    this.schedule();
  }

  showToast(msg: string, ms = 1800): void {
    this.setState({ toast: msg });
    window.clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => this.setState({ toast: "" }), ms);
  }

  granText(seg: TimeSegment): string {
    const a = seg.ticks[0];
    const b = seg.ticks[1];
    if (seg.kind === "acquisition" && a && b)
      return T.acqEvery(Math.round((+new Date(b.start) - +new Date(a.start)) / 864e5));
    return seg.kind === "acquisition" ? T.kind.acquisition.toLowerCase() : T.granEvery[seg.granularity];
  }

  toggleCompare = (): void => {
    if (!this.scene) return;
    const sc = this.state.scene;
    if (sc.compare) {
      this.scene.set({ compare: null });
      this.setState({ cmpTarget: "A" });
      return;
    }
    const bi = (this.idx[sc.tickId] ?? 0) > 0 ? 0 : this.flat.length - 1;
    const other = this.flat[bi];
    if (!other) return;
    this.scene.set({ compare: { tickId: other.tick.id, split: 0.5 } });
    this.setState({ cmpTarget: "B" });
  };

  // camara y busqueda

  enter = (): void => {
    if (!this.state.ds || !this.scene) return;
    this.setState({ explore: false, ficha: this.state.W >= 760 });
    this.scene.set({ focus: null });
    void this.scene.flyTo("territory");
  };

  toOrbit = (): void => {
    this.stopPlay();
    this.setState({ pick: null, explore: false });
    void this.scene?.resetToOrbit();
  };

  retry = (): void => {
    void this.boot();
  };

  onQ = (q: string): void => {
    this.setState({ q, searched: false });
    window.clearTimeout(this.qt);
    if (!q.trim()) {
      this.setState({ results: [] });
      return;
    }
    this.qt = window.setTimeout(async () => {
      const r = this.provider ? await this.provider.search(q) : [];
      if (this.state.q === q) this.setState({ results: r, searched: true });
    }, 120);
  };

  onQKey = (key: string): void => {
    const first = this.state.results[0];
    if (key === "Enter" && first) this.goResult(first);
    if (key === "Escape") this.setState({ q: "", results: [], searchOpen: false });
  };

  goResult = (r: SearchResult): void => {
    const ds = this.state.ds;
    if (!ds || !this.scene) return;
    const b = ds.area.bounds;
    const [lon, lat] = r.lonlat;
    const inside = lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north;
    this.setState({ q: "", results: [], searched: false, searchOpen: false });
    if (r.kind === "area" || inside) {
      if (this.state.scene.camera === "orbit") this.enter();
      return;
    }
    this.showToast(T.search.going(r.label));
    if (this.state.scene.camera !== "orbit") void this.scene.resetToOrbit();
    this.scene.set({ focus: { lonlat: r.lonlat, zoom: 1 } });
    this.setState({ explore: true });
  };

  // teclado

  onKeyDown = (e: KeyboardEvent): void => {
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (el?.closest?.("[data-scene-handle]")) return;
    if (e.ctrlKey || e.metaKey || e.altKey || !this.scene) return;
    const S = this.state;
    const hud = (S.scene.camera === "territory" || S.scene.camera === "detail") && S.ds;
    const k = e.key;
    if (k === "Escape") {
      if (S.help) this.setState({ help: false });
      else if (S.pick) this.closePick();
      else if (S.sheet) this.setState({ sheet: false });
      else if (S.searchOpen) this.setState({ searchOpen: false });
      return;
    }
    if (k === "?") {
      this.setState({ help: !S.help });
      return;
    }
    if (!hud) return;
    if (k === "h" || k === "H") {
      e.preventDefault();
      this.toggleImmersive();
      return;
    }
    const go = (fn: () => void): void => {
      e.preventDefault();
      fn();
    };
    const firstTick = this.flat[0];
    const lastTick = this.flat[this.flat.length - 1];
    if (k === "ArrowLeft") go(() => this.step(-1));
    else if (k === "ArrowRight") go(() => this.step(1));
    else if (k === "PageUp") go(() => this.segStep(-1));
    else if (k === "PageDown") go(() => this.segStep(1));
    else if (k === "Home" && firstTick) go(() => this.userSet(firstTick.tick.id));
    else if (k === "End" && lastTick) go(() => this.userSet(lastTick.tick.id));
    else if (k === " " && tag !== "BUTTON") go(this.togglePlay);
    else if (k === "c" || k === "C") go(this.toggleCompare);
    else if (k === "o" || k === "O") go(this.toOrbit);
    else if (k === "p" || k === "P") go(this.cycleHotspot);
    else if (k === "1") go(() => this.setViewScale("campo"));
    else if (k === "2") go(() => this.setViewScale("urbano"));
  };

  toggleImmersive = (): void => this.setState({ immersive: !this.state.immersive });

  setViewScale = (scale: ViewScale): void => {
    if (!this.scene || this.state.scene.viewScale === scale) return;
    const cam = this.state.scene.camera;
    this.scene.set({ viewScale: scale });
    if (cam === "territory" || cam === "detail") this.trackPos();
  };

  cycleHotspot = (): void => {
    const list = this.state.hotspots;
    if (!list.length) return;
    const i = this.state.pick ? list.findIndex((h) => h.id === this.state.pick) : -1;
    const next = list[(i + 1) % list.length];
    if (next) this.onPick(next.id);
  };

  // render

  render(): React.ReactNode {
    const v = buildView(this);
    const blur = v.sceneSoft && !this.rm();
    return (
      <div
        data-tw-theme={this.theme}
        ref={this.rootRef}
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          background: "var(--bg)",
          color: "var(--fg)",
          font: "13px/1.4 var(--sans)",
        }}
      >
        <div
          ref={this.sceneRef}
          className={blur ? "tw-scene-soft" : undefined}
          style={{ position: "absolute", inset: 0 }}
        />
        <Hud v={v} a={this} tlRef={this.tlRef} />
      </div>
    );
  }
}
