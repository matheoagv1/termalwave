import type { GeocodeAnswer, Geocoder } from "../types";
import { fetchJson, placeLabel, sortByAoiBias, toPlaceResult } from "../util";

type PhotonProps = {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  street?: string;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProps;
};

type PhotonPayload = { features?: PhotonFeature[] };

export const photonGeocoder: Geocoder = {
  id: "photon",
  async search(q, ctx): Promise<GeocodeAnswer> {
    const text = q.trim();
    if (!text) return { results: [], answered: false };
    const base = ctx.config.endpoints.photon ?? "https://photon.komoot.io/api/";
    const url = new URL(base.endsWith("/") ? base : `${base}/`);
    url.searchParams.set("q", text);
    url.searchParams.set("limit", String(ctx.config.limit));
    const [lon, lat] = ctx.area.center;
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    const payload = await fetchJson<PhotonPayload>(url.toString());
    const features = payload?.features ?? [];
    const results = features
      .map((f) => {
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        const p = f.properties ?? {};
        const label = placeLabel([p.name, p.street, p.city, p.state, p.country]);
        return toPlaceResult(label || text, coords[0], coords[1]);
      })
      .filter((r): r is NonNullable<typeof r> => !!r);
    const biased = sortByAoiBias(results, ctx.area).slice(0, ctx.config.limit);
    return { results: biased, answered: biased.length > 0 };
  },
};