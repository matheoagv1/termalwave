import React from "react";
import { bundledEntries, mergeRows, type CatalogEntry } from "./entries";

export type CatalogState = "idle" | "loading" | "ok" | "empty" | "error";
// reason is a code; the panel words it in the user's language
export type CatalogReason = "" | "network" | "http" | "format" | "zoom";
export type CatalogStatus = {
  state: CatalogState;
  reason: CatalogReason;
  http?: number;
  count: number;
  // average of confidence_prop over the features in view
  confidence: number | null;
  date: string;
};

const PREFS = "tw.catalog.on";
const IDLE: CatalogStatus = { state: "idle", reason: "", count: 0, confidence: null, date: "" };

let entries: CatalogEntry[] = bundledEntries();
let on = new Set<string>(readPrefs());
let timelineDate: string | null = null;
// date picked on an acquisition tick; daily layers follow it, null means their default lag
let dailyDate: string | null = null;
const status = new Map<string, CatalogStatus>();
const subs = new Set<() => void>();
let version = 0;
let remoteAsked = false;

function readPrefs(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function emit(): void {
  version++;
  subs.forEach((f) => f());
}

// app-config carries the catalog the pipeline last wrote; its rows win, bundled rows fill the rest
function askRemote(): void {
  if (remoteAsked || typeof fetch !== "function") return;
  remoteAsked = true;
  void fetch("./app-config.json")
    .then((r) => (r.ok ? (r.json() as Promise<{ catalog?: unknown }>) : null))
    .then((cfg) => {
      const rows = Array.isArray(cfg?.catalog) ? (cfg.catalog as Array<Record<string, unknown>>) : [];
      if (!rows.length) return;
      const bundled = entries as unknown as Array<Record<string, unknown>>;
      entries = mergeRows([["app-config", rows], ["bundle", bundled]]);
      emit();
    })
    .catch(() => {});
}

export const catalog = {
  entries(): CatalogEntry[] {
    askRemote();
    return entries;
  },
  isOn(id: string): boolean {
    return on.has(id);
  },
  onIds(): string[] {
    return entries.filter((e) => on.has(e.id)).map((e) => e.id);
  },
  toggle(id: string): void {
    catalog.set(id, !on.has(id));
  },
  // presets and deep links switch layers through this
  set(id: string, want: boolean): void {
    if (on.has(id) === want) return;
    const next = new Set(on);
    if (want) next.add(id);
    else next.delete(id);
    on = next;
    if (!want) status.delete(id);
    try {
      localStorage.setItem(PREFS, JSON.stringify([...on]));
    } catch {
      /* private mode: the choice lasts for this visit */
    }
    emit();
  },
  status(id: string): CatalogStatus {
    return status.get(id) ?? IDLE;
  },
  setStatus(id: string, s: Partial<CatalogStatus>): void {
    const cur = status.get(id) ?? IDLE;
    const next = { ...cur, ...s };
    if (JSON.stringify(next) === JSON.stringify(cur)) return;
    status.set(id, next);
    emit();
  },
  timelineDate(): string | null {
    return timelineDate;
  },
  dailyDate(): string | null {
    return dailyDate;
  },
  setDailyDate(d: string | null): void {
    if (d === dailyDate) return;
    dailyDate = d;
    emit();
  },
  setTimelineDate(d: string | null): void {
    if (d === timelineDate) return;
    timelineDate = d;
    emit();
  },
  subscribe(f: () => void): () => void {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

// re-renders the caller when any catalog toggle or status changes
export function useCatalogVersion(): number {
  return React.useSyncExternalStore(catalog.subscribe, () => version);
}

// App calls this with the timeline's selected tick; only "timeline" entries read it
export function syncCatalogTimeline(ds: { segments: Array<{ ticks: Array<{ id: string; start: string }> }> } | null, tickId: string): void {
  const tick = ds?.segments.flatMap((s) => s.ticks).find((t) => t.id === tickId);
  catalog.setTimelineDate(tick ? tick.start.slice(0, 10) : null);
  catalog.setDailyDate(tick && tickId.startsWith("a-") ? tick.start.slice(0, 10) : null);
}
