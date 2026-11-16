import { mat3, mat4 } from "gl-matrix";
import type { SpaceView } from "./camera";
import { icrfToEcef, raDecToVector } from "./frames";
import type { SpaceHost, SpaceLayer } from "./types";

// space background behind the globe: milky way cube map, catalogue stars and
// constellation figures, one webgl2 canvas in host.back, turned icrf -> ecef by
// the scene clock. names go on a 2d canvas over it.

export const attribution =
  "Estrellas: Yale Bright Star Catalogue (CDS, dominio público) · Vía Láctea: ESO/S. Brunier (CC BY 4.0) · Constelaciones: d3-celestial, Olaf Frohn (BSD-3)";

export interface SkyOptions {
  milkyWay: boolean;
  stars: boolean;
  constellations: boolean;
  labels: boolean;
}

const DEFAULTS: SkyOptions = { milkyWay: true, stars: true, constellations: true, labels: true };
const MILKY_WAY_INTENSITY = 0.45;
const LINE_RGBA = [0.32, 0.45, 0.7, 0.55] as const;
const LABEL_FONT = "11px system-ui, sans-serif";
const LABEL_COLOR = "rgba(150, 175, 220, 0.8)";
// rank 1-2 are the figures people know; 3 adds the faint southern ones
const LABEL_MAX_RANK = 2;

// star sprite: magnitude -> gaussian sigma (css px) and peak alpha, b-v -> colour
const LIMIT_MAG = 6.5;
const MIN_SIGMA = 0.55;
const MAX_SIGMA = 1.4;
const MIN_ALPHA = 0.22;
const SATURATION = 0.55;
const STAR_FLOATS = 8;
const FACES = ["px", "nx", "py", "ny", "pz", "nz"] as const;

interface StarPack {
  stars: number[];
}
interface ConstellationPack {
  lines: Record<string, number[][]>;
  labels: [string, string, string, number, number, number][];
}
interface Label {
  text: string;
  dir: [number, number, number];
}

/** size a canvas to the view in device pixels; true when it changed */
export function fitCanvas(canvas: HTMLCanvasElement, view: SpaceView): boolean {
  const w = Math.max(1, Math.round(view.width * view.pixelRatio));
  const h = Math.max(1, Math.round(view.height * view.pixelRatio));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

export function layerCanvas(z: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;
  return c;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function starAppearance(vmag: number): [number, number] {
  const b = 10 ** (-0.2 * (Math.min(Number.isFinite(vmag) ? vmag : LIMIT_MAG, LIMIT_MAG) - LIMIT_MAG));
  return [clamp(MIN_SIGMA * b ** 0.3, MIN_SIGMA, MAX_SIGMA), clamp(MIN_ALPHA * b, MIN_ALPHA, 1)];
}

// ballesteros (2012) b-v -> kelvin, helland's black-body fit -> rgb, desaturated
function bvToRgb(bv: number): [number, number, number] {
  const i = clamp(Number.isFinite(bv) ? bv : 0.6, -0.4, 2);
  const t = clamp(4600 * (1 / (0.92 * i + 1.7) + 1 / (0.92 * i + 0.62)), 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const rgb = [r, g, b].map((c) => 1 - SATURATION + (SATURATION * clamp(c, 0, 255)) / 255);
  const peak = Math.max(...rgb);
  return [rgb[0] / peak, rgb[1] / peak, rgb[2] / peak];
}

function starVertices(pack: StarPack): Float32Array {
  const s = pack.stars;
  const out = new Float32Array((s.length / 4) * STAR_FLOATS);
  for (let i = 0, o = 0; i < s.length; i += 4, o += STAR_FLOATS) {
    const [sigma, alpha] = starAppearance(s[i + 2]);
    out.set([...raDecToVector(s[i], s[i + 1]), sigma, ...bvToRgb(s[i + 3]), alpha], o);
  }
  return out;
}

function lineVertices(pack: ConstellationPack): Float32Array {
  const out: number[] = [];
  for (const strips of Object.values(pack.lines))
    for (const s of strips)
      for (let i = 0; i + 3 < s.length; i += 2) out.push(...raDecToVector(s[i], s[i + 1]), ...raDecToVector(s[i + 2], s[i + 3]));
  return new Float32Array(out);
}

// directions, not points: w = 0 drops the eye translation, z just under w pins them to the far plane
const DIR_GLSL = `
uniform mat4 u_dirProj;
uniform mat3 u_rot;
vec4 skyClip(vec3 icrf) {
  vec4 c = u_dirProj * vec4(u_rot * icrf, 0.0);
  c.z = c.w * 0.99999;
  return c;
}`;

const MILKY_VS = `#version 300 es
in vec2 a_pos;
uniform mat4 u_invDirProj;
uniform mat3 u_rot;
out vec3 v_dir;
void main() {
  vec4 d = u_invDirProj * vec4(a_pos, 1.0, 1.0);
  v_dir = (d.xyz / d.w) * u_rot;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const MILKY_FS = `#version 300 es
precision highp float;
in vec3 v_dir;
uniform samplerCube u_cube;
uniform float u_intensity;
out vec4 o;
void main() {
  vec3 c = texture(u_cube, normalize(v_dir)).rgb * u_intensity;
  // the glow spans a few 8-bit steps: interleaved-gradient dither
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  o = vec4(max(c + (n - 0.5) / 255.0, 0.0), 1.0);
}`;

const STAR_VS = `#version 300 es
${DIR_GLSL}
in vec3 a_dir;
in float a_sigma;
in vec4 a_color;
uniform float u_pr;
out vec4 v_color;
out float v_sigma;
out float v_radius;
void main() {
  gl_Position = skyClip(a_dir);
  v_sigma = a_sigma * u_pr;
  v_radius = ceil(3.0 * v_sigma) + 1.0;
  gl_PointSize = 2.0 * v_radius;
  v_color = a_color;
}`;

const STAR_FS = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_sigma;
in float v_radius;
out vec4 o;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * (2.0 * v_radius);
  float a = v_color.a * exp(-0.5 * dot(p, p) / (v_sigma * v_sigma));
  if (a < 1.0 / 512.0) discard;
  o = vec4(v_color.rgb * a, a);
}`;

const LINE_VS = `#version 300 es
${DIR_GLSL}
in vec3 a_dir;
void main() { gl_Position = skyClip(a_dir); }`;

const LINE_FS = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 o;
void main() { o = vec4(u_color.rgb * u_color.a, u_color.a); }`;

interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string, attribs: string[], uniforms: string[]): Program {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`sky shader: ${gl.getShaderInfoLog(s)}`);
    gl.attachShader(p, s);
    gl.deleteShader(s);
  }
  attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`sky program: ${gl.getProgramInfoLog(p)}`);
  return { prog: p, u: Object.fromEntries(uniforms.map((n) => [n, gl.getUniformLocation(p, n)])) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sky image ${url}`));
    img.src = url;
  });
}

