import type { GeocodeAnswer, Geocoder } from "../types";
import { fetchJson, sortByAoiBias, toPlaceResult } from "../util";

type NominatimRow = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

export const nominatimGeocoder: Geocoder = {
  id: "nominatim",
  async search(q, ctx): Promise<GeocodeAnswer> {
    const text = q.trim();
    if (!text) return { results: [], answered: false };
    const base = ctx.config.endpoints.nominatim ?? "https://nominatim.openstreetmap.org/search";
    const url = new URL(base);
    url.searchParams.set("q", text);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", String(ctx.config.limit));
    const b = ctx.area.bounds;
    url.searchParams.set("viewbox", `${b.west},${b.north},${b.east},${b.south}`);
    url.searchParams.set("bounded", "0");
    const payload = await fetchJson<NominatimRow[]>(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": ctx.config.userAgent },
    });
    if (!payload) return { results: [], answered: false };
    const results = payload
      .map((row) => {
        const lat = row.lat != null ? parseFloat(row.lat) : NaN;
        const lon = row.lon != null ? parseFloat(row.lon) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const label = (row.display_name ?? text).split(",").slice(0, 3).join(",").trim();
        return toPlaceResult(label, lon, lat);
      })
      .filter((r): r is NonNullable<typeof r> => !!r);
    const biased = sortByAoiBias(results, ctx.area).slice(0, ctx.config.limit);
    return { results: biased, answered: biased.length > 0 };
  },
};