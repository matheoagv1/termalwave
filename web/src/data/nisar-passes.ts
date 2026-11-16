export type NisarPass = {
  id: string;
  date: string;
  track: string;
  direction: string;
  frame: string;
  pol: string;
  maturity: string;
  footprint?: PassFootprint;
};

export type PassFootprint =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

function footprintOf(v: unknown): PassFootprint | undefined {
  if (!v || typeof v !== "object") return undefined;
  const g = v as { type?: unknown; coordinates?: unknown };
  if ((g.type !== "Polygon" && g.type !== "MultiPolygon") || !Array.isArray(g.coordinates) || !g.coordinates.length) return undefined;
  return g as PassFootprint;
}

function str(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" ? v.trim() : "";
}

function bag(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== "object") return {};
  const o = row as Record<string, unknown>;
  const props = o.properties && typeof o.properties === "object" ? (o.properties as Record<string, unknown>) : {};
  return { ...props, ...o };
}

function listOf(raw: Record<string, unknown>): unknown[] {
  for (const key of ["frames", "scenes", "features", "items", "passes", "granules"]) {
    if (Array.isArray(raw[key])) return raw[key] as unknown[];
  }
  return [];
}

export function parsePasses(raw: Record<string, unknown>): NisarPass[] {
  return listOf(raw).map((row, i) => {
    const o = bag(row);
    const date = str(o.startTime ?? o.start_time ?? o.date ?? o.datetime ?? o.time ?? o.acquisitionDate);
    const direction = str(o.direction ?? o.flightDirection ?? o.flight_direction ?? o.orbitDirection).toUpperCase();
    const maturityRaw = str(o.maturity ?? o.status ?? o.processingLevel ?? o.processing_level).toLowerCase();
    const maturity = maturityRaw.includes("valid") ? "validated" : maturityRaw.includes("prov") ? "provisional" : maturityRaw;
    return {
      id: str(o.id ?? o.sceneId ?? o.granule) || `pass-${i}`,
      date,
      track: str(o.track ?? o.path ?? o.relativeOrbit ?? o.relative_orbit),
      direction: direction.startsWith("A") ? "ascending" : direction.startsWith("D") ? "descending" : direction.toLowerCase(),
      frame: str(o.frame ?? o.frameNumber ?? o.frame_number),
      pol: str(o.pol ?? o.polarization ?? o.polarizations),
      maturity,
      footprint: footprintOf(o.footprint ?? o.geometry),
    };
  });
}

export type FootprintCollection = {
  type: "FeatureCollection";
  features: Array<{ type: "Feature"; geometry: PassFootprint; properties: Record<string, string> }>;
};

// one outline per track and frame: repeat dates share the same ground, and
// stacking them would only thicken the line
export function passFootprints(passes: NisarPass[]): FootprintCollection | null {
  const seen = new Set<string>();
  const features: FootprintCollection["features"] = [];
  for (const p of passes) {
    if (!p.footprint) continue;
    const key = p.track || p.frame ? `${p.track}/${p.frame}` : JSON.stringify(p.footprint.coordinates);
    if (seen.has(key)) continue;
    seen.add(key);
    features.push({
      type: "Feature",
      geometry: p.footprint,
      properties: { track: p.track, frame: p.frame, direction: p.direction, date: p.date, maturity: p.maturity, pol: p.pol },
    });
  }
  return features.length ? { type: "FeatureCollection", features } : null;
}
