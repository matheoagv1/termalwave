import React from "react";
import { s } from "../app/css";
import { intro } from "./intro-copy";
import { tradeChoices, writeIntroPrefs } from "./intro-prefs";
import { Sfx } from "./sfx";

const MONI = "./brand/monigote.png";
const PANEL = "background:var(--panel-solid);border:1px solid var(--line2)";
const OTHER = "Ninguno de estos";

type P = {
  sound: boolean;
  reduced: boolean;
  onDone: (name: string, trade: string) => void;
};

type Step = "hola" | "nombre" | "rubro" | "listo";

export function IntroOverlay({ sound, reduced, onDone }: P): React.ReactElement {
  const [step, setStep] = React.useState<Step>("hola");
  const [name, setName] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const trades = [...tradeChoices(), OTHER];
  const line =
    step === "hola"
      ? intro.hola
      : step === "nombre"
        ? intro.askName
        : step === "rubro"
          ? intro.askTrade
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
    const selectedTrade = trade === OTHER ? "" : trade;
    writeIntroPrefs({ done: true, name: n, trade: selectedTrade, sound });
    if (sound) Sfx.ok();
    onDone(n, selectedTrade);
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
          alt=""
          aria-hidden="true"
          decoding="async"
          style={s("align-self:center;height:128px;width:auto;image-rendering:pixelated")}
        />
        <div className="tw-pixel" style={s("font-size:8px;line-height:1.6;color:var(--acc-fg);text-align:center")}>
          {intro.kicker}
        </div>
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
            aria-label={intro.askTrade}
            style={s("display:flex;flex-wrap:wrap;gap:6px;max-height:160px;overflow-y:auto")}
          >
            {trades.map((tr) => {
              const on = tr === trade;
              return (
                <label
                  key={tr}
                  style={s(
                    `display:flex;align-items:center;gap:7px;white-space:normal;text-align:left;min-height:44px;padding:6px 10px;border:1px solid ${on ? "var(--acc-fg)" : "var(--line2)"};background:${on ? "var(--sel)" : "transparent"};cursor:pointer;font:12px var(--sans)`,
                  )}
                >
                  <input
                    type="radio"
                    name="trade"
                    value={tr}
                    checked={on}
                    onChange={() => { setTrade(tr); ping(); }}
                    style={s("accent-color:var(--acc)")}
                  />
                  {tr}
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
