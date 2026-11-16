// MockProvider: implementa DataProvider con datos inventados (isMock: true)
import { F } from './catalog.es-AR.js';
import { hash, fbm } from './noise.js';
import { createPlaceSearch, searchConfigFromApp } from '../data/search/index.js';

export const SCENARIOS = ['normal', 'cargando', 'sin-conexion', 'sin-relieve', 'error-config', 'un-tramo', 'un-punto', 'rango-largo', 'tramo-vacio'];

const AREA = {
  name: 'Santiago del Estero',
  bounds: { west: -64.35, east: -64.15, south: -27.9, north: -27.7 },
  center: [-64.25, -27.8],
};

const LAYERS = [
  { id: 'radar', label: 'Radar', unit: 'dB', range: [-20, -4], decimals: 1,
    ramp: [{ at: 0, color: '#0c1622' }, { at: 0.35, color: '#24476a' }, { at: 0.7, color: '#6fa3c4' }, { at: 1, color: '#e2f1f8' }],
    note: 'Retrodispersión de banda L. Los valores altos indican superficies rugosas o con más humedad.' },
  { id: 'suelo', label: 'Suelo', unit: '%', range: [20, 50], decimals: 0,
    ramp: [{ at: 0, color: '#6b4423' }, { at: 0.3, color: '#b0823f' }, { at: 0.55, color: '#d8c98a' }, { at: 0.78, color: '#6fae86' }, { at: 1, color: '#2a6f78' }],
    note: 'Estado del suelo estimado a partir del radar. Los verdes y azules indican más humedad.' },
  { id: 'contaminacion', label: 'Contaminación', unit: 'índice', range: [0, 1], decimals: 2,
    ramp: [{ at: 0, color: '#140f24' }, { at: 0.35, color: '#4b2a7a' }, { at: 0.65, color: '#b0428a' }, { at: 1, color: '#ffb26b' }],
    note: 'Firma anómala respecto de la señal habitual del área. Un índice alto pide revisión en el terreno.' },
  { id: 'incendios', label: 'Incendios', unit: 'ha', range: [0, 60], decimals: 0,
    ramp: [{ at: 0, color: '#24211f' }, { at: 0.35, color: '#5e2617' }, { at: 0.7, color: '#d0521f' }, { at: 1, color: '#ffd36b' }],
    note: 'Cicatrices de fuego detectadas por cambio de señal. Se mide en hectáreas quemadas.' },
];

const ANCH = {
  suelo: [41, 38, 33, 36, 29],
  incendios: [6, 18, 42, 21, 55],
  radar: [-12.5, -11.8, -13.6, -10.9, -9.7],
  contaminacion: [0.12, 0.16, 0.34, 0.22, 0.41],
};
const AY = [2018, 2020, 2022, 2024, 2026];

