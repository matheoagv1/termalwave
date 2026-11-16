import React from "react";
import type { LayerCopy } from "./layer-copy";
import type { LayerRowModel } from "./layer-model";
import { Provenance } from "./Provenance";

type P = { id: string; row: LayerRowModel; c: LayerCopy };

function Field({ k, children }: { k: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="twl-field">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function LayerDetail({ id, row, c }: P): React.ReactElement {
  const d = row.detail;
  return (
    <div id={id} className="twl-detail">
      {d.note ? <p className="twl-note" role="note">{d.note}</p> : null}
      <dl className="twl-fields">
        {d.what ? <Field k={c.what}>{d.what}</Field> : null}
        {d.decision ? <Field k={c.decision}>{d.decision}</Field> : null}
        {d.nodata ? <Field k={c.nodata}>{d.nodata}</Field> : null}
        {d.caveats ? <Field k={c.caveats}>{d.caveats}</Field> : null}
        {d.grad ? (
          <Field k={c.scale}>
            <span className="twl-ramp" aria-hidden="true" style={{ background: d.grad }} />
            <span className="twl-ramp-ends">
              <span>{d.min}</span>
              <span>{d.max}</span>
            </span>
            {d.rampNote ? <span className="twl-sub">{d.rampNote}</span> : null}
          </Field>
        ) : null}
        {d.unit ? <Field k={c.unit}>{d.unit}</Field> : null}
        {d.range ? <Field k={c.range}>{d.range}</Field> : null}
        {d.formula ? <Field k={c.formula}><code className="twl-code">{d.formula}</code></Field> : null}
        {d.product ? <Field k={c.source}>{d.product}</Field> : null}
        {d.date ? <Field k={c.date}>{d.date}</Field> : null}
        <Field k={c.honesty}>
          <span className={`twl-badge twl-badge--${row.honesty}`}>{row.honestyLabel}</span>{" "}
          {c.honestyHelp[row.honesty]}
        </Field>
        {d.list.length > 0 || d.listNote ? (
          <Field k={c.passesList}>
            {d.list.map((p) => <span key={p.id} className="twl-pass">{p.line}</span>)}
            {d.listNote ? <span className="twl-sub">{d.listNote}</span> : null}
          </Field>
        ) : null}
      </dl>
      <Provenance c={c} facts={{ id: row.id, tier: row.tier, honesty: row.honesty, honestyLabel: row.honestyLabel, confidence: row.confidence, date: d.date, unit: d.unit, range: d.range, relative: d.relative }} />
    </div>
  );
}
