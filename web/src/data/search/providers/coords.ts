import type { GeocodeAnswer, Geocoder } from "../types";
import { matchCoords } from "../util";

export const coordsGeocoder: Geocoder = {
  id: "coords",
  async search(q, _ctx): Promise<GeocodeAnswer> {
    const hit = matchCoords(q.trim());
    return hit ? { results: [hit], answered: true } : { results: [], answered: false };
  },
};