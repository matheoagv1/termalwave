import React from "react";
import type { App } from "../../app/App";
import type { View } from "../../app/view";
import "./utilities.css";

type P = { v: View; a: App };

export function UtilitiesPanel({ v, a }: P): React.ReactElement {
  const t = v.t.utilities;
  const tl = v.tl;
  const compareTitle = !v.compareOn && !v.canCompare ? t.needDates : v.compareHint;
  return (
    <div className="twu">
      <p className="twu-lead">{v.layerName ? t.lead(v.layerName) : t.needLayer}</p>
      <button
        type="button"
        className="twu-tool tw-hov"
        aria-pressed={v.compareOn}
        disabled={!v.compareOn && !v.canCompare}
        title={compareTitle}
        onClick={a.toggleCompare}
      >
        <span className="twu-label">{t.compare}</span>
        <span className="twu-chip" aria-hidden="true" data-state={v.compareOn ? "on" : "off"}>{v.compareOn ? t.on : t.off}</span>
      </button>
      {v.compareOn && (
        <div className="twu-compare">
          <div className="twu-kicker">{t.mode}</div>
          <div role="radiogroup" aria-label={t.mode} className="twu-modes">
            <button type="button" role="radio" className="twu-mode tw-hov" aria-checked={v.compareMode === "side"} onClick={() => a.setCompareMode("side")}>
              {t.side}
            </button>
            <button type="button" role="radio" className="twu-mode tw-hov" aria-checked={v.compareMode === "curtain"} onClick={() => a.setCompareMode("curtain")}>
              {t.curtain}
            </button>
          </div>
          <div role="radiogroup" aria-label={v.t.timeline.target} className="twu-dates">
            <button type="button" role="radio" className="twu-date tw-hov" aria-checked={tl.tA} onClick={() => a.set({ cmpTarget: "A", tlOpen: true })}>
              <span className="twu-tag">{v.t.timeline.a}</span>
              <span className="twu-date-name">{tl.nameA || v.t.state.nodata}</span>
              <span className="twu-date-k">{t.dateA}</span>
            </button>
            <button type="button" role="radio" className="twu-date tw-hov" aria-checked={tl.tB} onClick={() => a.set({ cmpTarget: "B", tlOpen: true })}>
              <span className="twu-tag twu-tag-b">{v.t.timeline.b}</span>
              <span className="twu-date-name">{tl.nameB || v.t.state.nodata}</span>
              <span className="twu-date-k">{t.dateB}</span>
            </button>
          </div>
          <p className="twu-note">{t.pick}</p>
          {v.compareGap ? <p className="twu-note" role="status">{t.noFrame}</p> : null}
        </div>
      )}
      <button type="button" className="twu-tool" disabled aria-describedby="twu-later">
        <span className="twu-label">{t.draw}</span>
        <span className="twu-chip" aria-hidden="true" data-state="off">{t.off}</span>
      </button>
      <button type="button" className="twu-tool" disabled aria-describedby="twu-later">
        <span className="twu-label">{t.measure}</span>
        <span className="twu-chip" aria-hidden="true" data-state="off">{t.off}</span>
      </button>
      <p id="twu-later" className="twu-later">{t.later}</p>
    </div>
  );
}
