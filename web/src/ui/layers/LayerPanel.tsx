import React from "react";
import type { App } from "../../app/App";
import type { View } from "../../app/view";
import { layerCopy } from "./layer-copy";
import { buildTiers, useRemoteMeta, type Tier } from "./layer-model";
import { LayerRow } from "./LayerRow";
import "./layers.css";

type P = { v: View; a: App; focus?: Tier };

// The three categories in one list. `focus` is the section the rail asked for.
export function LayerPanel({ v, a, focus }: P): React.ReactElement {
  const c = layerCopy(a.state.lang);
  const remote = useRemoteMeta();
  const [open, setOpen] = React.useState("");
  const root = React.useRef<HTMLDivElement>(null);
  const tiers = buildTiers(v, a, remote);

  React.useEffect(() => {
    if (!focus) return;
    root.current?.querySelector(`[data-tier="${focus}"]`)?.scrollIntoView({ block: "start" });
  }, [focus]);

  return (
    <div ref={root} className={`twl${v.isM ? " twl--m" : ""}`}>
      <p className="twl-lead">{c.panelLead}</p>
      {!v.hasDs && v.noDs ? <p className="twl-empty" role="status">{c.loadingLayers}</p> : null}
      {tiers.map((tm) => {
        const headId = `twl-head-${tm.tier}`;
        return (
          <section key={tm.tier} className="twl-tier" data-tier={tm.tier} aria-labelledby={headId}>
            <div className="twl-tier-head">
              <h3 id={headId} className="twl-tier-title">{c.tier[tm.tier]}</h3>
              {tm.total > 0 ? <span className="twl-tier-count">{c.active(tm.active, tm.total)}</span> : null}
            </div>
            <p className="twl-tier-lead">{c.tierLead[tm.tier]}</p>
            {tm.rows.length === 0 ? (
              <p className="twl-empty">{c.emptyTier[tm.tier]}</p>
            ) : (
              <ul className="twl-rows">
                {tm.rows.map((row) => (
                  <LayerRow key={row.key} row={row} c={c} open={open === row.key} onOpen={() => setOpen(open === row.key ? "" : row.key)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
