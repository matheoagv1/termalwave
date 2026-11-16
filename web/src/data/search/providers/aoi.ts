import type { GeocodeAnswer, Geocoder } from "../types";
import { matchAoiPreset } from "../util";

export const aoiGeocoder: Geocoder = {
  id: "aoi",
  async search(q, ctx): Promise<GeocodeAnswer> {
    const hit = matchAoiPreset(q.trim(), ctx.area);
    return hit ? { results: [hit], answered: true } : { results: [], answered: false };
  },
};