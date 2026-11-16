import type { GeocodeAnswer, Geocoder } from "../types";
import { fetchJson, toPlaceResult } from "../util";

type GoogleGeocodeRow = {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
};

type GoogleGeocodePayload = { status?: string; results?: GoogleGeocodeRow[] };

export const googleGeocoder: Geocoder = {
  id: "google",
  async search(q, ctx): Promise<GeocodeAnswer> {
    if (!ctx.config.googleMapsEnabled || !ctx.config.googleApiKey) {
      return { results: [], answered: false };
    }
    const text = q.trim();
    if (!text) return { results: [], answered: false };
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", text);
    url.searchParams.set("key", ctx.config.googleApiKey);
    const [lon, lat] = ctx.area.center;
    url.searchParams.set("region", "ar");
    url.searchParams.set("location", `${lat},${lon}`);
    const payload = await fetchJson<GoogleGeocodePayload>(url.toString());
    if (!payload || payload.status === "REQUEST_DENIED" || payload.status === "ZERO_RESULTS") {
      return { results: [], answered: false };
    }
    const rows = payload.results ?? [];
    const results = rows
      .map((row) => {
        const glat = row.geometry?.location?.lat;
        const glon = row.geometry?.location?.lng;
        if (glat == null || glon == null) return null;
        const label = row.formatted_address ?? text;
        return toPlaceResult(label, glon, glat);
      })
      .filter((r): r is NonNullable<typeof r> => !!r)
      .slice(0, ctx.config.limit);
    return { results, answered: results.length > 0 };
  },
};