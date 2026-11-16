import type { SpaceView } from "../space/camera";
import type { SpaceHost, SpaceLayer } from "../space/types";

// data marks drawn around the globe: fire glow sprites and light curtains rising
// from the nisar swath outlines. one webgl2 canvas over the map, in the same ecef
// frame as the other space layers. maplibre leaves the globe matrix near zoom 11,
// so everything fades out before that and the draped map layers take over.
// a program that fails to compile only drops its own marks, never the globe.

const DEG = Math.PI / 180;
const MAX_FIRES = 24_000;
const MAX_WALL_SEGMENTS = 20_000;
const FADE_FROM = 9.5;
const FADE_TO = 11;
const FIRE_STRIDE = 4;
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

// glow sprite per hotspot: core size and colour follow fire radiative power on a
// six stop ramp (ember to white hot), half size 8..28 css px in 2 px steps.
// unknown power: the smallest size in the theme heat colour, nothing made up
const FIRE_VS = `${COMMON}
layout(location = 0) in vec2 a_c;
layout(location = 1) in vec3 a_pos;
layout(location = 2) in float a_frp;
uniform vec2 u_res;
uniform float u_scale;
uniform vec3 u_unk;
out vec2 v_c;
out vec3 v_col;
vec3 ramp(float f) {
  if (f >= 300.0) return vec3(1.0, 0.953, 0.690);
  if (f >= 100.0) return vec3(0.992, 0.784, 0.290);
  if (f >= 50.0) return vec3(0.984, 0.604, 0.180);
  if (f >= 20.0) return vec3(0.941, 0.416, 0.157);
  if (f >= 5.0) return vec3(0.824, 0.251, 0.122);
  return vec3(0.620, 0.165, 0.106);
}
void main() {
  v_c = a_c;
  vec3 base = a_pos * (1.0 + LIFT);
  vec4 cb = u_vp * vec4(base, 1.0);
  if (visible(base) < 0.5 || cb.w <= 0.0) {
    v_col = vec3(0.0);
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float core = 8.0;
  v_col = u_unk;
  if (a_frp >= 0.0) {
    core = clamp(floor((8.0 + sqrt(a_frp) * 2.0) * 0.5 + 0.5) * 2.0, 8.0, 28.0);
    v_col = ramp(a_frp);
  }
  cb.xy += a_c * core * u_scale / u_res * 2.0 * cb.w;
  gl_Position = cb;
}`;

