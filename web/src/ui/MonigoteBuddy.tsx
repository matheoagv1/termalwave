import React from "react";
import { s } from "../app/css";

const MONI = "./brand/monigote-si.png";
const MONI_FALLBACK = "./brand/monigote.png";

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
  bottom: string;
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
  bottom,
}: P): React.ReactElement {
  const greet = name ? `, ${name}` : "";
  return (
    <div
      style={s(`position:absolute;right:0;bottom:${bottom};pointer-events:auto;z-index:30;display:flex;flex-direction:column;align-items:flex-end;gap:8px`)}
    >
      {open && tip && (
        <div
          role="status"
          style={s(
            "width:min(300px,calc(100vw - 32px));box-sizing:border-box;border:18px solid transparent;border-image:url(./ui/bubble.png) 44 fill / 18px stretch;padding:0 2px;display:flex;flex-direction:column;gap:8px;color:#0b1230;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35));margin-bottom:-4px",
          )}
        >
          <p style={s("margin:0;font:13px/1.4 var(--sans);color:#0b1230;text-wrap:pretty")}>{tip}</p>
          <div style={s("display:flex;gap:6px;justify-content:flex-end")}>
            <button
              type="button"
              className="tw-hov"
              onClick={onSoundToggle}
              aria-pressed={sound}
              style={s("height:32px;padding:0 10px;border:2px solid #14257a;background:transparent;color:#0b1230;cursor:pointer;font:11px var(--mono)")}
            >
              {soundLabel}
            </button>
            <button
              type="button"
              className="tw-hov"
              onClick={onClose}
              style={s("height:32px;padding:0 10px;border:2px solid #14257a;background:transparent;color:#0b1230;cursor:pointer;font:11px var(--sans)")}
            >
              {closeLabel}
            </button>
          </div>
        </div>
      )}
      {open && tip && (
        <img src="./ui/tailR.png" alt="" aria-hidden="true" width={28} style={s("margin:-10px 22px 0 0;image-rendering:pixelated;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3))")} />
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
          onError={(e) => {
            if (!e.currentTarget.src.endsWith("monigote.png")) e.currentTarget.src = MONI_FALLBACK;
          }}
          alt=""
          aria-hidden="true"
          decoding="async"
          style={s("height:46px;width:auto;image-rendering:pixelated")}
        />
      </button>
    </div>
  );
}