async function loadJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`sky ${url} ${r.status}`);
  return (await r.json()) as T;
}

export class SkyLayer implements SpaceLayer {
  readonly id = "sky";
  private options: SkyOptions;
  private host: SpaceHost | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private labelCanvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private milky: Program | null = null;
  private star: Program | null = null;
  private line: Program | null = null;
  private quad: WebGLVertexArrayObject | null = null;
  private stars: { vao: WebGLVertexArrayObject; count: number } | null = null;
  private lines: { vao: WebGLVertexArrayObject; count: number } | null = null;
  private cube: WebGLTexture | null = null;
  private buffers: WebGLBuffer[] = [];
  private labels: Label[] = [];
  private labelsDrawn = false;
  private readonly rot = mat3.create();
  private readonly invDirProj = mat4.create();
  private readonly clip = new Float64Array(4);
  private readonly dir: [number, number, number] = [0, 0, 0];

  constructor(options: Partial<SkyOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  getOptions(): Readonly<SkyOptions> {
    return this.options;
  }

  setOptions(patch: Partial<SkyOptions>): void {
    this.options = { ...this.options, ...patch };
    this.host?.invalidate();
  }

  mount(host: SpaceHost): void {
    this.host = host;
    this.canvas = layerCanvas(0);
    this.labelCanvas = layerCanvas(0);
    host.back.append(this.canvas, this.labelCanvas);
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: true });
    if (!gl) {
      console.warn("sky: webgl2 unavailable");
      return;
    }
    this.gl = gl;
    this.milky = program(gl, MILKY_VS, MILKY_FS, ["a_pos"], ["u_invDirProj", "u_rot", "u_cube", "u_intensity"]);
    this.star = program(gl, STAR_VS, STAR_FS, ["a_dir", "a_sigma", "a_color"], ["u_dirProj", "u_rot", "u_pr"]);
    this.line = program(gl, LINE_VS, LINE_FS, ["a_dir"], ["u_dirProj", "u_rot", "u_color"]);
    this.quad = this.vao(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), [[0, 2, 0]], 2);
    void this.load(gl, host.config.sky_assets);
  }

  private async load(gl: WebGL2RenderingContext, base: string): Promise<void> {
    const url = (f: string) => new URL(f, new URL(base, location.href)).href;
    const jobs = [
      loadJson<StarPack>(url("bright_stars.json")).then((p) => {
        const v = starVertices(p);
        this.stars = { vao: this.vao(gl, v, [[0, 3, 0], [1, 1, 3], [2, 4, 4]], STAR_FLOATS), count: v.length / STAR_FLOATS };
      }),
      loadJson<ConstellationPack>(url("constellations.json")).then((p) => {
        const v = lineVertices(p);
        this.lines = { vao: this.vao(gl, v, [[0, 3, 0]], 3), count: v.length / 3 };
        this.labels = p.labels.filter((l) => l[5] <= LABEL_MAX_RANK).map(([, es, , ra, dec]) => ({ text: es, dir: raDecToVector(ra, dec) }));
      }),
      Promise.all(FACES.map((f) => loadImage(url(`milkyway_${f}.webp`)))).then((imgs) => this.uploadCube(gl, imgs)),
    ];
    for (const r of await Promise.allSettled(jobs)) if (r.status === "rejected") console.warn("sky:", r.reason);
    this.host?.invalidate();
  }

  // attribute spec: [location, components, offset in floats]
  private vao(gl: WebGL2RenderingContext, data: Float32Array, attribs: [number, number, number][], stride: number): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
    const buf = gl.createBuffer()!;
    this.buffers.push(buf);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (const [loc, n, off] of attribs) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride * 4, off * 4);
    }
    gl.bindVertexArray(null);
    return vao;
  }

  private uploadCube(gl: WebGL2RenderingContext, imgs: HTMLImageElement[]): void {
    this.cube = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cube);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    imgs.forEach((img, i) => gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img));
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  setVisible(on: boolean): void {
    for (const c of [this.canvas, this.labelCanvas]) if (c) c.style.display = on ? "" : "none";
  }

  frame(view: SpaceView, now: Date): void {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas) return;
    fitCanvas(canvas, view);
    icrfToEcef(now, this.rot);
    const o = this.options;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (o.milkyWay && this.cube && this.milky && mat4.invert(this.invDirProj, view.dirProj)) {
      gl.disable(gl.BLEND);
      gl.useProgram(this.milky.prog);
      gl.uniformMatrix4fv(this.milky.u.u_invDirProj, false, this.invDirProj);
      gl.uniformMatrix3fv(this.milky.u.u_rot, false, this.rot);
      gl.uniform1f(this.milky.u.u_intensity, MILKY_WAY_INTENSITY);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cube);
      gl.uniform1i(this.milky.u.u_cube, 0);
      gl.bindVertexArray(this.quad);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // premultiplied additive: light adds to the glow
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    if (o.constellations && this.lines && this.line) {
      gl.useProgram(this.line.prog);
      gl.uniformMatrix4fv(this.line.u.u_dirProj, false, view.dirProj);
      gl.uniformMatrix3fv(this.line.u.u_rot, false, this.rot);
      gl.uniform4fv(this.line.u.u_color, LINE_RGBA);
      gl.bindVertexArray(this.lines.vao);
      gl.drawArrays(gl.LINES, 0, this.lines.count);
    }
    if (o.stars && this.stars && this.star) {
      gl.useProgram(this.star.prog);
      gl.uniformMatrix4fv(this.star.u.u_dirProj, false, view.dirProj);
      gl.uniformMatrix3fv(this.star.u.u_rot, false, this.rot);
      gl.uniform1f(this.star.u.u_pr, view.pixelRatio);
      gl.bindVertexArray(this.stars.vao);
      gl.drawArrays(gl.POINTS, 0, this.stars.count);
    }
    gl.bindVertexArray(null);
    this.drawLabels(view, o.labels && o.constellations);
  }

  private drawLabels(view: SpaceView, on: boolean): void {
    const c = this.labelCanvas;
    if (!c) return;
    const resized = fitCanvas(c, view);
    if (!on && !this.labelsDrawn && !resized) return;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    this.labelsDrawn = on;
    if (!on) return;
    ctx.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    ctx.font = LABEL_FONT;
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const m = view.dirProj;
    const p = this.clip;
    const d = this.dir;
    const e = view.eye;
    for (const l of this.labels) {
      const [x, y, z] = l.dir;
      d[0] = this.rot[0] * x + this.rot[3] * y + this.rot[6] * z;
      d[1] = this.rot[1] * x + this.rot[4] * y + this.rot[7] * z;
      d[2] = this.rot[2] * x + this.rot[5] * y + this.rot[8] * z;
      p[3] = m[3] * d[0] + m[7] * d[1] + m[11] * d[2];
      if (p[3] <= 0) continue;
      // the ray from the eye meets the earth: name would sit on the globe
      const b = e[0] * d[0] + e[1] * d[1] + e[2] * d[2];
      const disc = b * b - (e[0] * e[0] + e[1] * e[1] + e[2] * e[2] - 1);
      if (disc >= 0 && -b - Math.sqrt(disc) > 0) continue;
      p[0] = (m[0] * d[0] + m[4] * d[1] + m[8] * d[2]) / p[3];
      p[1] = (m[1] * d[0] + m[5] * d[1] + m[9] * d[2]) / p[3];
      if (p[0] < -1.1 || p[0] > 1.1 || p[1] < -1.1 || p[1] > 1.1) continue;
      ctx.fillText(l.text, ((p[0] + 1) / 2) * view.width, ((1 - p[1]) / 2) * view.height);
    }
  }

  destroy(): void {
    const gl = this.gl;
    if (gl) {
      for (const b of this.buffers) gl.deleteBuffer(b);
      for (const v of [this.quad, this.stars?.vao, this.lines?.vao]) if (v) gl.deleteVertexArray(v);
      for (const p of [this.milky, this.star, this.line]) if (p) gl.deleteProgram(p.prog);
      if (this.cube) gl.deleteTexture(this.cube);
    }
    this.canvas?.remove();
    this.labelCanvas?.remove();
    this.gl = null;
    this.host = null;
  }
}
