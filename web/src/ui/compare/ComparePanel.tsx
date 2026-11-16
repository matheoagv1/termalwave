import React from "react";
import "./compare.css";

type Compare = {
  date: string;
  image: string;
  collection?: string;
  maturity?: string;
  landsat?: { layer?: string; date?: string; cloud_cover_pct?: number };
};

type Lang = "en" | "es";

const COPY: Record<Lang, { title: string; radar: string; optical: string; radarLine: string; opticalLine: string; noOptical: string; alt: string }> = {
  en: {
    title: "Radar vs optical: Sahara",
    radar: "NISAR, L-band radar",
    optical: "Landsat HLS, optical",
    radarLine: "L-band radar can see through dry sand and shows buried landforms.",
    opticalLine: "Optical imagery shows the surface colour only.",
    noOptical: "Optical image not in the data yet.",
    alt: "Sahara scene",
  },
  es: {
    title: "Radar vs óptico: Sahara",
    radar: "NISAR, radar en banda L",
    optical: "Landsat HLS, óptico",
    radarLine: "El radar en banda L atraviesa la arena seca y muestra formas de relieve enterradas.",
    opticalLine: "La imagen óptica muestra solo el color de la superficie.",
    noOptical: "Imagen óptica no incluida en los datos todavía.",
    alt: "Escena del Sahara",
  },
};

// the json paths start with "/"; the app may be served from a sub-path, so keep them relative
const rel = (p: string): string => "./" + p.replace(/^\/+/, "");

export function ComparePanel({ lang }: { lang: Lang }): React.ReactElement | null {
  const [data, setData] = React.useState<Compare | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch("./insar/sahara_compare.json")
      .then((r) => (r.ok ? (r.json() as Promise<Compare>) : null))
      .then((d) => {
        if (live && d) setData(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!data) return null;
  const c = COPY[lang];
  const optDate = data.landsat?.date ?? "";
  return (
    <section className="twc">
      <h3>{c.title}</h3>
      <div className="twc-pair">
        <figure className="twc-fig">
          <img src={rel(data.image)} alt={c.alt} />
          <figcaption>
            <strong>{c.radar}</strong>
            <span className="twc-date">{data.date}</span>
            <span>{c.radarLine}</span>
          </figcaption>
        </figure>
        <figure className="twc-fig">
          <div className="twc-blank">{c.noOptical}</div>
          <figcaption>
            <strong>{c.optical}</strong>
            <span className="twc-date">{optDate}</span>
            <span>{c.opticalLine}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}