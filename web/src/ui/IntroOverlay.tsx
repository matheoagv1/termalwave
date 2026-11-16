import React from "react";
import { s } from "../app/css";
import { useLang, type Lang } from "../app/i18n";
import { themeChoices, writeIntroPrefs } from "./intro-prefs";
import { Sfx } from "./sfx";

const MONI = "./brand/monigote-si.png";
const MONI_FALLBACK = "./brand/monigote.png";
const PANEL = "background:var(--panel-solid);border:1px solid var(--line2)";
const NONE = "none";

type P = {
  sound: boolean;
  reduced: boolean;
  onDone: (name: string, trade: string) => void;
};

type Step = "hola" | "nombre" | "rubro" | "listo";

export function IntroOverlay({ sound, reduced, onDone }: P): React.ReactElement {
  const { lang, setLang, copy } = useLang();
  const intro = copy.intro;
  const [step, setStep] = React.useState<Step>("hola");
  const [name, setName] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const themes = [...themeChoices()];
  const choices = [...themes.map((t) => ({ id: t.id, label: t.label })), { id: NONE, label: intro.other }];
  const line =
    step === "hola"
      ? intro.hola
      : step === "nombre"
        ? intro.askName
        : step === "rubro"
          ? intro.askTheme
          : intro.ready(name.trim() || intro.guest);

  React.useEffect(() => {
    if (reduced) {
      setTyped(line);
      return;
    }
    setTyped("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(line.slice(0, i));
      if (i >= line.length) window.clearInterval(id);
    }, 24);
    return () => window.clearInterval(id);
  }, [line, reduced, step]);

  const ping = (): void => {
    if (sound) Sfx.step();
  };

  const nextFromHola = (): void => {
    ping();
    setStep("nombre");
  };

  const nextFromName = (): void => {
    if (!name.trim()) return;
    ping();
    setStep("rubro");
  };

  const finish = (): void => {
    const n = name.trim() || intro.guest;
    const selectedTrade = trade === NONE ? "" : trade;
    writeIntroPrefs({ done: true, name: n, trade: selectedTrade, sound });
    if (sound) Sfx.ok();
    onDone(n, selectedTrade);
  };

  const skipGuest = (): void => {
    if (sound) Sfx.ok();
    onDone(intro.guest, "");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={intro.title}
      style={s("position:absolute;inset:0;pointer-events:auto;display:flex;align-items:center;justify-content:center;padding:16px;z-index:40")}
    >
      <div
        style={s(
          "position:absolute;inset:0;background:rgba(4,8,16,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)",
        )}
      />
      <section
        style={s(
          `position:relative;width:min(440px,100%);${PANEL};padding:20px 18px 16px;display:flex;flex-direction:column;gap:14px;box-shadow:0 12px 40px rgba(0,0,0,.35)`,
        )}
      >
        <img
          className={reduced ? undefined : "tw-bob"}
          src={MONI}
          onError={(e) => {
            if (!e.currentTarget.src.endsWith("monigote.png")) e.currentTarget.src = MONI_FALLBACK;
          }}
          alt=""
          aria-hidden="true"
          decoding="async"
          style={s("align-self:center;height:128px;width:auto;image-rendering:pixelated")}
        />
        <div className="tw-pixel" style={s("font-size:8px;line-height:1.6;color:var(--acc-fg);text-align:center")}>
          {intro.kicker}
        </div>
        <IntroLang lang={lang} setLang={setLang} label={copy.lang.label} en={copy.lang.en} es={copy.lang.es} />
        <p aria-hidden="true" style={s("margin:0;min-height:3.2em;font:15px/1.45 var(--sans);color:var(--fg);text-wrap:pretty")}>{typed}</p>
        <p role="status" style={s("position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0")}>{line}</p>

        {step === "nombre" && (
          <input
            aria-label={intro.askName}
            maxLength={48}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nextFromName()}
            placeholder={intro.namePh}
            autoComplete="nickname"
            autoFocus
            style={s(
              "height:40px;padding:0 12px;border:1px solid var(--line2);background:var(--bg);color:var(--fg);font:14px var(--sans)",
            )}
          />
        )}

        {step === "rubro" && (
          <div
            role="radiogroup"
            aria-label={intro.askTheme}
            style={s("display:flex;flex-wrap:wrap;gap:6px;max-height:160px;overflow-y:auto")}
          >
            {choices.map((ch) => {
              const on = ch.id === trade;
              return (
                <label
                  key={ch.id}
                  style={s(
                    `display:flex;align-items:center;gap:7px;white-space:normal;text-align:left;min-height:44px;padding:6px 10px;border:1px solid ${on ? "var(--acc-fg)" : "var(--line2)"};background:${on ? "var(--sel)" : "transparent"};cursor:pointer;font:12px var(--sans)`,
                  )}
                >
                  <input
                    type="radio"
                    name="trade"
                    value={ch.id}
                    checked={on}
                    onChange={() => { setTrade(ch.id); ping(); }}
                    style={s("accent-color:var(--acc)")}
                  />
                  {ch.label}
                </label>
              );
            })}
          </div>
        )}

        <div style={s("display:flex;gap:8px;flex-wrap:wrap;margin-top:4px")}>
          {step === "hola" && (
            <Primary onClick={nextFromHola}>{intro.continue}</Primary>
          )}
          {step === "nombre" && (
            <Primary onClick={nextFromName} disabled={!name.trim()}>
              {intro.continue}
            </Primary>
          )}
          {(step === "hola" || step === "nombre") && (
            <button
              type="button"
              onClick={skipGuest}
              style={s(
                "height:40px;padding:0 14px;border:1px solid var(--line2);background:transparent;color:var(--fg);cursor:pointer;font:13px var(--sans)",
              )}
            >
              {intro.skip}
            </button>
          )}
          {step === "rubro" && (
            <Primary
              disabled={!trade}
              onClick={() => {
                ping();
                setStep("listo");
              }}
            >
              {intro.continue}
            </Primary>
          )}
          {step === "listo" && <Primary onClick={finish}>{intro.start}</Primary>}
        </div>
      </section>
    </div>
  );
}

function IntroLang({
  lang,
  setLang,
  label,
  en,
  es,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  label: string;
  en: string;
  es: string;
}): React.ReactElement {
  const seg = (on: boolean): string =>
    `height:32px;min-width:40px;padding:0 8px;border:1px solid ${on ? "var(--acc-fg)" : "var(--line2)"};background:${on ? "var(--sel)" : "transparent"};cursor:pointer;font:12px var(--mono)`;
  return (
    <div role="group" aria-label={label} style={s("display:flex;justify-content:center;gap:6px")}>
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} style={s(seg(lang === "en"))}>{en}</button>
      <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")} style={s(seg(lang === "es"))}>{es}</button>
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={s(
        "height:40px;padding:0 16px;border:1px solid var(--acc);background:var(--acc);color:var(--acc-ink);cursor:pointer;font-weight:600;font:13px var(--sans)",
      )}
    >
      {children}
    </button>
  );
}
