import type { SpaceView } from "../space/camera";
import type { SpaceHost, SpaceLayer } from "../space/types";

// data marks drawn as 3d objects around the globe: fire columns with a glow at
// the base and light curtains rising from the nisar swath outlines. one webgl2
// canvas over the map, additive, in the same ecef frame as the other space layers.
// maplibre leaves the globe matrix near zoom 11, so everything fades out before
// that and the draped map layers take over.

const DEG = Math.PI / 180;
const MAX_FIRES = 24_000;
const MAX_WALL_SEGMENTS = 20_000;
const FADE_FROM = 9.5;
const FADE_TO = 11;
const FIRE_STRIDE = 5;
const WALL_STRIDE = 4;

const COMMON = `#version 300 es
precision highp float;
uniform mat4 u_vp;
uniform vec3 u_eye;
const float LIFT = 0.0004;
// 0 when the earth stands between the eye and p. the test sphere sits a bit
// under the surface so marks on the ground do not hide themselves
float visible(vec3 p) {
  vec3 d = p - u_eye;
  float len = length(d);
  vec3 u = d / len;
  float b = dot(u_eye, u);
  float c = dot(u_eye, u_eye) - 0.998;
  float disc = b * b - c;
  if (disc <= 0.0) return 1.0;
  float t = -b - sqrt(disc);
  return (t > 0.0 && t < len) ? 0.0 : 1.0;
}
`;

const FIRE_VS = `${COMMON}
layout(location = 0) in vec2 a_c;
layout(location = 1) in vec3 a_pos;
layout(location = 2) in vec2 a_iv;
uniform vec2 u_res;
uniform float u_h;
uniform float u_px;
uniform float u_wpx;
uniform float u_time;
uniform float u_mode;
out vec2 v_c;
void main() {
  v_c = a_c;
  float pulse = 0.88 + 0.12 * sin(u_time * 2.4 + a_iv.y * 6.2832);
  vec3 base = a_pos * (1.0 + LIFT);
  vec4 cb = u_vp * vec4(base, 1.0);
  if (visible(base) < 0.5 || cb.w <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  if (u_mode < 0.5) {
    // glow: screen facing sprite, size in pixels
    v_c = vec2(a_c.x, a_c.y * 2.0 - 1.0);
    vec2 off = v_c * u_px * (0.7 + 0.6 * a_iv.x) * pulse;
    cb.xy += off / u_res * 2.0 * cb.w;
    gl_Position = cb;
  } else {
    // column: from the ground straight up, widened across its screen direction
    vec3 top = a_pos * (1.0 + LIFT + u_h * (0.3 + 0.7 * a_iv.x) * pulse);
    vec4 ct = u_vp * vec4(top, 1.0);
    if (ct.w <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec2 d = (ct.xy / ct.w - cb.xy / cb.w) * u_res;
    vec2 n = normalize(vec2(-d.y, d.x) + vec2(1e-5, 0.0));
    vec4 p = mix(cb, ct, a_c.y);
    p.xy += n * a_c.x * u_wpx / u_res * 2.0 * p.w;
    gl_Position = p;
  }
}`;

const FIRE_FS = `#version 300 es
precision mediump float;
in vec2 v_c;
uniform vec3 u_col;
// shared with the vertex stage: precision must match or the link fails
uniform highp float u_mode;
uniform float u_gain;
out vec4 o;
void main() {
  vec3 hot = vec3(1.0, 0.93, 0.76);
  vec3 col;
  if (u_mode < 0.5) {
    float d2 = dot(v_c, v_c);
    if (d2 > 1.0) discard;
    float edge = 1.0 - d2;
    col = (u_col * exp(-d2 * 5.0) * 0.55 + hot * exp(-d2 * 40.0) * 0.8) * edge;
  } else {
    float x = 1.0 - abs(v_c.x);
    float y = 1.0 - v_c.y;
    col = mix(u_col, hot, y * y * x) * x * x * pow(y, 1.5) * 0.9;
  }
  col *= u_gain;
  o = vec4(col, max(col.r, max(col.g, col.b)) * 0.3);
}`;

