import type { Geocoder } from "./types";
import { aoiGeocoder } from "./providers/aoi";
import { coordsGeocoder } from "./providers/coords";
import { googleGeocoder } from "./providers/google";
import { nominatimGeocoder } from "./providers/nominatim";
import { openMeteoGeocoder } from "./providers/open-meteo";
import { photonGeocoder } from "./providers/photon";

const BUILTIN: Geocoder[] = [coordsGeocoder, aoiGeocoder];

const REMOTE: Geocoder[] = [
  googleGeocoder,
  openMeteoGeocoder,
  photonGeocoder,
  nominatimGeocoder,
];

const BY_ID = new Map<string, Geocoder>(
  [...BUILTIN, ...REMOTE].map((g) => [g.id, g]),
);

/** Default remote order: keyless providers first. */
export const DEFAULT_REMOTE_PROVIDERS = ["open_meteo_geocode", "photon", "nominatim"];

export function resolveSearchChain(providerIds: string[]): Geocoder[] {
  const builtins = BUILTIN;
  const remotes: Geocoder[] = [];
  const seen = new Set<string>();
  for (const id of providerIds) {
    if (seen.has(id) || id === "coords" || id === "aoi") continue;
    const g = BY_ID.get(id);
    if (!g) continue;
    seen.add(id);
    remotes.push(g);
  }
  if (!remotes.length) {
    for (const id of DEFAULT_REMOTE_PROVIDERS) {
      const g = BY_ID.get(id);
      if (g) remotes.push(g);
    }
  }
  return [...builtins, ...remotes];
}