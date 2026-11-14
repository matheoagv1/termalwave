import trades from "../context/trades.json";

export type IntroPrefs = {
  done: boolean;
  name: string;
  trade: string;
  sound: boolean;
};

const KEY = "tw-intro-v1";

const defaults: IntroPrefs = { done: false, name: "", trade: trades[0]?.trade ?? "", sound: true };

export function readIntroPrefs(): IntroPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const p = JSON.parse(raw) as Partial<IntroPrefs>;
    return {
      done: !!p.done,
      name: typeof p.name === "string" ? p.name.slice(0, 48) : "",
      trade: typeof p.trade === "string" ? p.trade : defaults.trade,
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

export function tradeChoices(): string[] {
  return trades.map((t) => t.trade);
}