import type { Area, SearchResult } from "../../tw/contract";

export type SearchConfig = {
  /** Remote provider ids from app-config (e.g. open_meteo_geocode, photon). */
  providers: string[];
  endpoints: Record<string, string>;
  userAgent: string;
  googleMapsEnabled: boolean;
  googleApiKey?: string;
  limit: number;
};

export type GeocodeContext = {
  area: Area;
  config: SearchConfig;
};

export type GeocodeAnswer = {
  results: SearchResult[];
  answered: boolean;
};

export interface Geocoder {
  readonly id: string;
  search(q: string, ctx: GeocodeContext): Promise<GeocodeAnswer>;
}