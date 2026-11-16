export type NisarPass = {
  id: string;
  date: string;
  track: string;
  direction: string;
  frame: string;
  pol: string;
  maturity: string;
};

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
    };
  });
}
