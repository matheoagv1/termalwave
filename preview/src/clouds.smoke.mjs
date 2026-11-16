// smoke for clouds capabilities parsing (no wrangler, no network)
import { parseCapabilities } from "./clouds.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const now = Date.parse("2026-11-16T00:41:00Z");
const xml = `
<Layer>
  <Name>other</Name>
</Layer>
<Layer queryable="1">
  <wms:Name>global_longwave_imagery_mosaic</wms:Name>
  <Dimension name="time" default="2026-11-16T00:00:00Z" units="ISO8601">2026-11-15T19:00:00.000Z,2026-11-15T23:00:00.000Z,2026-11-16T00:00:00.000Z</Dimension>
  <westBoundLongitude>-180</westBoundLongitude>
  <southBoundLatitude>-70</southBoundLatitude>
  <eastBoundLongitude>180</eastBoundLongitude>
  <northBoundLatitude>70</northBoundLatitude>
</Layer>
`;
const parsed = parseCapabilities(xml, "global_longwave_imagery_mosaic", now);
assert(parsed.degraded === false && parsed.status === "ok", "live list is ok");
assert(parsed.times.length === 3, "three hours in the window");
assert(parsed.latest === "2026-11-16T00:00:00Z", "latest drops milliseconds");
assert(parsed.bounds[1] === -70, "south bound");

const interval = `
<Layer>
  <Name>global_longwave_imagery_mosaic</Name>
  <Dimension name='time'>2026-11-15T22:00:00Z/2026-11-16T00:00:00Z/PT1H</Dimension>
</Layer>`;
const hours = parseCapabilities(interval, "global_longwave_imagery_mosaic", now);
assert(hours.times[0] === "2026-11-15T22:00:00Z" && hours.latest === "2026-11-16T00:00:00Z", "hourly interval");

let missing = false;
try {
  parseCapabilities("<Layer><Name>nope</Name></Layer>", "global_longwave_imagery_mosaic", now);
} catch (err) {
  missing = err instanceof Error && err.message === "layer_missing";
}
assert(missing, "missing layer throws");

console.log("clouds smoke ok");