const WALL_VS = `${COMMON}
layout(location = 0) in vec4 a_p;
uniform float u_h;
out float v_t;
out float v_vis;
void main() {
  vec3 p = a_p.xyz * (1.0 + LIFT + a_p.w * u_h);
  v_t = a_p.w;
  v_vis = visible(p);
  gl_Position = u_vp * vec4(p, 1.0);
}`;

const WALL_FS = `#version 300 es
precision mediump float;
in float v_t;
in float v_vis;
uniform vec3 u_col;
uniform float u_gain;
uniform highp float u_time;
out vec4 o;
void main() {
  if (v_vis < 0.5) discard;
  float up = 1.0 - v_t;
  float a = up * up * 0.34 + smoothstep(0.94, 1.0, up) * 0.5;
  // slow band climbing the curtain, like a scan
  float band = 1.0 - abs(fract(v_t - u_time * 0.12) * 2.0 - 1.0);
  a += smoothstep(0.9, 1.0, band) * up * 0.12;
  vec3 col = u_col * a * u_gain;
  o = vec4(col, max(col.r, max(col.g, col.b)) * 0.25);
}`;

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}

// 0..1 strength of a hotspot from what the feed really carries; NaN when it has nothing
function fireStrength(p: Record<string, unknown>): number {
  const frp = num(p.frp ?? p.frp_mw);
  if (Number.isFinite(frp) && frp > 0) return Math.min(1, Math.log10(1 + frp) / 2.7);
  const k = num(p.brightness ?? p.bright_ti4 ?? p.bright_t31);
  if (Number.isFinite(k) && k >= 250) return Math.min(1, Math.max(0, (k - 300) / 100));
  const conf = p.confidence;
  const c = num(conf);
  if (Number.isFinite(c)) return Math.min(1, Math.max(0, c / 100));
  if (typeof conf === "string") {
    const s = conf.trim().toLowerCase();
    if (s.startsWith("h")) return 0.9;
    if (s.startsWith("n")) return 0.55;
    if (s.startsWith("l")) return 0.25;
  }
  return NaN;
}

