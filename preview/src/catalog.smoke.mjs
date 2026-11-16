// smoke for the catalog proxy helpers (no wrangler, no network)
import { filterEonet, flatten } from "./catalog.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const point = flatten({
  type: "Feature",
  properties: { id: "EONET_1", title: "Wildfire", categories: [{ id: "wildfires", title: "Wildfires" }], magnitudeValue: 519, magnitudeUnit: "acres" },
  geometry: { type: "Point", coordinates: [-60, -30] },
});
assert(point.properties.category === "wildfires", "category flattened");
assert(point.properties.magnitude === 519, "magnitude kept");
const track = flatten({ type: "Feature", properties: { categories: [{ id: "severeStorms" }] }, geometry: { type: "LineString", coordinates: [[0, 0], [10, 5]] } });
assert(track.geometry.coordinates[0] === 10, "storm track keeps the latest position");
assert(flatten({ type: "Feature", properties: {}, geometry: null }) === null, "no geometry is dropped");
const inView = filterEonet([point, track], [-70, -40, -50, -20]);
assert(inView.length === 1 && inView[0] === point, "bbox filter");
console.log("catalog smoke ok");
