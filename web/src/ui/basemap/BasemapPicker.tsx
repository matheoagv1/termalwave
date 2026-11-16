import React from "react";
import { s } from "../../app/css";
import type { Lang } from "../../app/i18n";
import { basemapMeta } from "./basemaps";
import "./basemap.css";

type Item = { id: string; label: string; on: boolean; go: () => void };

// Radio group with roving focus: arrows move and select, like native radios.
export function BasemapPicker({ items, lang, title }: { items: Item[]; lang: Lang; title: string }): React.ReactElement | null {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  if (items.length < 2) return null;
  const active = Math.max(0, items.findIndex((x) => x.on));
  const onKey = (e: React.KeyboardEvent, i: number): void => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let n = step === undefined ? -1 : (i + step + items.length) % items.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = items.length - 1;
    if (n < 0) return;
    e.preventDefault();
    items[n].go();
    refs.current[n]?.focus();
  };
  return (
    <div style={s("display:flex;flex-direction:column;gap:6px;padding:10px")}>
      <div id="tw-bm-head" style={s("font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--fg2)")}>{title}</div>
      <div role="radiogroup" aria-labelledby="tw-bm-head" className="tw-bm-grid">
        {items.map((bm, i) => {
          const m = basemapMeta(bm.id, lang);
          return (
            <button
              key={bm.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={bm.on}
              tabIndex={i === active ? 0 : -1}
              className="tw-bm-chip"
              title={m.label}
              onClick={bm.go}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className="tw-bm-swatch" style={{ background: m.swatch }} aria-hidden />
              <span className="tw-bm-label">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
