// shared edge cache for upstream api answers
// caches.default is a no-op on workers.dev, so callers must still work without hits

/**
 * @template T
 * @param {string} key
 * @param {number} ttl
 * @param {ExecutionContext} ctx
 * @param {() => Promise<T>} produce
 * @param {(data: T) => Response} store
 * @param {(hit: Response) => Promise<T>} load
 * @returns {Promise<T>}
 */
async function edgeCached(key, ttl, ctx, produce, store, load) {
  if (ttl <= 0) return produce();
  const req = new Request(key);
  const cache = caches.default;
  const hit = await cache.match(req);
  if (hit) return load(hit);
  const data = await produce();
  const stored = store(data);
  stored.headers.set("cache-control", `public, max-age=${ttl}`);
  ctx.waitUntil(cache.put(req, stored));
  return data;
}

/**
 * @param {string} key canonical url; equal requests must build equal keys
 * @param {number} ttl seconds to keep a good answer at the edge
 * @param {ExecutionContext} ctx
 * @param {() => Promise<unknown>} produce returns json, throws on upstream failure
 * @returns {Promise<unknown>}
 */
export function edgeJson(key, ttl, ctx, produce) {
  return edgeCached(
    key,
    ttl,
    ctx,
    produce,
    (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } }),
    (hit) => hit.json(),
  );
}

/**
 * binary counterpart of edgeJson (images, tiles)
 * @param {string} key canonical url; equal requests must build equal keys
 * @param {number} ttl seconds to keep a good answer at the edge
 * @param {ExecutionContext} ctx
 * @param {() => Promise<{ body: ArrayBuffer, type: string }>} produce throws on upstream failure
 * @returns {Promise<{ body: ArrayBuffer, type: string }>}
 */
export function edgeBytes(key, ttl, ctx, produce) {
  return edgeCached(
    key,
    ttl,
    ctx,
    produce,
    (data) => new Response(data.body, { headers: { "content-type": data.type } }),
    async (hit) => ({
      body: await hit.arrayBuffer(),
      type: hit.headers.get("content-type") || "application/octet-stream",
    }),
  );
}

/**
 * @param {unknown} data
 * @param {number} status
 * @param {number} maxAge seconds the browser may reuse it
 */
export function json(data, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": maxAge > 0 ? `private, max-age=${maxAge}` : "no-store",
    },
  });
}
