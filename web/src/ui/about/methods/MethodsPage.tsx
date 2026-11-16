import React from "react";
import { layerCopy } from "../../layers/layer-copy";
import { inputsFor } from "../../layers/Provenance";
import { pickLang, str, tierOfMeta, useLayerMeta, type LayerMeta } from "./meta";
import "./methods.css";

const TIERS = ["raw", "processed", "prediction"] as const;

const T = {
  en: { title: "Data and methods", lead: "Every layer of this build: its type, the data it uses and how its value is made. Generated from the same records the layers panel reads.", none: "No layer in this group.", method: "Method", inputs: "Inputs", noMethod: "Shown as received from the source." },
  es: { title: "Datos y métodos", lead: "Todas las capas de esta versión: su tipo, los datos que usa y cómo se calcula su valor. Se genera con los mismos registros que lee el panel de capas.", none: "No hay capas en este grupo.", method: "Método", inputs: "Datos de entrada", noMethod: "Se muestra tal como llega de la fuente." },
};

function Row({ m, lang }: { m: LayerMeta; lang: "en" | "es" }): React.ReactElement {
  const c = layerCopy(lang);
  const t = T[lang];
  const tier = tierOfMeta(m);
  const method = pickLang(m, "method", lang);
  const formula = str(m, "formula");
  const honesty = str(m, "honesty");
  const inputs = inputsFor(m);
  return (
    <li className="twm-row">
      <span className="twm-name">
        {pickLang(m, "label", lang) || m.id}
        {honesty ? <span className={`twl-badge twl-badge--${honesty}`}>{honesty.toUpperCase()}</span> : null}
      </span>
      <span className="twm-k">{t.inputs}</span>
      <span>
        {inputs.length
          ? inputs.map((x, i) => (
              <React.Fragment key={i}>
                {i ? "; " : ""}
                {x.url ? (
                  <a className="twa-link" href={x.url} target="_blank" rel="noopener noreferrer">{[x.name || x.product, x.agency].filter(Boolean).join(", ")}</a>
                ) : (
                  [x.name || x.product, x.agency].filter(Boolean).join(", ")
                )}
              </React.Fragment>
            ))
          : c.prov.noInputs}
      </span>
      <span className="twm-k">{t.method}</span>
      <span>
        {method || (tier === "raw" ? t.noMethod : !formula ? c.prov.noMethod : "")}
        {formula ? <code className="twm-code">{formula}</code> : null}
      </span>
    </li>
  );
}

// One page that lists every layer with tier, inputs and method; no hand-written copy of the records.
export function MethodsPage({ lang }: { lang: "en" | "es" }): React.ReactElement {
  const all = useLayerMeta();
  const c = layerCopy(lang);
  const t = T[lang];
  const rows = Object.values(all);
  return (
    <section>
      <details className="twm">
        <summary className="twm-sum">{t.title}</summary>
        <p className="twa-note">{t.lead}</p>
        {TIERS.map((tier) => {
          const own = rows.filter((m) => tierOfMeta(m) === tier);
          return (
            <div key={tier} className="twm-tier">
              <h4 className="twm-tier-h">{c.tier[tier]}</h4>
              <p className="twa-sub">{c.tierLead[tier]}</p>
              {own.length ? (
                <ul className="twm-list">{own.map((m) => <Row key={m.id} m={m} lang={lang} />)}</ul>
              ) : (
                <p className="twa-sub">{tier === "prediction" ? c.emptyTier.prediction : t.none}</p>
              )}
            </div>
          );
        })}
      </details>
    </section>
  );
}
