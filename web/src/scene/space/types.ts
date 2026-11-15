import type maplibregl from "maplibre-gl";
import type { SpaceView } from "./camera";

export interface EphemerisConfig {
  endpoint: string;
  upstream: string;
  bodies: Record<string, string>;
  step_hours: number;
}

export interface SatellitesConfig {
  endpoint: string;
  upstream: string;
  groups: string[];
  default_group: string;
  highlight: string[];
  cache_ttl_s: number;
  min_elevation_deg: number;
}

export interface CloudsConfig {
  endpoint: string;
  upstream: string;
  layer: string;
  attribution: string;
  manifest_ttl_s: number;
  max_zoom: number;
}

export interface WindConfig {
  endpoint: string;
  forecast?: string;
  archive?: string;
  cache_ttl_s?: number;
  attribution?: string;
}

/** `space` block of app-config.json, emitted from [space] in config/apis.toml. */
export interface SpaceConfig {
  sky_assets: string;
  satellite_assets: string;
  ephemeris: EphemerisConfig;
  satellites: SatellitesConfig;
  clouds: CloudsConfig;
  wind?: WindConfig;
}

export interface SpaceHost {
  readonly map: maplibregl.Map;
  /** Stacked under the map canvas; the globe is drawn over whatever lives here. */
  readonly back: HTMLElement;
  /** Stacked over the map canvas, pointer-events off. */
  readonly front: HTMLElement;
  readonly config: SpaceConfig;
  /** Scene clock. Live by default; every layer reads time from here. */
  now(): Date;
  /** Ask for one more frame (layers that animate call it from frame()). */
  invalidate(): void;
}

export interface SpaceLayer {
  readonly id: string;
  mount(host: SpaceHost): void | Promise<void>;
  setVisible(on: boolean): void;
  /** Called once per rendered map frame while visible. */
  frame(view: SpaceView, now: Date): void;
  destroy(): void;
}
