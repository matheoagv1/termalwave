import { layersAviso, sourceNote } from "../data/layer-defaults";
import { F, T } from "../tw/catalog.es-AR.js";
import type { LayerDef, SceneApi, SearchResult, TimeSegment, ViewScale } from "../tw/contract";
import type { AppState, Flat } from "./types";

// Todo lo que la interfaz necesita saber del modelo. App lo implementa.
export interface Model {
  state: AppState;
  flat: Flat[];
  idx: Record<string, number>;
  scene: SceneApi | null;
  theme: "dark" | "light";
  set(patch: Partial<AppState>): void;
  granText(seg: TimeSegment): string;
  enter(): void;
  toOrbit(): void;
  basemaps: Array<{ id: string; label: string }>;
  setBasemap(id: string): void;
  toggleExtra(id: string): void;
  retry(): void;
  closePick(): void;
  togglePlay(): void;
  step(d: number): void;
  toggleCompare(): void;
  tickClick(id: string, segId: string): void;
  segHead(segId: string): void;
  goResult(r: SearchResult): void;
  onQ(value: string): void;
  onQKey(key: string): void;
  setViewScale(scale: ViewScale): void;
  cycleHotspot(): void;
}

const MOBILE = 760;

export function buildView(m: Model) {
  const S = m.state;
  const theme = m.theme;
  const ds = S.ds;
  const sc = S.scene;
  const W = S.W;
  const isM = W < MOBILE;
  const hit = isM ? 44 : 32;
  const cam = sc.camera;
  const viewScale = sc.viewScale ?? "campo";
  const pad = isM ? 8 : 12;
  const hasDs = !!ds;
  const err = S.err;
  const hud = (cam === "territory" || cam === "detail") && !err;
  // la interfaz 2D es opcional: en modo inmersivo solo queda la escena y la cámara
  const chrome = hud && !S.immersive;
  const imm = S.immersive;
  const layers: LayerDef[] = ds ? ds.layers : [];
  const L = layers.find((l) => l.id === sc.layer) ?? null;
  const fa: Flat | null = (ds && m.flat[m.idx[sc.tickId] ?? -1]) || null;
  const nameOf = (f: Flat): string => T.tickName(f.seg.kind, f.tick.label);
  const swatch = (l: LayerDef): string => {
    let best = l.ramp[0];
    if (!best) return "transparent";
    for (const step of l.ramp) if (Math.abs(step.at - 0.7) < Math.abs(best.at - 0.7)) best = step;
    return best.color;
  };
  const grad = (l: LayerDef): string =>
    "linear-gradient(90deg," + l.ramp.map((r) => `${r.color} ${r.at * 100}%`).join(",") + ")";
  const cardOpen = isM ? S.sheet : S.ficha;
  const panel = "var(--panel)";
  const bd = "1px solid var(--line)";
  const bl = "blur(10px)";

  const lay = {
    pad: pad + "px",
    hit: hit + "px",
    labelT: isM ? "104px" : "64px",
    camW: isM ? hit + "px" : "auto",
    camTf: isM ? "none" : "translateX(-50%)",
    camDir: isM ? "column" : "row",
    sepSh: isM ? "inset 0 1px 0 var(--line)" : "inset 1px 0 0 var(--line)",
    camL: isM ? "auto" : "50%",
    camR: isM ? "8px" : "auto",
    camT: isM ? "104px" : "auto",
    camB: isM ? "auto" : imm ? "12px" : S.tlH + 24 + "px",
    tlL: pad + "px",
    tlR: pad + "px",
    tlB: isM ? "52px" : "12px",
    exploreB: (isM ? 52 + S.tlH + 14 : S.tlH + 22) + "px",
    exploreL: isM ? pad + "px" : S.dockOpen ? "248px" : "64px",
    toastB: imm ? "12px" : (isM ? 52 : 12) + S.tlH + 12 + "px",
    entL: isM ? "8px" : "12px",
    entR: isM ? "8px" : "auto",
    entT: isM ? "auto" : "auto",
    entB: isM ? "8px" : "12px",
    entW: isM ? "auto" : "340px",
    entTf: "none",
    cL: isM ? "0" : "auto",
    cR: isM ? "0" : "12px",
    cT: isM ? "auto" : "64px",
    cB: isM ? "0" : S.tlH + 24 + "px",
    cW: isM ? "auto" : cardOpen ? "280px" : "auto",
    cH: isM ? (cardOpen ? "70%" : "44px") : "auto",
    cJ: isM ? "flex-start" : "space-between",
    cPE: isM ? "auto" : "none",
    shBg: isM ? "var(--panel-solid)" : "transparent",
    shBd: isM ? bd : "0",
    inBg: isM ? "transparent" : panel,
    inBd: isM ? "0" : bd,
    inBl: isM ? "none" : bl,
  };

  // busqueda
  const searchField = (!isM || S.searchOpen) && !imm;
  const showResults = searchField && !!S.q.trim() && (S.results.length > 0 || S.searched);
  const results = S.results.map((r) => ({ label: r.label, go: () => m.goResult(r) }));
  const st = S.status;

  // capas
  const CAT_ORDER = ["data", "prediction", "inference"];
  const CAT_LABEL: Record<string, string> = { data: "Datos", prediction: "Predicciones", inference: "Inferencias" };
  const catOf = (l: LayerDef): string => l.category ?? "data";
  const sortedLayers = [...layers].sort((a, b) => CAT_ORDER.indexOf(catOf(a)) - CAT_ORDER.indexOf(catOf(b)));
  const layerItems = sortedLayers.map((l, i) => {
    const on = l.id === sc.layer;
    const gap = !!(fa && !fa.tick.frames[l.id]);
    return {
      id: l.id,
      label: l.label,
      unit: l.unit,
      note: l.note,
      core: !!l.core,
      head: i === 0 || catOf(sortedLayers[i - 1]) !== catOf(l) ? (CAT_LABEL[catOf(l)] ?? "") : "",
      on,
      gap,
      grad: grad(l),
      bg: on ? "var(--sel)" : "transparent",
      chipBg: on ? "var(--sel)" : panel,
      go: () => m.scene?.set({ layer: l.id }),
    };
  });
  const activeLayer = L;

  // ficha y valor
  const fb: Flat | null = ds && sc.compare ? (m.flat[m.idx[sc.compare.tickId] ?? -1] ?? null) : null;
  const compareOn = !!sc.compare && !!fb && !!fa;
  const iA = fa ? (m.idx[sc.tickId] ?? -1) : -1;
  const iB = fb && sc.compare ? (m.idx[sc.compare.tickId] ?? -1) : -1;
  const rawSeries = L ? S.series[L.id] : undefined;
  const byTickId = new Map(rawSeries?.map((point) => [point.tickId, point]));
  const sp = rawSeries ? m.flat.map((item) => byTickId.get(item.tick.id) ?? { tickId: item.tick.id, date: item.tick.start, value: null }) : undefined;
  // El backend todavía no publicó valores para esta capa: se explica en vez de repetir "Sin dato".
  const noSeries = !!sp && sp.length > 0 && sp.every((p) => p.value == null);
  const spA = sp ? sp[iA] : undefined;
  const dec = L?.decimals ?? 0;
  const hasFrame = !!(fa && L && fa.tick.frames[L.id]);
  const pickHit =
    S.pick && L
      ? S.hotspots.find((h) => h.id === S.pick && h.layer === L.id && h.tickId === sc.tickId)
      : undefined;
  const meanValue = spA && spA.value != null && L ? F.value(spA.value, L.unit, dec) : "";
  let valueText = "";
  let areaValueLabel = L ? T.card.value : "";
  let areaValueHint = "";
  let areaShowDelta = false;
  if (meanValue) {
    valueText = meanValue;
    areaShowDelta = true;
  } else if (pickHit) {
    valueText = pickHit.value;
    areaValueLabel = T.card.valuePoint;
    areaShowDelta = !!pickHit.delta;
  } else if (L) {
    if (hasFrame && !noSeries) areaValueHint = T.card.valueClickHint;
    else if (!noSeries) valueText = T.card.noValue;
  }
  let deltaText = "";
  if (!meanValue && pickHit?.delta) deltaText = pickHit.delta;
  else if (spA && spA.value != null && L && sp) {
    let j = iA - 1;
    while (j >= 0 && sp[j]?.value == null) j -= 1;
    const prev = j >= 0 ? sp[j] : undefined;
    const prevFlat = j >= 0 ? m.flat[j] : undefined;
    if (!prev || prev.value == null || !prevFlat) deltaText = T.card.deltaNone;
    else {
      const dv = spA.value - prev.value;
      const lb = nameOf(prevFlat);
      deltaText =
        Math.abs(dv) < Math.pow(10, -dec) / 2
          ? T.card.noChange(lb)
          : T.card.delta(F.delta(dv, L.unit, dec), lb);
    }
  }

  // serie
  const serW = isM ? Math.min(W - 40, 560) : 266;
  const serH = 56;
  const ser = { w: serW, lineD: "", divD: "", gapD: "", ax: 0, ay: 0, ar: 0, bx: 0, by: 0, br: 0, y0: "", y1: "" };
  if (ds && L && sp && m.flat.length) {
    const n = m.flat.length;
    const span = L.range[1] - L.range[0] || 1;
    const xOf = (i: number): number => (n < 2 ? serW / 2 : 2 + ((serW - 4) * i) / (n - 1));
    const yOf = (v: number): number => serH - 4 - ((serH - 8) * (v - L.range[0])) / span;
    let pen = false;
    sp.forEach((p, i) => {
      const x = xOf(i);
      if (p.value == null) {
        pen = false;
        ser.gapD += `M${x.toFixed(1)} ${serH} L${x.toFixed(1)} ${serH - 7} `;
      } else {
        ser.lineD += `${pen ? "L" : "M"}${x.toFixed(1)} ${yOf(p.value).toFixed(1)} `;
        pen = true;
      }
    });
    let acc = 0;
    ds.segments.slice(0, -1).forEach((seg) => {
      acc += seg.ticks.length;
      const x = (xOf(acc - 1) + xOf(acc)) / 2;
      ser.divD += `M${x.toFixed(1)} 0 L${x.toFixed(1)} ${serH} `;
    });
    if (spA && spA.value != null) {
      ser.ax = xOf(iA);
      ser.ay = yOf(spA.value);
      ser.ar = 4;
    }
    const spB = compareOn ? sp[iB] : undefined;
    if (spB && spB.value != null) {
      ser.bx = xOf(iB);
      ser.by = yOf(spB.value);
      ser.br = 4;
    }
    const first = m.flat[0];
    const last = m.flat[n - 1];
    if (first && last) {
      ser.y0 = F.year(first.seg.from);
      ser.y1 = F.year(last.seg.to);
    }
  }

  // filas de imagen
  const fr = fa && L ? fa.tick.frames[L.id] : null;
  type Row = { k: string; v: string };
  let imgRows: Row[] = [];
  if (fa && L) {
    if (fr) {
      imgRows = [{ k: T.card.kind, v: T.kind[fr.kind] }];
      if (fr.resolutionM != null) imgRows.push({ k: T.card.resolution, v: T.card.meters(fr.resolutionM) });
      if (fr.source) imgRows.push({ k: T.card.source, v: fr.source });
      if (fr.quality) imgRows.push({ k: T.card.quality, v: fr.quality === "ok" ? T.card.qualityOk : T.card.qualityPartial });
      if (fr.bytes != null) imgRows.push({ k: T.card.size, v: F.bytes(fr.bytes) });
    } else imgRows = [{ k: T.card.image, v: T.map.gap(L.label) }];
  }
  const b = ds ? ds.area.bounds : null;
  const trades = ds
    ? ds.context.map((c, i) => ({
        trade: c.trade,
        on: i === S.trade,
        line: i === S.trade ? "var(--acc-fg)" : "var(--line2)",
        bg: i === S.trade ? "var(--sel)" : "transparent",
        go: () => m.set({ trade: i }),
      }))
    : [];
  const leg = L
    ? {
        grad: grad(L),
        min: F.value(L.range[0], L.unit, dec),
        max: F.value(L.range[1], L.unit, dec),
        label: L.label,
        unit: L.unit,
        note: L.note,
      }
    : { grad: "none", min: "", max: "", label: "", unit: "", note: "" };

  // linea de tiempo
  const isDark = theme === "dark";
  const nseg = ds ? ds.segments.length : 0;
  const totalPts = m.flat.length;
  const toneL = (i: number): number => {
    const k = nseg < 2 ? 0.5 : i / (nseg - 1);
    return isDark ? 0.42 + 0.4 * k : 0.62 - 0.3 * k;
  };
  const hatchG = "repeating-linear-gradient(135deg,var(--hatch) 0 2px,transparent 2px 5px)";
  const lineG = (c: string, w: number): string =>
    `linear-gradient(90deg,transparent calc(50% - ${w / 2}px),${c} calc(50% - ${w / 2}px) calc(50% + ${w / 2}px),transparent calc(50% + ${w / 2}px))`;
  const trackW = W - 2 * pad - 24;
  const zs = S.zoomSeg;
  const segs = !ds
    ? []
    : ds.segments.map((seg, si) => {
        const n = seg.ticks.length;
        const zoomed = zs === seg.id;
        const collapsed = !!zs && !zoomed;
        const Lt = toneL(si);
        const tone = `oklch(${Lt.toFixed(3)} 0.05 235)`;
        const toneA = `oklch(${Lt.toFixed(3)} 0.05 235 / 0.55)`;
        const px = zoomed ? n * (isM ? 30 : 34) : (n / Math.max(1, totalPts)) * trackW;
        const per = isM ? 3 : 6;
        const empty = seg.ticks.every((t) => Object.values(t.frames).every((f) => !f));
        const events = ds.events
          .map((ev) => {
            const j = seg.ticks.findIndex((t) => ev.date >= t.start && ev.date <= t.end);
            const t = seg.ticks[j];
            if (j < 0 || !t) return null;
            const a = +new Date(t.start);
            const z = +new Date(t.end);
            const fr0 = z > a ? (+new Date(ev.date) - a) / (z - a) : 0.5;
            const flip = (j + fr0) / n > 0.6;
            return {
              key: ev.id,
              dir: flip ? "row-reverse" : "row",
              tf: flip ? "translateX(calc(-100% + 4px))" : "translateX(-4px)",
              left: ((j + fr0) / n) * 100 + "%",
              label: ev.label,
              title: T.timeline.event(ev.label),
              showLabel: !isM && !collapsed && px >= 160,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);
        const ticks = seg.ticks.map((tk) => {
          const f0 = L ? tk.frames[L.id] : null;
          const gap = !!L && !f0;
          const isA = tk.id === sc.tickId;
          const isB = compareOn && sc.compare?.tickId === tk.id;
          const layersBg: string[] = [];
          if (seg.kind === "acquisition")
            layersBg.push(lineG(isA ? "var(--acc-ink)" : isB ? "var(--accB-ink)" : tone, isA || isB ? 3 : 2));
          if (gap) layersBg.push(hatchG);
          const base = isA ? "var(--acc)" : isB ? "var(--accB)" : seg.kind === "composite" ? toneA : "transparent";
          const any = Object.values(tk.frames).find(Boolean);
          const miss = layers.filter((l) => !tk.frames[l.id]).map((l) => l.label);
          const title = [
            T.tickName(seg.kind, tk.label),
            any && any.resolutionM != null ? T.card.meters(any.resolutionM) : "",
            any && any.source ? any.source : "",
            miss.length ? T.timeline.missing(miss.join(", ")) : "",
          ]
            .filter(Boolean)
            .join(" · ");
          const hot = isA || isB;
          return {
            key: tk.id,
            title,
            cur: isA,
            hot,
            h: hot ? 28 : 26,
            ring: hot ? `inset 0 0 0 2px ${isA ? "var(--acc-fg)" : "var(--accB)"}` : "none",
            bg: layersBg.length ? layersBg.join(",") + "," + base : base,
            go: () => m.tickClick(tk.id, seg.id),
            pips: collapsed
              ? []
              : layers.map((l) => {
                  const f = tk.frames[l.id];
                  return {
                    key: l.id,
                    bg: !f ? "transparent" : f.quality === "partial" ? `linear-gradient(90deg,${swatch(l)} 50%,transparent 50%)` : swatch(l),
                    sh: !f ? "inset 0 0 0 1px var(--line2)" : "none",
                    op: l.id === sc.layer ? 1 : 0.6,
                  };
                }),
          };
        });
        const gt = seg.kind === "acquisition" ? m.granText(seg) : T.gran[seg.granularity];
        return {
          id: seg.id,
          label: seg.label,
          tone,
          zoomed,
          events,
          ticks,
          empty,
          gap: collapsed ? "0" : "1px",
          mark: seg.kind === "composite" ? tone : "transparent",
          cal: seg.granularity === "year" ? "cal1" : seg.granularity === "quarter" || seg.granularity === "month" ? "cal2" : "cal3",
          title: `${seg.label} · ${gt} · ${T.timeline.points(n)}`,
          flex: zoomed ? `0 0 ${n * (isM ? 30 : 34)}px` : collapsed ? "0 0 20px" : `${Math.max(n, 2)} 1 0`,
          minW: (zoomed ? n * (isM ? 30 : 34) : collapsed ? 20 : Math.max(n * per, 24)) + "px",
          showLabel: !collapsed && (px >= 70 || zoomed),
          showMeta: !isM && !collapsed && px >= 230,
          meta: `${gt} · ${T.timeline.points(n)}`,
          head: () => m.segHead(seg.id),
        };
      });
  const firstSeg = ds ? ds.segments[0] : undefined;
  const lastSeg = ds ? ds.segments[nseg - 1] : undefined;
  const t0 = firstSeg ? +new Date(firstSeg.from) : 0;
  const t1 = lastSeg ? +new Date(lastSeg.to) : 1;
  const span = Math.max(1, t1 - t0);
  const midOf = (f: Flat): number => (+new Date(f.tick.start) + +new Date(f.tick.end)) / 2;
  const pctOf = (f: Flat | null): string =>
    f ? Math.max(0, Math.min(100, ((midOf(f) - t0) / span) * 100)) + "%" : "0%";
  const real = !ds
    ? []
    : ds.segments.map((seg, i) => ({
        id: seg.id,
        flex: Math.max(1, (+new Date(seg.to) - +new Date(seg.from)) / 864e5 + 1),
        tone: segs[i]?.tone ?? "var(--line2)",
      }));
  const evNow = fa && ds ? ds.events.find((ev) => ev.date >= fa.tick.start && ev.date <= fa.tick.end) : undefined;
  const anyFr = fa ? (fa.tick.frames[sc.layer] ?? Object.values(fa.tick.frames).find(Boolean)) : null;
  const meta = fa
    ? [
        fa.seg.label,
        m.granText(fa.seg),
        anyFr && anyFr.resolutionM != null ? T.card.meters(anyFr.resolutionM) : "",
        anyFr && anyFr.source ? anyFr.source : "",
        evNow ? T.timeline.event(evNow.label) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const tgtB = S.cmpTarget === "B";
  const selPips = fa
    ? layers.map((l) => {
        const f = fa.tick.frames[l.id];
        return {
          key: l.id,
          label: l.label,
          on: !!f,
          partial: f?.quality === "partial",
          swatch: swatch(l),
          active: l.id === sc.layer,
        };
      })
    : [];
  const tl = {
    ox: zs ? "auto" : "hidden",
    segs,
    real,
    name: fa ? nameOf(fa) : "",
    meta,
    y0: firstSeg ? F.year(firstSeg.from) : "",
    y1: lastSeg ? F.year(lastSeg.to) : "",
    aLeft: pctOf(fa),
    bLeft: pctOf(fb),
    max: Math.max(0, totalPts - 1),
    idx: Math.max(0, iA),
    noPlay: totalPts < 2,
    single: totalPts === 1,
    playLabel: S.playing ? T.timeline.pause : T.timeline.play,
    playBg: S.playing ? "var(--acc)" : "transparent",
    playFg: S.playing ? "var(--acc-ink)" : "var(--fg)",
    nameA: fa ? nameOf(fa) : "",
    nameB: fb ? nameOf(fb) : "",
    tA: !tgtB,
    tB: tgtB,
    tALine: !tgtB ? "var(--acc-fg)" : "var(--line2)",
    tBLine: tgtB ? "var(--accB)" : "var(--line2)",
  };

  // tarjeta de detalle
  const hp = pickHit;
  const pp = S.pickPos;
  const dc = {
    on: false,
    title: "",
    value: "",
    delta: "",
    hasDelta: false,
    layer: "",
    moment: "",
    left: "auto",
    right: "auto",
    top: "auto",
    bottom: "auto",
    w: "auto",
    spotSerOn: false,
    spotLineD: "",
    spotAx: 0,
    spotAy: 0,
    spotW: 168,
  };
  if (hp && cam === "detail" && pp) {
    dc.on = true;
    dc.title = hp.title;
    dc.value = hp.value;
    dc.delta = hp.delta ?? "";
    dc.hasDelta = !!hp.delta;
    dc.layer = L ? L.label : "";
    dc.moment = fa ? nameOf(fa) : "";
    const trail = S.spotTrail[JSON.stringify([hp.layer, hp.id])] ?? [];
    if (L && trail.length > 1) {
      const span = L.range[1] - L.range[0] || 1;
      const sw = dc.spotW;
      const sh = 40;
      const byTick = new Map(trail.map((p) => [p.tickId, p.v]));
      const pts: Array<{ i: number; v: number }> = [];
      m.flat.forEach((f, i) => {
        const v = byTick.get(f.tick.id);
        if (v != null) pts.push({ i, v });
      });
      if (pts.length > 1) {
        const xOf = (i: number): number =>
          m.flat.length < 2 ? sw / 2 : 2 + ((sw - 4) * i) / (m.flat.length - 1);
        const yOf = (v: number): number => sh - 4 - ((sh - 8) * (v - L.range[0])) / span;
        let previousIndex = -2;
        let lineD = "";
        for (const p of pts) {
          const x = xOf(p.i);
          const y = yOf(p.v);
          lineD += `${p.i === previousIndex + 1 ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
          previousIndex = p.i;
        }
        const cur = pts.find((p) => p.i === iA);
        dc.spotSerOn = true;
        dc.spotLineD = lineD;
        if (cur) {
          dc.spotAx = xOf(cur.i);
          dc.spotAy = yOf(cur.v);
        }
      }
    }
    if (isM) {
      dc.left = "8px";
      dc.right = "8px";
      dc.bottom = 52 + S.tlH + 20 + "px";
    } else {
      const w = 220;
      dc.w = w + "px";
      const edge = S.ficha ? 300 : 56;
      const lx = pp.x + 24 + w > W - edge ? pp.x - 24 - w : pp.x + 24;
      dc.left = Math.max(S.dockOpen ? 236 : 56, lx) + "px";
      dc.top = Math.max(64, Math.min(S.H - S.tlH - 200, pp.y - 70)) + "px";
    }
  }

  // rotulo
  const gapOn = hud && !!fa && !!L && !fa.tick.frames[L.id];
  const mapLabel =
    cam === "orbit"
      ? S.explore
        ? T.map.orbit
        : ""
      : cam === "approach"
        ? T.map.approach
        : cam === "detail" && hp
          ? T.map.detail(hp.title)
          : cam === "territory"
            ? viewScale === "urbano"
              ? T.map.territoryUrbano
              : T.map.territoryCampo
            : !ds
              ? T.map.loading
              : fa && L
                ? T.map.label(L.label, nameOf(fa))
                : "";
  const entryLines: string[] = [];
  // fuentes de datos (provenance del backend)
  const lookup = (table: object, key: string): string => (table as Record<string, string>)[key] ?? key;
  const provName = (id: string): string =>
    id.split("+").map((p) => lookup(T.sources.provider, p)).join(" + ");
  const sourceUnused = (g: { selected: string[]; count: number; status: string }): boolean =>
    g.status === "ok" && (g.selected ?? []).length === 0 && g.count === 0;
  const sources = (ds?.sources ?? []).map((g) => {
    const unused = sourceUnused(g);
    return {
      key: g.kind,
      label: lookup(T.sources.kind, g.kind),
      statusText: unused ? T.sources.status.unused : lookup(T.sources.status, g.status),
      statusColor: unused
        ? "var(--warn)"
        : g.status === "ok"
          ? "var(--ok)"
          : g.status === "cache"
            ? "var(--acc-fg)"
            : "var(--warn)",
      strategy: lookup(T.sources.strategy, g.strategy),
      selected: (g.selected ?? []).map(provName),
      selectedNotes: (g.selected ?? []).flatMap((id) => id.split("+").flatMap((part) => {
        const description = sourceNote(part);
        return description ? [{ key: part, name: provName(part), description }] : [];
      })),
      tried: (g.tried ?? []).map((x) => ({
        key: x.provider,
        name: provName(x.provider),
        ok: x.ok,
        note: !x.ok ? T.sources.failed : x.count == null ? "Cantidad no informada" : x.count === 0 ? "Sin registros" : T.sources.records(x.count),
        hint: sourceNote(x.provider) ?? "",
      })),
      count: g.count == null ? "Cantidad no informada" : g.count === 0 ? "Sin registros" : T.sources.records(g.count),
      fromCache: g.fromCache,
    };
  });
  const sourcesAt =
    ds?.sourcesAt && !Number.isNaN(+new Date(ds.sourcesAt))
      ? T.sources.updated(
          new Date(ds.sourcesAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }),
        )
      : "";
  const tilt = st.terrain ? sc.tilt : 0;
  const online = st.online;
  const mock = !!(ds && ds.isMock);
  const curSegEmpty = fa ? !!segs.find((sg) => sg.id === fa.seg.id)?.empty : false;
  const guest = S.userName || T.intro.guest;
  let moniTip = "";
  if (S.introDone && !S.introOpen) {
    if (!ds && !err) moniTip = T.moni.loading;
    else if (cam === "orbit" && !S.explore) moniTip = T.moni.welcome(guest);
    else if (gapOn) moniTip = T.moni.gap;
    else if (noSeries && hud) moniTip = T.moni.noSeries;
    else if (curSegEmpty && hud) moniTip = T.moni.emptySeg;
    else if (S.tab === "sources" && sources.length === 0 && hud) moniTip = T.moni.noSources;
    else if (hud) moniTip = T.moni.territory;
  }

  return {
    theme, t: T, lay, isM, isD: !isM,
    hasDs, noDs: !hasDs && !err, areaName: ds ? ds.area.name : "", mock,
    brandOn: (!isM || !S.searchOpen) && !imm,
    brandMark: "./brand/icon-32.png",
    showName: false,
    layerHint: activeLayer?.note ?? "",
    searchField, searchBtn: isM && !S.searchOpen && !imm, searchClose: isM && S.searchOpen && !imm,
    immersive: imm, dockOpen: S.dockOpen, tlOpen: S.tlOpen, hudToggleOn: hud,
    hudToggleLabel: imm ? T.hud.show : T.hud.hide,
    dockToggleLabel: S.dockOpen ? T.hud.dockClose : T.hud.dockOpen,
    tlToggleLabel: S.tlOpen ? T.hud.tlClose : T.hud.tlOpen,
    q: S.q, results, showResults, noResults: S.searched && S.results.length === 0,
    noResultsText: T.search.none(S.q.trim()),
    statusColor: online ? "var(--ok)" : "var(--warn)",
    statusText: online ? T.status.online : T.status.offline,
    statusDetail: online ? T.status.online : T.status.offlineDetail,
    showStatusText: !isM, noTerrain: !st.terrain,
    sceneSoft: S.introOpen,
    introOpen: S.introOpen,
    moniB: S.tlH + (isM ? 52 : 0) + 20 + "px",
    moniOn: S.introDone && !S.introOpen && !imm,
    moniTip: S.helpText || moniTip,
    moniOpen: S.moniOpen,
    soundOn: S.soundOn,
    userName: S.userName,
    showEntry: cam === "orbit" && !S.explore && !err && S.introDone,
    showExplore: cam === "orbit" && S.explore && !err,
    showErr: cam === "orbit" && !!err,
    errCode: (err && err.code) || "", entryLines,
    dockOn: chrome && !isM, chipsOn: chrome && isM, layerItems,
    overlayItems: sortedLayers
      .filter((l) => l.id !== sc.layer)
      .map((l) => ({
        id: l.id,
        label: l.label,
        core: !!l.core,
        on: !!l.core || S.extras.includes(l.id),
        go: () => (l.core ? undefined : m.toggleExtra(l.id)),
      })),
    basemapItems: m.basemaps.length > 1 ? m.basemaps.map((x) => ({ id: x.id, label: x.label, on: x.id === S.basemap, go: () => m.setBasemap(x.id) })) : [],
    camOn: hud, northOn: !sc.northUp,
    northLabel: sc.northUp ? T.camera.northUp : T.camera.northFree,
    northDeg: sc.northUp ? 0 : -18,
    tiltText: T.camera.deg(Math.round(tilt)), tiltOff: !st.terrain,
    tiltTitle: st.terrain ? T.camera.tilt : T.camera.tiltOff,
    mapLabel, labelDisplay: mapLabel ? "block" : "none",
    compareOn, compareBanner: compareOn && fa && fb ? T.compare.banner(nameOf(fb), nameOf(fa)) : "",
    mixed: compareOn && !!fa && !!fb && fa.seg.kind !== fb.seg.kind,
    gapOn, gapText: L ? T.map.gap(L.label) : "", offlineNote: hud && !online && !isM,
    cardOn: chrome, mClosed: isM && !S.sheet, mOpenOrDesk: !isM || S.sheet, cardOpen,
    legendOn: chrome && !!L && (isM ? S.sheet : cardOpen),
    noSeries,
    isTabArea: S.tab === "area", isTabRead: S.tab === "read", isTabSources: S.tab === "sources",
    tabSourcesLine: S.tab === "sources" ? "var(--acc-fg)" : "transparent",
    sources,
    sourcesAt,
    sourcesAviso: mock ? layersAviso() ?? "" : "",
    noSources: sources.length === 0,
    tabAreaLine: S.tab === "area" ? "var(--acc-fg)" : "transparent",
    tabReadLine: S.tab === "read" ? "var(--acc-fg)" : "transparent",
    cardToggleText: cardOpen ? T.card.close : T.card.open,
    cardToggleGlyph: cardOpen ? (isM ? "↓" : "–") : "+",
    boundsText: b ? `${F.lat(b.south)} a ${F.lat(b.north)} · ${F.lon(b.west)} a ${F.lon(b.east)}` : "",
    layerName: L ? L.label : "", momentName: fa ? nameOf(fa) : "",
    valueText,
    areaValueLabel,
    areaValueHint,
    areaShowDelta,
    deltaText,
    ser,
    imgRows,
    trades,
    tradeText: ds && ds.context[S.trade] ? ds.context[S.trade]?.text ?? "" : "",
    sample: mock && !!(ds && ds.context.length),
    noTrades: !!ds && ds.context.length === 0, leg,
    dc, toast: S.toast,
    showKey: W >= 1240, tlOn: chrome, tlLoading: !ds && !err, tlReady: !!ds, tl, selPips,
    compareHint: compareOn ? T.timeline.compareActive : T.timeline.compareIdle,
    playing: S.playing,
    scopeAll: S.scope === "all", scopeSeg: S.scope === "seg",
    scopeAllBg: S.scope === "all" ? "var(--sel)" : "transparent",
    scopeSegBg: S.scope === "seg" ? "var(--sel)" : "transparent",
    zoomed: !!zs,
    cmpLine: compareOn ? "var(--acc-fg)" : "var(--line2)",
    cmpBg: compareOn ? "var(--sel)" : "transparent",
    cmpText: compareOn ? T.timeline.compareOff : T.timeline.compare,
    help: S.help, helpKeys: (T.help.keys as string[][]).map(([k, d]) => ({ k: k ?? "", d: d ?? "" })),
    tiltValue: sc.tilt, northUp: sc.northUp, terrain: st.terrain,
    exploreOn: hud,
    viewCampo: viewScale === "campo",
    viewUrbano: viewScale === "urbano",
    hotspotCount: S.hotspots.length,
    exploreHasHotspots: S.hotspots.length > 0,
    exploreHasSer: !!L && !!sp && !noSeries,
    exploreValue: valueText,
    exploreDelta: deltaText,
    explorePeekOn: hud && !!valueText && !noSeries,
  };
}

export type View = ReturnType<typeof buildView>;
