import React from "react";
import type { App } from "../../app/App";
import { fmtOf, type Copy, type Lang } from "../../app/i18n";
import type { View } from "../../app/view";
import { isExampleHonesty, isPlaceholderRange } from "../../data/radar-scale";
import type { LayerDef } from "../../tw/contract";
import { BUNDLED_META, layerCopy, type LayerCopy, type MetaRow } from "./layer-copy";

export type Tier = "raw" | "processed" | "prediction";
export const TIERS: Tier[] = ["raw", "processed", "prediction"];

export type Honesty = "measured" | "derived" | "model" | "inferred" | "example";
export type RowTone = "" | "busy" | "warn" | "muted";

// Tier of layers that config/layers.toml does not name.
const TIER_FALLBACK: Record<string, Tier> = {
  radar: "raw",
  incendios: "raw",
  firms: "raw",
  clouds: "raw",
  wind: "raw",
  satellites: "raw",
  optico: "raw",
  "nisar-passes": "raw",
  suelo: "processed",
  contaminacion: "processed",
};

const CATEGORY_TIER: Record<string, Tier> = { data: "raw", inference: "processed", prediction: "prediction" };

const NISAR_LAUNCH = Date.UTC(2025, 7, 1);

export type LayerRowModel = {
  key: string;
  id: string;
  tier: Tier;
  label: string;
  swatch: string;
  on: boolean;
  // the toggle is absent on rows that only report a status
  toggle: (() => void) | null;
  toggleText: string;
  toggleTitle: string;
  locked: string;
  statusOnly: boolean;
  read: (() => void) | null;
  reading: boolean;
  count: string;
  status: string;
  tone: RowTone;
  honesty: Honesty;
  honestyLabel: string;
  confidence: number | null;
  detail: {
    what: string;
    decision: string;
    nodata: string;
    caveats: string;
    product: string;
    unit: string;
    range: string;
    rampNote: string;
    formula: string;
    date: string;
    note: string;
    grad: string;
    min: string;
    max: string;
    relative: boolean;
    list: Array<{ id: string; line: string }>;
    listNote: string;
  };
};

export type TierModel = { tier: Tier; rows: LayerRowModel[]; active: number; total: number };

type Taxonomy = { layers_taxonomy?: { layers?: MetaRow[] } };

let remote: Promise<Record<string, MetaRow>> | null = null;

function loadRemote(): Promise<Record<string, MetaRow>> {
  remote ??= fetch("./app-config.json")
    .then((r) => (r.ok ? (r.json() as Promise<Taxonomy>) : {}))
    .then((cfg: Taxonomy) => Object.fromEntries((cfg.layers_taxonomy?.layers ?? []).filter((r) => r.id).map((r) => [String(r.id), r])))
    .catch(() => ({}));
  return remote;
}

