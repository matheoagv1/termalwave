import type { SearchResult } from "../../tw/contract";

export type MissionId = "cambio" | "fuego" | "clima" | "ambiente" | "explore";
export type Honesty = "measured" | "model" | "example";
export type PlaceId = "ibera" | "rondonia" | "reykjanes";

// "area" means the dataset's own area of interest, resolved when it has loaded.
export type SetupPlace = SearchResult | "area";
export type SetupResult = { extras?: string[]; place?: SetupPlace };

export type Mission = {
  id: MissionId;
  // topic id in context/topics.json; empty keeps the current reading
  topic: string;
  extras: string[];
  honesty: Honesty | null;
  glyph: string;
};

// Layer ids mirror PRESETS in data/layer-defaults.ts, limited to layers that exist today.
export const MISSIONS: Mission[] = [
  { id: "cambio", topic: "cambio", extras: [], honesty: "measured", glyph: "◐" },
  { id: "fuego", topic: "fuego", extras: ["incendios", "firms"], honesty: "measured", glyph: "▲" },
  { id: "clima", topic: "clima", extras: ["clouds", "wind"], honesty: "model", glyph: "≈" },
  { id: "ambiente", topic: "ambiente", extras: ["suelo", "contaminacion"], honesty: "example", glyph: "▦" },
  { id: "explore", topic: "", extras: [], honesty: null, glyph: "○" },
];

export const PLACES: { id: PlaceId; lonlat: [number, number] }[] = [
  { id: "ibera", lonlat: [-57.2, -28.4] },
  { id: "rondonia", lonlat: [-63.2, -10.4] },
  { id: "reykjanes", lonlat: [-22.27, 63.89] },
];
