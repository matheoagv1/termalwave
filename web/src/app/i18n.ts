import React from "react";
import { es } from "../context/locales/es";
import { en } from "../context/locales/en";
import { F as esF, T as esT } from "../context/locales/es";
import { F as enF, T as enT } from "../context/locales/en";

export type Lang = "en" | "es";
export type Key = keyof typeof es;
export type Copy = typeof esT;
export type CatalogFmt = typeof esF;

const dicts: Record<Lang, Record<Key, string>> = { es, en };
const copies: Record<Lang, Copy> = { es: esT, en: enT as Copy };
const fmts: Record<Lang, CatalogFmt> = { es: esF, en: enF as CatalogFmt };

const DEFAULT_LANG: Lang = "en";

export function detectLang(): Lang {
  if (typeof location === "undefined") return DEFAULT_LANG;
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "es") return q;
  try {
    const saved = localStorage.getItem("tw-lang");
    if (saved === "en" || saved === "es") return saved;
  } catch {
    // private mode has no storage; fall through to the default
  }
  return DEFAULT_LANG;
}

export function htmlLang(lang: Lang): string {
  return lang === "es" ? "es-AR" : "en";
}

// query wins over the saved choice, and the saved choice wins over English
export function persistLang(lang: Lang): void {
  try {
    localStorage.setItem("tw-lang", lang);
  } catch {
    // ignore
  }
  if (typeof document !== "undefined") document.documentElement.lang = htmlLang(lang);
  if (typeof history === "undefined" || typeof location === "undefined") return;
  const url = new URL(location.href);
  url.searchParams.set("lang", lang);
  history.replaceState(null, "", url);
}

export function makeT(lang: Lang) {
  return (key: Key, vars?: Record<string, string | number>): string =>
    (dicts[lang][key] ?? dicts.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? ""));
}

export const fmt = (lang: Lang) => ({
  num: (v: number, d = 1): string =>
    new Intl.NumberFormat(lang === "es" ? "es-AR" : "en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(v),
  date: (iso: string): string =>
    new Intl.DateTimeFormat(lang === "es" ? "es-AR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(iso)) + " ART",
  rel: (min: number): string =>
    new Intl.RelativeTimeFormat(lang === "es" ? "es-AR" : "en-US", { numeric: "auto" }).format(-min, "minute"),
});

export function copyOf(lang: Lang): Copy {
  return copies[lang];
}

export function fmtOf(lang: Lang): CatalogFmt {
  return fmts[lang];
}

export type LangApi = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: ReturnType<typeof makeT>;
  fmt: ReturnType<typeof fmt>;
  copy: Copy;
};

const LangContext = React.createContext<LangApi | null>(null);

export function LangProvider({ value, children }: { value: LangApi; children: React.ReactNode }): React.ReactElement {
  return React.createElement(LangContext.Provider, { value }, children);
}

export function useLang(): LangApi {
  const value = React.useContext(LangContext);
  if (!value) throw new Error("useLang needs LangProvider");
  return value;
}
