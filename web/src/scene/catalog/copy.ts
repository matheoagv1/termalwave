import type { CatalogStatus } from "./store";

// status words for catalog rows; the panel copy file stays untouched
const words = {
  en: {
    loading: "Loading from the source…",
    empty: "Nothing in this view for this date.",
    zoom: "Zoom in to see this layer.",
    network: "The source did not answer. Check the connection.",
    http: (n?: number): string => `The source refused the request${n ? ` (HTTP ${n})` : ""}.`,
    format: "The source answered with data this app cannot read.",
    count: (n: number): string => `${n} in view`,
    shown: "Shown on the globe.",
    dateDaily: (d: string): string => d,
    dateStatic: "Fixed period, see caveats",
  },
  es: {
    loading: "Cargando desde la fuente…",
    empty: "No hay nada en esta vista para esta fecha.",
    zoom: "Acercate para ver esta capa.",
    network: "La fuente no respondió. Revisá la conexión.",
    http: (n?: number): string => `La fuente rechazó el pedido${n ? ` (HTTP ${n})` : ""}.`,
    format: "La fuente respondió con datos que la app no puede leer.",
    count: (n: number): string => `${n} en la vista`,
    shown: "Se ve en el globo.",
    dateDaily: (d: string): string => d,
    dateStatic: "Período fijo, ver advertencias",
  },
};

export function statusText(st: CatalogStatus, lang: string): string {
  const w = lang === "es" ? words.es : words.en;
  if (st.state === "loading") return w.loading;
  if (st.state === "empty") return st.reason === "zoom" ? w.zoom : w.empty;
  if (st.state === "error") return st.reason === "http" ? w.http(st.http) : st.reason === "format" ? w.format : w.network;
  if (st.state === "ok") return st.count ? w.count(st.count) : w.shown;
  return "";
}

export function dateText(date: string, time: string, lang: string): string {
  const w = lang === "es" ? words.es : words.en;
  if (!date) return "";
  if (time === "static") return date === "default" ? w.dateStatic : date;
  return w.dateDaily(date);
}
