import type { Area, SearchResult } from "../../tw/contract";

export function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function sortByAoiBias(results: SearchResult[], area: Area): SearchResult[] {
  const [clon, clat] = area.center;
  return [...results].sort(
    (a, b) => haversineM(a.lonlat[0], a.lonlat[1], clon, clat) - haversineM(b.lonlat[0], b.lonlat[1], clon, clat),
  );
}

export function placeLabel(parts: Array<string | undefined>): string {
  return parts.filter((p) => p && p.trim()).join(", ");
}

export function toPlaceResult(label: string, lon: number, lat: number): SearchResult {
  return { kind: "coords", label, lonlat: [lon, lat] };
}

export function matchCoords(text: string): SearchResult | null {
  const m = text.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat((m[1] ?? "").replace(",", "."));
  const lon = parseFloat((m[2] ?? "").replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { kind: "coords", label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lonlat: [lon, lat] };
}

export function matchAoiPreset(text: string, area: Area): SearchResult | null {
  if (norm(area.name).includes(norm(text)) || norm(text).includes(norm(area.name))) {
    return { kind: "area", label: area.name, lonlat: area.center };
  }
  return null;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}