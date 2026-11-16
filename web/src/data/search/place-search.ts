import type { Area, SearchResult } from "../../tw/contract";
import { DEFAULT_REMOTE_PROVIDERS, resolveSearchChain } from "./registry";
import type { GeocodeContext, SearchConfig } from "./types";

export const EMPTY_QUERY_RESULTS: SearchResult[] = [];

const DEFAULT_USER_AGENT = "TermalWave/0.1 (+https://termalwave.space)";

export type AppSearchBlock = {
  providers?: string[];
  endpoints?: Record<string, string>;
  user_agent?: string;
  google_maps_enabled?: boolean;
};

export function searchConfigFromApp(
  block: AppSearchBlock | undefined,
  sceneGoogleEnabled?: boolean,
): SearchConfig {
  const googleMapsEnabled = !!(block?.google_maps_enabled ?? sceneGoogleEnabled);
  const providers = block?.providers?.length ? [...block.providers] : [...DEFAULT_REMOTE_PROVIDERS];
  if (googleMapsEnabled && !providers.includes("google")) {
    providers.unshift("google");
  }
  return {
    providers,
    endpoints: block?.endpoints ?? {},
    userAgent: block?.user_agent ?? DEFAULT_USER_AGENT,
    googleMapsEnabled,
    googleApiKey:
      typeof import.meta.env?.VITE_GOOGLE_MAPS_API_KEY === "string"
        ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        : undefined,
    limit: 8,
  };
}

export function createPlaceSearch(config: SearchConfig) {
  const chain = resolveSearchChain(config.providers);
  return async (q: string, area: Area): Promise<SearchResult[]> => {
    const text = q.trim();
    if (!text) return EMPTY_QUERY_RESULTS;
    const ctx: GeocodeContext = { area, config };
    for (const provider of chain) {
      const { results, answered } = await provider.search(text, ctx);
      if (answered && results.length) return results;
    }
    return EMPTY_QUERY_RESULTS;
  };
}

/** Sanity: empty or whitespace query yields no results (no network). */
export function emptyQueryYieldsNoResults(q: string): boolean {
  return q.trim() === "";
}