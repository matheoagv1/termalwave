import React from "react";
import { confidenceText, inputsOf, pickLang, str, tierOfMeta, useLayerMeta, type Input, type LayerMeta } from "../about/methods/meta";
import { layerCopy, type LayerCopy } from "./layer-copy";
import "./provenance.css";

type Tier = "raw" | "processed" | "prediction";
type Honesty = "measured" | "derived" | "model" | "inferred" | "example";

export type ProvenanceFacts = {
  id: string;
  tier?: Tier;
  honesty?: Honesty;
  honestyLabel?: string;
  confidence?: number | null;
  date?: string;
  unit?: string;
  range?: string;
  relative?: boolean;
};

// Inputs, falling back to the single source the entry names when it lists none.
export function inputsFor(m: LayerMeta | undefined): Input[] {
  const list = inputsOf(m);
  if (list.length) return list;
  const product = str(m, "product");
  const agency = str(m, "attribution");
  const url = str(m, "source_url");
  return product || agency ? [{ product: product || undefined, agency: agency || undefined, url: /^https?:\/\//.test(url) ? url : undefined }] : [];
}

function InputList({ list, date, c }: { list: Input[]; date: string; c: LayerCopy }): React.ReactElement {
  if (!list.length) return <p className="twp-empty">{c.prov.noInputs}</p>;
  return (
    <ul className="twp-inputs">
      {list.map((x, i) => (
        <li key={`${x.name ?? x.product ?? ""}-${i}`}>
          <span className="twp-in-name">{x.name || x.product}</span>
          {x.agency ? <span className="twp-in-sub">{x.agency}</span> : null}
          {x.product && x.name ? <span className="twp-in-sub">{x.product}</span> : null}
          {x.date || date ? <span className="twp-in-sub">{c.prov.dataDate}: {x.date || date}</span> : null}
          {x.url ? (
            <a className="twp-link" href={x.url} target="_blank" rel="noopener noreferrer">
              {c.prov.link} ↗
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// "How this is made": where a processed or predicted value comes from and how it is concluded.
// Raw layers get only the source block.
export function Provenance({ facts, c }: { facts: ProvenanceFacts; c: LayerCopy }): React.ReactElement {
  const all = useLayerMeta();
  const m = all[facts.id];
  const lang = c.lang;
  const tier: Tier = facts.tier ?? tierOfMeta(m);
  const list = inputsFor(m);
  const date = facts.date ?? "";
  const headId = `twp-h-${facts.id}`;

  if (tier === "raw") {
    return (
      <section className="twp" aria-labelledby={headId}>
        <h4 id={headId} className="twp-h">{c.prov.sourceTitle}</h4>
        <InputList list={list} date={date} c={c} />
      </section>
    );
  }

  const method = pickLang(m, "method", lang);
  const formula = str(m, "formula");
  const meaning = pickLang(m, "meaning", lang) || pickLang(m, "what", lang);
  const unit = facts.unit ?? str(m, "unit");
  const range = facts.range ?? (Array.isArray(m?.range) ? (m?.range as unknown[]).join(" to ") : str(m, "range"));
  const caveats = pickLang(m, "caveats", lang);
  const conf = facts.confidence != null ? `${Math.round(facts.confidence * 100)} %` : confidenceText(m);
  const confProp = str(m, "confidence_prop");
  const honesty = facts.honesty ?? ((str(m, "honesty") || (tier === "prediction" ? "model" : "derived")) as Honesty);

  return (
    <section className="twp" aria-labelledby={headId}>
      <h4 id={headId} className="twp-h">{c.prov.title}</h4>
      <ol className="twp-steps">
        <li>
          <span className="twp-k">{c.prov.inputs}</span>
          <InputList list={list} date={date} c={c} />
        </li>
        <li>
          <span className="twp-k">{c.prov.method}</span>
          {method ? <p>{method}</p> : !formula ? <p className="twp-empty">{c.prov.noMethod}</p> : null}
          {formula ? (
            <p>
              <span className="twp-in-sub">{c.prov.formula}</span>
              <code className="twl-code">{formula}</code>
            </p>
          ) : null}
        </li>
        <li>
          <span className="twp-k">{c.prov.meaning}</span>
          {meaning ? <p>{meaning}</p> : null}
          <p className="twp-in-sub">
            {facts.relative || !unit ? c.prov.relative : c.prov.unitIs(unit)} {range && !facts.relative ? c.prov.rangeIs(range) : ""}
          </p>
        </li>
        {tier === "prediction" ? (
          <li>
            <span className="twp-k">{c.prov.confidence}{conf ? `: ${conf}` : ""}</span>
            <p>{confProp ? c.prov.confPerPixel : conf ? c.prov.confFixed : c.prov.confNone}</p>
          </li>
        ) : null}
        {caveats ? (
          <li>
            <span className="twp-k">{c.prov.limits}</span>
            <p>{caveats}</p>
          </li>
        ) : null}
        <li>
          <span className="twp-k">{c.prov.honesty}</span>
          <p>
            <span className={`twl-badge twl-badge--${honesty}`}>{facts.honestyLabel ?? honesty.toUpperCase()}</span>{" "}
            {c.honestyHelp[honesty] ?? ""}
          </p>
        </li>
      </ol>
    </section>
  );
}

// Inspector card entry: a disclosure, so the card stays short until someone asks.
export function ProvenanceCard({ id, lang }: { id: string; lang: "en" | "es" }): React.ReactElement | null {
  const c = layerCopy(lang);
  if (!id) return null;
  return (
    <details className="twp-card">
      <summary className="twp-sum">{c.prov.open}</summary>
      <Provenance c={c} facts={{ id }} />
    </details>
  );
}