// Bilingual layer fields published in app-config; empty until the request settles.
export function useRemoteMeta(): Record<string, MetaRow> {
  const [meta, setMeta] = React.useState<Record<string, MetaRow>>({});
  React.useEffect(() => {
    let live = true;
    void loadRemote().then((m) => {
      if (live) setMeta(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return meta;
}

function normHonesty(value: unknown): Honesty | null {
  const h = String(value ?? "").toLowerCase();
  if (h === "example" || h === "ejemplo" || h === "demo") return "example";
  if (h === "derived" || h === "derivado") return "derived";
  if (h === "model" || h === "modelo") return "model";
  if (h === "inferred" || h === "inferido") return "inferred";
  if (h === "measured" || h === "medido") return "measured";
  return null;
}

function firmsReason(code: string, T: Copy): string {
  if (code === "firmsDisabled") return T.state.firmsDisabled;
  if (code === "firmsDenied") return T.state.firmsDenied;
  if (code === "firmsFailed") return T.state.firmsFailed;
  return T.state.unavailable;
}

function tierOf(id: string, meta: MetaRow, category?: string): Tier {
  const t = meta.tier;
  if (t === "raw" || t === "processed" || t === "prediction") return t;
  return TIER_FALLBACK[id] ?? CATEGORY_TIER[category ?? ""] ?? "raw";
}

function confidenceOf(meta: MetaRow): number | null {
  if (meta.confidence == null || meta.confidence === "") return null;
  const n = Number(meta.confidence);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

export function buildTiers(v: View, a: App, remoteMeta: Record<string, MetaRow>): TierModel[] {
  const S = a.state;
  const lang: Lang = S.lang;
  const C: LayerCopy = layerCopy(lang);
  const T = v.t;
  const F = fmtOf(lang);
  const ds = S.ds;
  const sc = S.scene;
  const hasPlace = !!S.activePlace;
  const metaOf = (id: string): MetaRow => ({ ...(BUNDLED_META[id] ?? {}), ...(remoteMeta[id] ?? {}) });
  const pick = (meta: MetaRow, key: string): string => meta[`${key}_${lang}`] ?? "";
  const tick = ds?.segments.flatMap((sg) => sg.ticks).find((tk) => tk.id === sc.tickId) ?? null;
  const beforeNisar = !!tick && +new Date(tick.end) < NISAR_LAUNCH;
  const defs: Record<string, LayerDef> = Object.fromEntries((ds?.layers ?? []).map((l) => [l.id, l]));

  const rows: LayerRowModel[] = [];

  for (const item of v.layerItems) {
    const def = defs[item.id];
    if (!def) continue;
    const meta = metaOf(item.id);
    const label = pick(meta, "label") || item.label;
    const frame = tick ? tick.frames[item.id] ?? null : null;
    const frameMeta = (frame ?? {}) as Record<string, unknown>;
    const honesty = normHonesty(frameMeta.honesty) ?? item.honesty;
    const frameNote = typeof frameMeta[`note_${lang}`] === "string" ? (frameMeta[`note_${lang}`] as string) : "";
    const on = item.on || item.core || S.extras.includes(item.id);
    const locked = !hasPlace ? C.needPlace : item.core ? C.lockedCore : item.on ? C.lockedReading : "";
    const relative = honesty === "example" || isExampleHonesty(def.honesty) || isPlaceholderRange(def.range);
    const dec = def.decimals ?? 0;
    rows.push({
      key: item.id,
      id: item.id,
      tier: tierOf(item.id, meta, def.category),
      label,
      swatch: item.grad,
      on,
      toggle: item.core || item.on ? null : () => a.toggleExtra(item.id),
      toggleText: item.core ? C.core : on ? C.on : C.off,
      toggleTitle: locked || (on ? C.turnOff(label) : C.turnOn(label)),
      locked,
      statusOnly: false,
      read: item.on ? null : () => a.setLayer(item.id),
      reading: item.on,
      count: "",
      status: item.gap && on ? C.gap : "",
      tone: item.gap && on ? "muted" : "",
      honesty,
      honestyLabel: T.honesty[honesty],
      confidence: confidenceOf(meta),
      detail: {
        what: pick(meta, "what") || def.note,
        decision: pick(meta, "decision"),
        nodata: pick(meta, "nodata"),
        caveats: pick(meta, "caveats"),
        product: meta.product ?? frame?.source ?? "",
        unit: relative ? C.noUnit : meta.unit || def.unit,
        range: relative ? "" : meta.range ?? "",
        rampNote: relative ? C.relative : meta.ramp ?? "",
        formula: meta.formula ?? "",
        date: frame ? v.momentName : "",
        note: frameNote || (beforeNisar && item.core && frame ? C.preNisar : ""),
        grad: item.grad,
        min: relative ? C.low : F.value(def.range[0], def.unit, dec) ?? "",
        max: relative ? C.high : F.value(def.range[1], def.unit, dec) ?? "",
        relative,
        list: [],
        listNote: "",
      },
    });
  }

  // NISAR coverage: a status row, there is nothing to switch
  const nz = S.nisar;
  const passMeta = metaOf("nisar-passes");
  rows.push({
    key: "nisar-passes",
    id: "nisar-passes",
    tier: tierOf("nisar-passes", passMeta),
    label: C.passes,
    swatch: "var(--tw-radar)",
    on: nz.status === "ok",
    toggle: null,
    toggleText:
      nz.status === "loading" ? C.loading : nz.status === "error" ? C.error : nz.status === "empty" ? C.empty : nz.status === "ok" ? String(nz.count) : C.info,
    toggleTitle: "",
    locked: "",
    statusOnly: true,
    read: null,
    reading: false,
    count: "",
    status:
      nz.status === "loading" ? T.nisar.loading
      : nz.status === "empty" ? T.nisar.empty
      : nz.status === "ok" ? T.nisar.count(nz.count)
      : nz.status === "error" ? nz.msg || T.state.unavailable
      : C.passesIdle,
    tone: nz.status === "loading" ? "busy" : nz.status === "error" ? "warn" : nz.status === "ok" ? "" : "muted",
    honesty: "measured",
    honestyLabel: T.honesty.measured,
    confidence: null,
    detail: {
      what: pick(passMeta, "what"),
      decision: pick(passMeta, "decision"),
      nodata: pick(passMeta, "nodata"),
      caveats: pick(passMeta, "caveats"),
      product: passMeta.product ?? "",
      unit: "",
      range: "",
      rampNote: "",
      formula: "",
      date: "",
      note: "",
      grad: "",
      min: "",
      max: "",
      relative: false,
      list: v.passRows,
      listNote: v.passesPending ? T.nisar.pending : "",
    },
  });

  const fm = S.firms;
  const cl = S.clouds;
  const globals: Array<{ id: string; label: string; note: string; swatch: string; count: string; status: string; tone: RowTone; date: string }> = [
    {
      id: "firms",
      label: T.globals.firms,
      note: T.globals.firmsNote,
      swatch: "linear-gradient(90deg,#5e2617,#d0521f,#ffd36b)",
      count: fm.status === "ok" ? String(fm.count) : "",
      status:
        fm.status === "loading" ? T.state.loading
        : fm.status === "empty" ? T.state.firmsEmpty
        : fm.status === "ok" ? T.state.firmsCount(fm.count)
        : fm.status === "error" ? firmsReason(fm.msg, T)
        : "",
      tone: fm.status === "loading" ? "busy" : fm.status === "error" ? "warn" : fm.status === "empty" ? "muted" : "",
      date: C.last24,
    },
    {
      id: "clouds",
      label: T.globals.clouds,
      note: T.globals.cloudsNote,
      swatch: "linear-gradient(90deg,#3d4e6e,#f4f1e8)",
      count: "",
      status: cl.status === "loading" ? T.state.loading : cl.status === "unavailable" ? cl.msg || T.state.unavailable : "",
      tone: cl.status === "loading" ? "busy" : cl.status === "unavailable" ? "warn" : "",
      date: C.latest,
    },
    {
      id: "wind",
      label: T.globals.wind,
      note: T.globals.windNote,
      swatch: "repeating-linear-gradient(135deg,var(--tw-radar) 0 2px,transparent 2px 5px)",
      count: "",
      status: "",
      tone: "",
      date: C.latest,
    },
  ];
  for (const g of globals) {
    const meta = metaOf(g.id);
    const on = S.extras.includes(g.id);
    const honesty = normHonesty(meta.honesty) ?? "measured";
    const label = pick(meta, "label") || g.label;
    const tone: RowTone = on ? g.tone : "";
    rows.push({
      key: `g-${g.id}`,
      id: g.id,
      tier: tierOf(g.id, meta),
      label,
      swatch: g.swatch,
      on,
      toggle: () => a.toggleExtra(g.id),
      toggleText: !on ? C.off : tone === "busy" ? C.loading : tone === "warn" ? C.error : C.on,
      toggleTitle: on ? C.turnOff(label) : C.turnOn(label),
      locked: "",
      statusOnly: false,
      read: null,
      reading: false,
      count: on ? g.count : "",
      status: on ? g.status : "",
      tone,
      honesty,
      honestyLabel: T.honesty[honesty],
      confidence: confidenceOf(meta),
      detail: {
        what: pick(meta, "what") || g.note,
        decision: pick(meta, "decision"),
        nodata: pick(meta, "nodata"),
        caveats: pick(meta, "caveats"),
        product: meta.product ?? "",
        unit: meta.unit ?? "",
        range: meta.range ?? "",
        rampNote: meta.ramp ?? "",
        formula: meta.formula ?? "",
        date: g.date,
        note: "",
        grad: "",
        min: "",
        max: "",
        relative: false,
        list: [],
        listNote: "",
      },
    });
  }

  return TIERS.map((tier) => {
    const own = rows.filter((r) => r.tier === tier);
    const switchable = own.filter((r) => !r.statusOnly);
    return { tier, rows: own, active: switchable.filter((r) => r.on).length, total: switchable.length };
  });
}
