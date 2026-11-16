// CelesTrak and NOAA nowCOAST answer 403 to Cloudflare Workers egress. We fetch them through our own origin
// (nginx location /_up/<name>/ on origin.termalwave.space, same X-TW-Origin-Key as the tiles; see
// /etc/nginx/snippets/termalwave-upstream-relay.conf). Everything else goes direct. Every call has a timeout.
const RELAYS = [
  ["https://celestrak.org/NORAD/elements/", "/_up/celestrak/"],
  ["https://nowcoast.noaa.gov/geoserver/observations/satellite/", "/_up/nowcoast/"],
];

/**
 * @param {Record<string, any>} env
 * @param {string | URL} target
 * @param {RequestInit} [init]
 */
export function relayFetch(env, target, init = {}) {
  const href = String(target);
  let url = href;
  const headers = { ...(init.headers || {}) };
  if (env?.TILE_ORIGIN && env?.TILE_ORIGIN_KEY) {
    for (const [prefix, path] of RELAYS) {
      if (href.startsWith(prefix)) {
        url = env.TILE_ORIGIN.replace(/\/$/, "") + path + href.slice(prefix.length);
        headers[env.TILE_ORIGIN_HEADER || "X-TW-Origin-Key"] = env.TILE_ORIGIN_KEY;
        break;
      }
    }
  }
  return fetch(url, { ...init, headers, signal: init.signal || AbortSignal.timeout(8000) });
}
