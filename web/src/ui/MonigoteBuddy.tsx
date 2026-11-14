import React from "react";
import { s } from "../app/css";

const MONI = "./brand/monigote.png";

type P = {
  tip: string;
  name: string;
  open: boolean;
  sound: boolean;
  reduced: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSoundToggle: () => void;
  soundLabel: string;
  closeLabel: string;
  buddyLabel: string;
};

export function MonigoteBuddy({
  tip,
  name,
  open,
  reduced,
  onToggle,
  onClose,
  onSoundToggle,
  sound,
  soundLabel,
  closeLabel,
  buddyLabel,
}: P): React.ReactElement {
  const greet = name ? `, ${name}` : "";
  return (
    <div
      style={s("position:absolute;right:12px;bottom:var(--tw-moni-b, 72px);pointer-events:auto;z-index:30;display:flex;flex-direction:column;align-items:flex-end;gap:8px")}
    >
      {open && tip && (
        <div
          role="status"
          style={s(
            "width:min(280px,calc(100vw - 32px));background:var(--panel-solid);border:1px solid var(--line2);padding:12px 12px 10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.25)",
          )}
        >
          <p style={s("margin:0;font:13px/1.4 var(--sans);color:var(--fg);text-wrap:pretty")}>{tip}</p>
          <div style={s("display:flex;gap:6px;justify-content:flex-end")}>
            <button
              type="button"
              className="tw-hov"
              onClick={onSoundToggle}
              aria-pressed={sound}
              style={s("height:32px;padding:0 10px;border:1px solid var(--line2);background:transparent;cursor:pointer;font:11px var(--mono)")}
            >
              {soundLabel}
            </button>
            <button
              type="button"
              className="tw-hov"
              onClick={onClose}
              style={s("height:32px;padding:0 10px;border:1px solid var(--line2);background:transparent;cursor:pointer;font:11px var(--sans)")}
            >
              {closeLabel}
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className={reduced ? undefined : "tw-float"}
        onClick={onToggle}
        aria-expanded={open}
        aria-label={buddyLabel}
        title={`${buddyLabel}${greet}`}
        style={s(
          "height:56px;width:56px;border:1px solid var(--line2);background:var(--panel-solid);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:4px",
        )}
      >
        <img
          src={MONI}
          alt=""
          aria-hidden="true"
          decoding="async"
          style={s("height:46px;width:auto;image-rendering:pixelated")}
        />
      </button>
    </div>
  );
}