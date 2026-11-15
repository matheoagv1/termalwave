import type { GeocodeAnswer, Geocoder } from "../types";
import { fetchJson, placeLabel, sortByAoiBias, toPlaceResult } from "../util";

type OpenMeteoRow = {
  name?: string;
  latitude?: number;
  longitude?: number;
  admin1?: string;
  country?: string;
};

type OpenMeteoPayload = { results?: OpenMeteoRow[] };

export const openMeteoGeocoder: Geocoder = {
  id: "open_meteo_geocode",
  async search(q, ctx): Promise<GeocodeAnswer> {
    const text = q.trim();
    if (!text) return { results: [], answered: false };
    const base =
      ctx.config.endpoints.open_meteo_geocode ??
      "https://geocoding-api.open-meteo.com/v1/search";
    const url = new URL(base);
    url.searchParams.set("name", text);
    url.searchParams.set("count", String(ctx.config.limit));
    url.searchParams.set("language", "es");
    const payload = await fetchJson<OpenMeteoPayload>(url.toString());
    const rows = payload?.results ?? [];
    const results = rows
      .map((row) => {
        const lat = row.latitude;
        const lon = row.longitude;
        if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const label = placeLabel([row.name, row.admin1, row.country]);
        return toPlaceResult(label || text, lon, lat);
      })
      .filter((r): r is NonNullable<typeof r> => !!r);
    const biased = sortByAoiBias(results, ctx.area).slice(0, ctx.config.limit);
    return { results: biased, answered: biased.length > 0 };
  },
};