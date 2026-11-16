import type maplibregl from "maplibre-gl";
import { spaceView } from "./camera";
import type { SpaceConfig, SpaceHost, SpaceLayer } from "./types";

export type { SpaceConfig, SpaceLayer } from "./types";

function plane(z: number): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:${z}`;
  return el;
}

/**
 * Hosts the layers that live around the globe (sky, bodies, satellites,
 * clouds) and drives them from the map's own render loop, so they never
 * drift a frame behind the camera.
 */
export class SpaceScene implements SpaceHost {
  readonly back: HTMLElement;
  readonly front: HTMLElement;
  private readonly layers = new Map<string, { layer: SpaceLayer; on: boolean }>();
  private clock: Date | null = null;
  private queued = false;
  private readonly onRender = () => this.draw();

  constructor(
    readonly map: maplibregl.Map,
    readonly config: SpaceConfig,
  ) {
    const container = map.getContainer();
    const canvas = map.getCanvasContainer();
    this.back = plane(0);
    this.front = plane(2);
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.zIndex = "1";
    container.insertBefore(this.back, container.firstChild);
    canvas.after(this.front);
    map.on("render", this.onRender);
    map.on("resize", this.onRender);
  }

  now(): Date {
    return this.clock ?? new Date();
  }

  /** Pin the clock (timeline scrub) or pass null to follow real time. */
  setClock(at: Date | null): void {
    this.clock = at;
    this.invalidate();
  }

  invalidate(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.draw();
    });
  }

  async add(layer: SpaceLayer, on = true): Promise<void> {
    this.layers.set(layer.id, { layer, on });
    try {
      await layer.mount(this);
    } catch (e) {
      // a layer that cannot start (shader, webgl, assets) drops out alone; the globe and the rest keep drawing
      console.warn(`space layer ${layer.id} off:`, e);
      this.layers.delete(layer.id);
      try {
        layer.destroy();
      } catch {
        /* half built */
      }
      return;
    }
    layer.setVisible(on);
    this.invalidate();
  }

  setVisible(id: string, on: boolean): void {
    const entry = this.layers.get(id);
    if (!entry) return;
    entry.on = on;
    entry.layer.setVisible(on);
    this.invalidate();
  }

  isVisible(id: string): boolean {
    return this.layers.get(id)?.on ?? false;
  }

  destroy(): void {
    this.map.off("render", this.onRender);
    this.map.off("resize", this.onRender);
    for (const { layer } of this.layers.values()) layer.destroy();
    this.layers.clear();
    this.back.remove();
    this.front.remove();
  }

  private draw(): void {
    const view = spaceView(this.map);
    if (!view) return;
    const now = this.now();
    for (const { layer, on } of this.layers.values()) if (on) layer.frame(view, now);
  }
}