const FIRE_FS = `#version 300 es
precision mediump float;
in vec2 v_c;
in vec3 v_col;
uniform float u_gain;
out vec4 o;
void main() {
  float r = length(v_c);
  if (r >= 1.0) discard;
  vec4 c;
  if (r < 0.25) c = mix(vec4(1.0, 1.0, 0.922, 0.95), vec4(v_col, 0.9), r / 0.25);
  else if (r < 0.55) c = mix(vec4(v_col, 0.9), vec4(v_col, 0.35), (r - 0.25) / 0.3);
  else c = mix(vec4(v_col, 0.35), vec4(v_col, 0.0), (r - 0.55) / 0.45);
  float a = c.a * u_gain;
  o = vec4(c.rgb * a, a);
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

// still light, like a path line: bright at the ground edge, gone at the top
const WALL_FS = `#version 300 es
precision mediump float;
in float v_t;
in float v_vis;
uniform vec3 u_col;
uniform float u_gain;
out vec4 o;
void main() {
  if (v_vis < 0.5) discard;
  float up = 1.0 - v_t;
  float a = up * up * 0.22 + smoothstep(0.94, 1.0, up) * 0.6;
  vec3 col = u_col * a * u_gain;
  o = vec4(col, max(col.r, max(col.g, col.b)) * 0.25);
}`;

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}

// fire radiative power in MW, or -1 when the feed does not carry it
function fireFrp(p: Record<string, unknown>): number {
  const frp = num(p.frp ?? p.frp_mw);
  return Number.isFinite(frp) && frp >= 0 ? frp : -1;
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

// null on any failure, logged once per program; callers skip that mark kind
function compile(gl: WebGL2RenderingContext, name: string, vs: string, fs: string): WebGLProgram | null {
  const make = (type: number, src: string): WebGLShader | null => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn(`layers3d ${name} shader:`, gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  try {
    const a = make(gl.VERTEX_SHADER, vs);
    const b = make(gl.FRAGMENT_SHADER, fs);
    const prog = a && b ? gl.createProgram() : null;
    if (!a || !b || !prog) {
      if (a) gl.deleteShader(a);
      if (b) gl.deleteShader(b);
      return null;
    }
    gl.attachShader(prog, a);
    gl.attachShader(prog, b);
    gl.linkProgram(prog);
    gl.deleteShader(a);
    gl.deleteShader(b);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn(`layers3d ${name} link:`, gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  } catch (e) {
    console.warn(`layers3d ${name}:`, e);
    return null;
  }
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
  private cleared = true;
  private fireCol: [number, number, number] = [1, 0.48, 0.1];
  private swathCol: [number, number, number] = [0.31, 0.85, 1];
  private readonly eye = new Float32Array(3);
  private readonly onLost = (e: Event) => {
    e.preventDefault();
    // every gl object dies with the context; init makes new ones on restore
    this.fireProg = null;
    this.wallProg = null;
    this.fireVao = null;
    this.wallVao = null;
    this.quadBuf = null;
    this.fireBuf = null;
    this.wallBuf = null;
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
    if (!this.gl) {
      console.warn("layers3d: webgl2 unavailable, 3d marks off");
      return;
    }
    c.addEventListener("webglcontextlost", this.onLost);
    c.addEventListener("webglcontextrestored", this.onRestored);
    this.refreshColors();
    this.init();
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (this.canvas) this.canvas.style.display = on ? "" : "none";
  }

  /** Kept for the scene API; nothing here animates any more. */
  setReducedMotion(_on: boolean): void {}

  setSwathsVisible(on: boolean): void {
    if (on === this.swathsOn) return;
    this.swathsOn = on;
    this.cleared = false;
    this.host?.invalidate();
  }

  /** Theme tokens: --warn for heat without a power value, --accB for radar swaths. */
  refreshColors(): void {
    if (!this.host) return;
    const cs = getComputedStyle(this.host.map.getContainer());
    this.fireCol = parseColor(cs.getPropertyValue("--warn"), [1, 0.48, 0.1]);
    this.swathCol = parseColor(cs.getPropertyValue("--accB"), [0.31, 0.85, 1]);
    this.host.invalidate();
  }

  /** Point features (FIRMS hotspots); null clears. Size and colour follow frp when present. */
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
      const o = k * FIRE_STRIDE;
      this.fires[o] = cl * Math.cos(lon);
      this.fires[o + 1] = cl * Math.sin(lon);
      this.fires[o + 2] = Math.sin(lat);
      this.fires[o + 3] = fireFrp(f.properties ?? {});
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
    if (!gl || !c || !this.host || !this.visible || (!this.fireProg && !this.wallProg) || gl.isContextLost()) return;
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
    const wallVerts = this.swathsOn && this.wallProg ? this.wallVerts : 0;
    const fireCount = this.fireProg ? this.fireCount : 0;
    const any = (fireCount > 0 || wallVerts > 0) && fade > 0.01;
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

    this.eye[0] = view.eye[0];
    this.eye[1] = view.eye[1];
    this.eye[2] = view.eye[2];
    const dist = Math.max(0.0005, Math.hypot(view.eye[0], view.eye[1], view.eye[2]) - 1);
    const vp = view.viewProj as Float32Array;

    if (wallVerts > 0) {
      const u = this.wallU;
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.wallProg);
      gl.uniformMatrix4fv(u.u_vp, false, vp);
      gl.uniform3fv(u.u_eye, this.eye);
      // height follows the camera distance, so the curtain keeps a readable size on screen
      gl.uniform1f(u.u_h, Math.min(0.05, dist * 0.03));
      gl.uniform3f(u.u_col, this.swathCol[0], this.swathCol[1], this.swathCol[2]);
      gl.uniform1f(u.u_gain, fade);
      gl.bindVertexArray(this.wallVao);
      gl.drawArrays(gl.TRIANGLES, 0, wallVerts);
    }

    if (fireCount > 0) {
      const u = this.fireU;
      // translucent over, as glow sprites; additive burned dense regions to white
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.fireProg);
      gl.uniformMatrix4fv(u.u_vp, false, vp);
      gl.uniform3fv(u.u_eye, this.eye);
      gl.uniform2f(u.u_res, w, h);
      // whole-globe views shrink the sprites so a fire season reads as heat, not a blob
      gl.uniform1f(u.u_scale, pr * Math.min(1, Math.max(0.35, 0.35 + (0.65 * (zoom - 1)) / 3)));
      gl.uniform3f(u.u_unk, this.fireCol[0], this.fireCol[1], this.fireCol[2]);
      gl.uniform1f(u.u_gain, fade);
      gl.bindVertexArray(this.fireVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, fireCount);
    }
    gl.bindVertexArray(null);
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
    this.fireProg = compile(gl, "fires", FIRE_VS, FIRE_FS);
    this.wallProg = compile(gl, "swaths", WALL_VS, WALL_FS);
    if (this.fireProg) this.fireU = uniforms(gl, this.fireProg, ["u_vp", "u_eye", "u_res", "u_scale", "u_unk", "u_gain"]);
    if (this.wallProg) this.wallU = uniforms(gl, this.wallProg, ["u_vp", "u_eye", "u_h", "u_col", "u_gain"]);

    this.quadBuf ??= gl.createBuffer();
    this.fireBuf ??= gl.createBuffer();
    this.wallBuf ??= gl.createBuffer();

    this.fireVao ??= gl.createVertexArray();
    gl.bindVertexArray(this.fireVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fireBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, FIRE_STRIDE * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, FIRE_STRIDE * 4, 12);
    gl.vertexAttribDivisor(2, 1);

    this.wallVao ??= gl.createVertexArray();
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
