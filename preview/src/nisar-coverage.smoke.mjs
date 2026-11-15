// minimal smoke for nisar-coverage pure helpers (no wrangler)
import {
  parseBbox,
  boxesIntersect,
  aoiFromConfig,
  framesFromDataset,
  granulesToFrames,
} from "./nisar-coverage.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sgo = parseBbox("-64.4,-28.0,-64.1,-27.6");
assert(sgo && sgo.length === 4, "parse sgo bbox");
assert(parseBbox("bad") === null, "reject bad bbox");
assert(parseBbox("10,10,-5,20") === null, "reject inverted lon");

const aoi = aoiFromConfig({
  aoi: { name: "Santiago del Estero", west: -64.35, east: -64.15, south: -27.9, north: -27.7 },
});
assert(aoi && aoi.name.includes("Santiago"), "aoi from config");
assert(boxesIntersect(sgo, aoi.bbox), "sgo intersects aoi");
assert(!boxesIntersect(parseBbox("139.6,35.5,139.9,35.8"), aoi.bbox), "tokyo misses aoi");

const frames = framesFromDataset(
  {
    segments: [
      {
        ticks: [
          {
            id: "y-2026",
            label: "2026",
            start: "2026-01-01",
            end: "2026-12-31",
            frames: {
              radar: {
                url: "./overlays/timeline/radar/2026.png",
                bounds: aoi.bounds,
                kind: "composite",
              },
            },
          },
        ],
      },
    ],
  },
  aoi.bounds,
);
assert(frames.length === 1 && frames[0].url.includes("2026.png"), "dataset radar frame");

const cmr = granulesToFrames(
  {
    feed: {
      entry: [
        {
          id: "G1",
          title: "NISAR_L2_GCOV provisional",
          time_start: "2026-01-15T00:00:00Z",
          boxes: ["-28.0 -64.4 -27.6 -64.1"],
          links: [{ rel: "http://esipfed.org/ns/fedsearch/1.1/data#", href: "https://example.test/g1.h5" }],
        },
      ],
    },
  },
  "NISAR_L2_GCOV",
);
assert(cmr.length === 1 && cmr[0].status === "provisional" && cmr[0].url, "cmr granule map");

console.log("nisar-coverage smoke ok");
