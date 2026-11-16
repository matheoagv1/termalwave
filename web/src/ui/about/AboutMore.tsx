import React from "react";
import { aboutCopy } from "./copy";
import { MethodsPage } from "./methods/MethodsPage";
import "./about.css";

// Sections appended to the About dialog: NISAR method, references, AI use,
// credits and the code link that the hackathon rules ask for.
export function AboutMore({ lang }: { lang: "en" | "es" }): React.ReactElement {
  const c = aboutCopy(lang);
  return (
    <>
      <MethodsPage lang={lang} />
      <section>
        <h3>{c.nisarTitle}</h3>
        <dl>
          {c.nisar.map(([k, d]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{d}</dd>
            </React.Fragment>
          ))}
        </dl>
        <p className="twa-note">{c.nisarNote}</p>
      </section>
      <section>
        <h3>{c.refsTitle}</h3>
        <ul className="twa-refs">
          {c.refs.map((r) => (
            <li key={r.href}>
              <a className="twa-link" href={r.href} target="_blank" rel="noopener noreferrer">{r.label}</a>
              <span className="twa-sub"> {r.note}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>{c.aiTitle}</h3>
        <p>{c.ai}</p>
      </section>
      <section>
        <h3>{c.creditsTitle}</h3>
        <p className="twa-note">{c.credits}</p>
      </section>
      <section>
        <h3>{c.codeTitle}</h3>
        <a className="twa-link" href={c.code.href} target="_blank" rel="noopener noreferrer">{c.code.label}</a>
      </section>
    </>
  );
}
