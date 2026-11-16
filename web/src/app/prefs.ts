// Browser choices. A bad payload is ignored so the app still boots.

const KEY = "tw.prefs.v1";

export type Prefs = {
  v: 1;
  extras?: string[];
  catalog?: string[];
  basemap?: string;
};

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((x): x is string => typeof x === "string");
}

export function readPrefs(): Prefs | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    if (row.v !== 1) return null;
    const extras = strings(row.extras);
    const catalog = strings(row.catalog);
    const basemap = typeof row.basemap === "string" ? row.basemap : undefined;
    return {
      v: 1,
      ...(extras ? { extras } : {}),
      ...(catalog ? { catalog } : {}),
      ...(basemap ? { basemap } : {}),
    };
  } catch {
    return null;
  }
}

export function writePrefs(patch: Partial<Omit<Prefs, "v">>): void {
  try {
    const cur = readPrefs();
    const next: Prefs = { v: 1, ...cur, ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode: the choice lasts for this visit
  }
}

export function savedExtras(): string[] | null {
  const extras = readPrefs()?.extras;
  return extras ?? null;
}