const SPOTS = {
  radar: [['Lotes del norte', 0.3, 0.25, 0.04], ['Bajo anegable', 0.7, 0.6, 0.12], ['Monte nativo', 0.2, 0.75, -0.08]],
  suelo: [['Lote de siembra', 0.35, 0.3, 0.05], ['Bañado', 0.68, 0.58, 0.3]],
  contaminacion: [['Firma anómala A', 0.62, 0.42, 0.3], ['Canal de desagüe', 0.45, 0.7, 0.05]],
  incendios: [['Cicatriz norte', 0.25, 0.22, 0.2], ['Cicatriz del monte', 0.55, 0.8, 0.1], ['Borde de lote', 0.8, 0.35, -0.1]],
};

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const iso = (d) => d.toISOString().slice(0, 10);
const D = (y, m, d) => new Date(Date.UTC(y, m, d));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function yf(s) {
  const d = new Date(s + 'T00:00:00Z'), y = d.getUTCFullYear();
  return y + (d - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
}
function interp(arr, x) {
  if (x <= AY[0]) return arr[0];
  for (let i = 1; i < AY.length; i++) if (x <= AY[i]) return arr[i - 1] + ((arr[i] - arr[i - 1]) * (x - AY[i - 1])) / (AY[i] - AY[i - 1]);
  return arr[arr.length - 1];
}
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rampRgb(ramp, t) {
  t = clamp(t, 0, 1);
  for (let i = 1; i < ramp.length; i++) {
    if (t <= ramp[i].at) {
      const a = hex(ramp[i - 1].color), b = hex(ramp[i].color), k = (t - ramp[i - 1].at) / (ramp[i].at - ramp[i - 1].at);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return hex(ramp[ramp.length - 1].color);
}

function buildTicks(sc) {
  const yrs = (a, b) => { const r = []; for (let y = a; y <= b; y++) r.push({ id: `y-${y}`, start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) }); return r; };
  const qs = (y) => [1, 2, 3, 4].map((q) => ({ id: `q-${y}-${q}`, start: iso(D(y, (q - 1) * 3, 1)), end: iso(D(y, q * 3, 0)), label: `T${q} ${y}` }));
  const ms = (a, b) => { const r = []; for (let y = a; y <= b; y++) for (let m = 0; m < 12; m++) r.push({ id: `m-${y}-${String(m + 1).padStart(2, '0')}`, start: iso(D(y, m, 1)), end: iso(D(y, m + 1, 0)), label: `${MES[m]} ${y}` }); return r; };
  const acq = (n) => { const r = []; for (let i = 0; i < n; i++) { const d = D(2026, 0, 4 + 12 * i); r.push({ id: `a-${iso(d)}`, start: iso(d), end: iso(d), label: `${d.getUTCDate()} ${MES3[d.getUTCMonth()]} ${d.getUTCFullYear()}` }); } return r; };
  const defs = [
    { id: 'historia', label: 'Historia', granularity: 'year', kind: 'composite', res: 100, ticks: yrs(sc === 'rango-largo' ? 1990 : 2018, 2022) },
    { id: 'anio', label: 'Año reciente', granularity: 'quarter', kind: 'composite', res: 60, ticks: qs(2023) },
    { id: 'meses', label: 'Últimos 24 meses', granularity: 'month', kind: 'composite', res: 30, ticks: ms(2024, 2025) },
    { id: 'pasadas', label: 'Últimos 90 días', granularity: 'day', kind: 'acquisition', res: 10, ticks: acq(8) },
  ];
  if (sc === 'un-tramo') return [defs[3]];
  if (sc === 'un-punto') return [{ ...defs[3], ticks: defs[3].ticks.slice(0, 1) }];
  return defs;
}

function paintLayer(L, tn, ti, fr, partial) {
  const S = 72, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let n;
    if (L.id === 'radar') {
      const cx = Math.floor(x / 12), cy = Math.floor(y / 14);
      n = tn * 0.6 + 0.2 + (hash(cx, cy, 3) - 0.5) * 0.55 + (hash(cx, cy, 100 + ti) - 0.5) * 0.18 + (fbm(x * 0.08, y * 0.08, 4) - 0.5) * 0.3;
    } else if (L.id === 'suelo') {
      const d = Math.abs(y - 20 - 0.55 * x) / 1.14, bx = x - 0.68 * S, by = y - 0.58 * S;
      n = tn + (fbm(x * 0.07, y * 0.07, 7 + (ti % 3)) - 0.5) * 0.5 + 0.28 * Math.exp(-(d * d) / 90) + 0.25 * Math.exp(-(bx * bx + by * by) / 200);
    } else if (L.id === 'contaminacion') {
      const gx = (0.62 + 0.12 * fr) * S, gy = (0.42 + 0.05 * fr) * S, r2 = (x - gx) ** 2 + (y - gy) ** 2, sg = 9 + tn * 10;
      n = (0.15 + tn * 1.2) * Math.exp(-r2 / (2 * sg * sg)) + (fbm(x * 0.1, y * 0.1, 9) - 0.5) * 0.1 + 0.04;
    } else {
      const thr = 0.78 - tn * 0.45, f = fbm(x * 0.05, y * 0.05, 11);
      n = f > thr ? 0.55 + (0.45 * (f - thr)) / (1 - thr + 0.001) : 0.06 + f * 0.15;
    }
    const c = rampRgb(L.ramp, n), i = (y * S + x) * 4;
    im.data[i] = c[0]; im.data[i + 1] = c[1]; im.data[i + 2] = c[2];
    im.data[i + 3] = partial && x > S * 0.75 ? 0 : 255;
  }
  g.putImageData(im, 0, 0);
  return cv.toDataURL('image/png');
}

const runDemoSearch = createPlaceSearch(searchConfigFromApp(undefined));

export class MockProvider {
  constructor(opts = {}) { this.scenario = opts.scenario || 'normal'; this.ds = null; this.order = []; }

  async load() {
    const sc = this.scenario;
    if (sc === 'cargando') return new Promise(() => {});
    await sleep(700);
    if (sc === 'error-config') throw { code: 'bounds', message: 'Los límites del área no son válidos.' };
    if (this.ds) return this.ds;
    const gaps = new Set(['y-2018|contaminacion', 'y-2019|contaminacion', 'q-2023-2|contaminacion', 'a-2026-02-09|incendios']);
    const partial = new Set(['a-2026-02-21|radar']);
    const defs = buildTicks(sc);
    let ti = 0;
    const total = defs.reduce((a, s) => a + s.ticks.length, 0);
    this.vals = {};
    const segments = defs.map((s) => {
      const ticks = s.ticks.map((tk) => {
        const idx = ti++, mid = (yf(tk.start) + yf(tk.end)) / 2, fr = idx / Math.max(1, total - 1);
        const frames = {};
        LAYERS.forEach((L, li) => {
          const key = `${tk.id}|${L.id}`;
          let v = interp(ANCH[L.id], mid);
          if (L.id === 'suelo' && s.granularity !== 'year') v += 4 * Math.sin((mid % 1 - 0.15) * 2 * Math.PI);
          v += (hash(idx, li, 5) - 0.5) * (L.range[1] - L.range[0]) * 0.04;
          v = clamp(v, L.range[0], L.range[1]);
          this.vals[key] = v;
          const empty = (sc === 'tramo-vacio' && s.id === 'anio') || gaps.has(key);
          if (empty) { frames[L.id] = null; return; }
          const isP = partial.has(key);
          const tn = (v - L.range[0]) / (L.range[1] - L.range[0]);
          let cache = null;
          // la imagen se pinta recien al leer url, la carga inicial no la necesita
          frames[L.id] = {
            get url() { return cache || (cache = paintLayer(L, tn, idx, fr, isP)); },
            bounds: AREA.bounds, kind: s.kind, resolutionM: s.res,
            bytes: s.kind === 'composite' ? 380000 : 2400000,
            source: s.kind === 'composite' ? 'NISAR L2 · compuesto (ejemplo)' : 'NISAR L-SAR · pasada (ejemplo)',
            quality: isP ? 'partial' : 'ok',
          };
        });
        this.order.push(tk.id);
        return { id: tk.id, start: tk.start, end: tk.end, label: tk.label, frames };
      });
      return { id: s.id, label: s.label, from: ticks[0].start, to: ticks[ticks.length - 1].end, granularity: s.granularity, kind: s.kind, ticks };
    });
    this.ds = {
      area: AREA, layers: LAYERS, segments, isMock: true,
      events: [
        { id: 'ev-sequia', date: '2022-07-01', layer: 'suelo', label: 'Sequía prolongada' },
        { id: 'ev-fuego', date: '2024-08-20', layer: 'incendios', label: 'Temporada de incendios' },
        { id: 'ev-lluvia', date: '2026-02-15', label: 'Lluvias intensas' },
      ],
      context: [
        { trade: 'Producción agropecuaria', text: 'Entre 2018 y 2026 la humedad del suelo ha bajado de 41 a 29 por ciento en el área. Mira los meses de siembra en la línea de tiempo y compara con la campaña anterior antes de decidir la fecha.' },
        { trade: 'Gestión del agua', text: 'En las pasadas recientes la retrodispersión ha subido en los bajos del sector este, algo que suele indicar suelo saturado. Revisa esos puntos con la capa Suelo y con el evento de lluvias intensas.' },
      ],
    };
    return this.ds;
  }

  async series(layer) {
    await sleep(150);
    const out = [];
    this.ds.segments.forEach((s) => s.ticks.forEach((tk) => out.push({ tickId: tk.id, date: tk.start, value: tk.frames[layer] ? this.vals[`${tk.id}|${layer}`] : null })));
    return out;
  }

  async hotspots(layer, tickId) {
    await sleep(150);
    const L = LAYERS.find((l) => l.id === layer), i = this.order.indexOf(tickId);
    if (!L || i < 0) return [];
    const tk = this.ds.segments.flatMap((s) => s.ticks).find((x) => x.id === tickId);
    if (!tk.frames[layer]) return [];
    const span = L.range[1] - L.range[0], b = AREA.bounds;
    const at = (id, dev) => clamp(this.vals[`${id}|${layer}`] + dev * span, L.range[0], L.range[1]);
    const prevId = this.order[i - 1];
    return SPOTS[layer].map(([title, fx, fy, dev], k) => {
      const v = at(tickId, dev);
      const h = {
        id: `${layer}-${k}`,
        layer,
        tickId,
        title,
        lonlat: [b.west + fx * (b.east - b.west), b.north - fy * (b.north - b.south)],
        value: F.value(v, L.unit, L.decimals),
        sample: v,
      };
      if (prevId) h.delta = F.delta(v - at(prevId, dev), L.unit, L.decimals);
      return h;
    });
  }

  async search(q) {
    await sleep(80);
    if (!this.ds) return [];
    return runDemoSearch(q, this.ds.area);
  }
}