function parseColor(css: string, fallback: [number, number, number]): [number, number, number] {
  const s = css.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16) / 255) as [number, number, number];
  m = /^#([0-9a-f]{6})/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16) / 255) as [number, number, number];
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
  return fallback;
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const make = (type: number, src: string): WebGLShader | null => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("layers3d shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const a = make(gl.VERTEX_SHADER, vs);
  const b = make(gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram();
  if (!a || !b || !prog) return null;
  gl.attachShader(prog, a);
  gl.attachShader(prog, b);
  gl.linkProgram(prog);
  gl.deleteShader(a);
  gl.deleteShader(b);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("layers3d link:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

function uniforms(gl: WebGL2RenderingContext, prog: WebGLProgram, names: string[]): Uniforms {
  const out: Uniforms = {};
  for (const n of names) out[n] = gl.getUniformLocation(prog, n);
  return out;
}

export class Layers3D implements SpaceLayer {
  readonly id = "layers3d";
  private host: SpaceHost | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private fireProg: WebGLProgram | null = null;
  private wallProg: WebGLProgram | null = null;
  private fireU: Uniforms = {};
  private wallU: Uniforms = {};
  private fireVao: WebGLVertexArrayObject | null = null;
  private wallVao: WebGLVertexArrayObject | null = null;
  private quadBuf: WebGLBuffer | null = null;
  private fireBuf: WebGLBuffer | null = null;
  private wallBuf: WebGLBuffer | null = null;
  // cpu copies outlive a lost context and data set before mount
  private fires = new Float32Array(0);
  private fireCount = 0;
  private walls = new Float32Array(0);
  private wallVerts = 0;
  private firesDirty = false;
  private wallsDirty = false;
  private visible = true;
  private swathsOn = true;
  private reduced = false;
  private cleared = true;
  private fireCol: [number, number, number] = [1, 0.48, 0.1];
  private swathCol: [number, number, number] = [0.37, 0.92, 1];
  private readonly eye = new Float32Array(3);
  private readonly onLost = (e: Event) => {
    e.preventDefault();
    this.fireProg = null;
    this.wallProg = null;
  };
  private readonly onRestored = () => {
    this.init();
    this.host?.invalidate();
  };

  mount(host: SpaceHost): void {
    this.host = host;
    const c = document.createElement("canvas");
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    host.front.appendChild(c);
    this.canvas = c;
    this.gl = c.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true, depth: false, stencil: false });
    if (!this.gl) return;
    c.addEventListener("webglcontextlost", this.onLost);
    c.addEventListener("webglcontextrestored", this.onRestored);
    this.reduced = this.reduced || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    this.refreshColors();
    this.init();
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (this.canvas) this.canvas.style.display = on ? "" : "none";
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }

  setSwathsVisible(on: boolean): void {
    if (on === this.swathsOn) return;
    this.swathsOn = on;
    this.cleared = false;
    this.host?.invalidate();
  }

  /** Theme tokens: --warn for heat, --accB for radar swaths. */
  refreshColors(): void {
    if (!this.host) return;
    const cs = getComputedStyle(this.host.map.getContainer());
    this.fireCol = parseColor(cs.getPropertyValue("--warn"), [1, 0.48, 0.1]);
    this.swathCol = parseColor(cs.getPropertyValue("--accB"), [0.37, 0.92, 1]);
    this.host.invalidate();
  }

  /** Point features (FIRMS hotspots); null clears. Height follows frp, brightness or confidence when present. */
  setFires(fc: unknown | null): void {
    const feats = (fc as { features?: unknown[] } | null)?.features;
    const list = Array.isArray(feats) ? feats : [];
    const step = Math.max(1, Math.ceil(list.length / MAX_FIRES));
    const n = Math.ceil(list.length / step);
    if (this.fires.length < n * FIRE_STRIDE) this.fires = new Float32Array(n * FIRE_STRIDE);
    let k = 0;
    for (let i = 0; i < list.length && k < n; i += step) {
      const f = list[i] as { geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> | null };
      const xy = f?.geometry?.type === "Point" ? (f.geometry.coordinates as number[]) : null;
      if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) continue;
      const lon = xy[0] * DEG;
      const lat = xy[1] * DEG;
      const cl = Math.cos(lat);
      const s = fireStrength(f.properties ?? {});
      const o = k * FIRE_STRIDE;
      this.fires[o] = cl * Math.cos(lon);
      this.fires[o + 1] = cl * Math.sin(lon);
      this.fires[o + 2] = Math.sin(lat);
      // no strength in the feed: one common height, nothing made up per point
      this.fires[o + 3] = Number.isFinite(s) ? s : 0.45;
      this.fires[o + 4] = (Math.sin(xy[0] * 12.9898 + xy[1] * 78.233) * 43758.5453) % 1;
      k++;
    }
    this.fireCount = k;
    this.firesDirty = true;
    this.host?.invalidate();
  }

  /** Polygon features (NISAR frame footprints); null clears. Each ring becomes a light curtain. */
  setSwaths(fc: unknown | null): void {
    const feats = (fc as { features?: unknown[] } | null)?.features;
    const rings: number[][][] = [];
    for (const f of Array.isArray(feats) ? feats : []) {
      const g = (f as { geometry?: { type?: string; coordinates?: unknown } })?.geometry;
      if (g?.type === "Polygon") rings.push(...(g.coordinates as number[][][]));
      else if (g?.type === "MultiPolygon") for (const poly of g.coordinates as number[][][][]) rings.push(...poly);
    }
    // count first so the buffer is sized once
    let segs = 0;
    for (const ring of rings) for (let i = 0; i + 1 < ring.length; i++) segs += this.steps(ring[i], ring[i + 1]);
    segs = Math.min(segs, MAX_WALL_SEGMENTS);
    if (this.walls.length < segs * 6 * WALL_STRIDE) this.walls = new Float32Array(segs * 6 * WALL_STRIDE);
    let v = 0;
    const put = (lonDeg: number, latDeg: number, t: number): void => {
      const lon = lonDeg * DEG;
      const lat = latDeg * DEG;
      const cl = Math.cos(lat);
      const o = v * WALL_STRIDE;
      this.walls[o] = cl * Math.cos(lon);
      this.walls[o + 1] = cl * Math.sin(lon);
      this.walls[o + 2] = Math.sin(lat);
      this.walls[o + 3] = t;
      v++;
    };
    let used = 0;
    outer: for (const ring of rings) {
      for (let i = 0; i + 1 < ring.length; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        const n = this.steps(a, b);
        // shortest way round in longitude, so a ring over the antimeridian stays whole
        const dLon = ((b[0] - a[0] + 540) % 360) - 180;
        const dLat = b[1] - a[1];
        for (let j = 0; j < n; j++) {
          if (used >= segs) break outer;
          const lon0 = a[0] + (dLon * j) / n;
          const lat0 = a[1] + (dLat * j) / n;
          const lon1 = a[0] + (dLon * (j + 1)) / n;
          const lat1 = a[1] + (dLat * (j + 1)) / n;
          put(lon0, lat0, 0);
          put(lon1, lat1, 0);
          put(lon1, lat1, 1);
          put(lon0, lat0, 0);
          put(lon1, lat1, 1);
          put(lon0, lat0, 1);
          used++;
        }
      }
    }
    this.wallVerts = v;
    this.wallsDirty = true;
    this.host?.invalidate();
  }

  // pieces of at most one degree, so the curtain follows the curve of the globe
  private steps(a: number[], b: number[]): number {
    if (!a || !b || !Number.isFinite(a[0] + a[1] + b[0] + b[1])) return 0;
    const dLon = Math.abs(((b[0] - a[0] + 540) % 360) - 180);
    return Math.max(1, Math.ceil(Math.max(dLon, Math.abs(b[1] - a[1]))));
  }

  frame(view: SpaceView, _now: Date): void {
    const gl = this.gl;
    const c = this.canvas;
    if (!gl || !c || !this.host || !this.visible || !this.fireProg || !this.wallProg || gl.isContextLost()) return;
    const pr = Math.min(view.pixelRatio, 2);
    const w = Math.max(1, Math.round(view.width * pr));
    const h = Math.max(1, Math.round(view.height * pr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      this.cleared = false;
    }
    this.upload(gl);
    const zoom = this.host.map.getZoom();
    const fade = 1 - Math.min(1, Math.max(0, (zoom - FADE_FROM) / (FADE_TO - FADE_FROM)));
    const wallVerts = this.swathsOn ? this.wallVerts : 0;
    const any = (this.fireCount > 0 || wallVerts > 0) && fade > 0.01;
    if (!any) {
      if (!this.cleared) {
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.cleared = true;
      }
      return;
    }
    this.cleared = false;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    this.eye[0] = view.eye[0];
    this.eye[1] = view.eye[1];
    this.eye[2] = view.eye[2];
    // heights follow the camera distance, so marks keep a readable size on screen
    const dist = Math.max(0.0005, Math.hypot(view.eye[0], view.eye[1], view.eye[2]) - 1);
    const time = this.reduced ? 0 : (performance.now() / 1000) % 3600;
    const vp = view.viewProj as Float32Array;

    if (wallVerts > 0) {
      const u = this.wallU;
      gl.useProgram(this.wallProg);
      gl.uniformMatrix4fv(u.u_vp, false, vp);
      gl.uniform3fv(u.u_eye, this.eye);
      gl.uniform1f(u.u_h, Math.min(0.06, dist * 0.035));
      gl.uniform3f(u.u_col, this.swathCol[0], this.swathCol[1], this.swathCol[2]);
      gl.uniform1f(u.u_gain, fade);
      gl.uniform1f(u.u_time, time);
      gl.bindVertexArray(this.wallVao);
      gl.drawArrays(gl.TRIANGLES, 0, wallVerts);
    }

    if (this.fireCount > 0) {
      const u = this.fireU;
      gl.useProgram(this.fireProg);
      gl.uniformMatrix4fv(u.u_vp, false, vp);
      gl.uniform3fv(u.u_eye, this.eye);
      gl.uniform2f(u.u_res, w, h);
      gl.uniform1f(u.u_h, Math.min(0.05, dist * 0.03));
      gl.uniform1f(u.u_px, (5 + 1.4 * zoom) * pr);
      gl.uniform1f(u.u_wpx, (1.3 + 0.3 * zoom) * pr);
      gl.uniform1f(u.u_time, time);
      gl.uniform3f(u.u_col, this.fireCol[0], this.fireCol[1], this.fireCol[2]);
      // far out the hotspots pile up; lower gain keeps dense regions from burning to white
      gl.uniform1f(u.u_gain, fade * (0.4 + 0.6 * Math.min(1, Math.max(0, (zoom - 2) / 4))));
      gl.bindVertexArray(this.fireVao);
      gl.uniform1f(u.u_mode, 0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.fireCount);
      gl.uniform1f(u.u_mode, 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.fireCount);
    }
    gl.bindVertexArray(null);
    if (!this.reduced) this.host.invalidate();
  }

  destroy(): void {
    const gl = this.gl;
    const c = this.canvas;
    if (c) {
      c.removeEventListener("webglcontextlost", this.onLost);
      c.removeEventListener("webglcontextrestored", this.onRestored);
    }
    if (gl) {
      gl.deleteProgram(this.fireProg);
      gl.deleteProgram(this.wallProg);
      gl.deleteVertexArray(this.fireVao);
      gl.deleteVertexArray(this.wallVao);
      gl.deleteBuffer(this.quadBuf);
      gl.deleteBuffer(this.fireBuf);
      gl.deleteBuffer(this.wallBuf);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    c?.remove();
    this.canvas = null;
    this.gl = null;
    this.host = null;
    this.fireProg = null;
    this.wallProg = null;
  }

  private init(): void {
    const gl = this.gl;
    if (!gl) return;
    this.fireProg = compile(gl, FIRE_VS, FIRE_FS);
    this.wallProg = compile(gl, WALL_VS, WALL_FS);
    if (!this.fireProg || !this.wallProg) return;
    this.fireU = uniforms(gl, this.fireProg, ["u_vp", "u_eye", "u_res", "u_h", "u_px", "u_wpx", "u_time", "u_mode", "u_col", "u_gain"]);
    this.wallU = uniforms(gl, this.wallProg, ["u_vp", "u_eye", "u_h", "u_col", "u_gain", "u_time"]);

    this.quadBuf = gl.createBuffer();
    this.fireBuf = gl.createBuffer();
    this.wallBuf = gl.createBuffer();

    this.fireVao = gl.createVertexArray();
    gl.bindVertexArray(this.fireVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fireBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, FIRE_STRIDE * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, FIRE_STRIDE * 4, 12);
    gl.vertexAttribDivisor(2, 1);

    this.wallVao = gl.createVertexArray();
    gl.bindVertexArray(this.wallVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wallBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.firesDirty = true;
    this.wallsDirty = true;
  }

  private upload(gl: WebGL2RenderingContext): void {
    if (this.firesDirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.fireBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.fires.subarray(0, this.fireCount * FIRE_STRIDE), gl.DYNAMIC_DRAW);
      this.firesDirty = false;
      this.cleared = false;
    }
    if (this.wallsDirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.wallBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.walls.subarray(0, this.wallVerts * WALL_STRIDE), gl.DYNAMIC_DRAW);
      this.wallsDirty = false;
      this.cleared = false;
    }
  }
}
