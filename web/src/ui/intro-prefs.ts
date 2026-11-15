import topics from "../context/topics.json";
import trades from "../context/trades.json";

export type IntroPrefs = {
  done: boolean;
  name: string;
  trade: string;
  sound: boolean;
};

export type ThemeChoice = {
  id: string;
  label: string;
  text: string;
};

const KEY = "tw-intro-v1";

function themeChoicesInternal(): ThemeChoice[] {
  if (Array.isArray(topics) && topics.length > 0) {
    return topics as ThemeChoice[];
  }
  return trades.map((t) => ({ id: t.trade, label: t.trade, text: t.text }));
}

const firstChoice = themeChoicesInternal()[0];

const defaults: IntroPrefs = {
  done: false,
  name: "",
  trade: firstChoice?.id ?? "",
  sound: true,
};

export function readIntroPrefs(): IntroPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const p = JSON.parse(raw) as Partial<IntroPrefs>;
    let trade = typeof p.trade === "string" ? p.trade : defaults.trade;
    const topics = themeChoicesInternal();
    if (trade && !topics.some((t) => t.id === trade)) {
      const hit = topics.find((t) => t.label === trade);
      if (hit) trade = hit.id;
    }
    return {
      done: !!p.done,
      name: typeof p.name === "string" ? p.name.slice(0, 48) : "",
      trade,
      sound: p.sound !== false,
    };
  } catch {
    return { ...defaults };
  }
}

export function writeIntroPrefs(patch: Partial<IntroPrefs>): IntroPrefs {
  const next = { ...readIntroPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sin almacenamiento */
  }
  return next;
}

export function themeChoices(): ThemeChoice[] {
  return themeChoicesInternal();
}

/** Etiquetas para UI legacy; intro usa themeChoices(). */
export function tradeChoices(): string[] {
  return themeChoicesInternal().map((t) => t.label);
}