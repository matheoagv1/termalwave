import type { LayerDef } from "../tw/contract";

// HV is the cross-pol window used when a radar layer has no polarization yet.
export const RADAR_HV: [number, number] = [-30, -5];
export const RADAR_HH: [number, number] = [-25, 0];

export type RadarRanges = { hv?: [number, number]; hh?: [number, number] };

export function isRadarLayer(id: string): boolean {
  const s = id.toLowerCase();
  return s === "radar" || s.startsWith("nisar") || s.includes("gcov") || s.includes("backscatter");
}

export function radarPol(id: string, label: string, explicit?: string): "HH" | "HV" {
  const named = (explicit ?? "").toUpperCase();
  if (named === "HH" || named === "HV") return named;
  const s = `${id} ${label}`.toUpperCase();
  const hh = /\bHH\b|DHDH/.test(s);
  const hv = /\bHV\b|HVHV/.test(s);
  if (hh && !hv) return "HH";
  return "HV";
}

export function isExampleHonesty(value: unknown): boolean {
  const s = String(value ?? "").toLowerCase();
  return s === "example" || s === "ejemplo" || s === "demo";
}

// a 0..1 ramp labeled dB is the bug this scale exists to stop
export function isPlaceholderRange(range: [number, number]): boolean {
  return range[0] >= 0 && range[1] <= 1 && range[1] > range[0];
}

function pair(value: [number, number] | undefined): [number, number] | null {
  if (!value || value.length < 2) return null;
  const a = Number(value[0]);
  const b = Number(value[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !(a < b)) return null;
  return [a, b];
}

function physicalRange(pol: "HH" | "HV", cfg: RadarRanges | undefined, layer: [number, number]): [number, number] {
  const fromCfg = pol === "HH" ? pair(cfg?.hh) : pair(cfg?.hv);
  if (fromCfg) return fromCfg;
  if (!isPlaceholderRange(layer)) return layer;
  switch (pol) {
    case "HH":
      return RADAR_HH;
    case "HV":
      return RADAR_HV;
    default: {
      const neverPol: never = pol;
      return neverPol;
    }
  }
}

export function applyRadarScale(layer: LayerDef, cfg?: RadarRanges): LayerDef {
  if (!isRadarLayer(layer.id)) return layer;
  if (isExampleHonesty(layer.honesty)) {
    return { ...layer, honesty: "example", unit: "" };
  }
  const pol = radarPol(layer.id, layer.label, layer.pol);
  return {
    ...layer,
    pol,
    unit: "dB",
    range: physicalRange(pol, cfg, layer.range),
    decimals: layer.decimals ?? 1,
  };
}

export function applyRadarScales(layers: LayerDef[], cfg?: RadarRanges): LayerDef[] {
  return layers.map((layer) => applyRadarScale(layer, cfg));
}
