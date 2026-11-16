// La URL es el estado: #c=territory&l=suelo&t=m-2024-03&...
export function hashParams(): Record<string, string> {
  const out: Record<string, string> = {};
  (location.hash || "")
    .replace(/^#/, "")
    .split("&")
    .forEach((part) => {
      if (!part) return;
      const i = part.indexOf("=");
      const key = part.slice(0, i < 0 ? part.length : i);
      out[key] = i < 0 ? "" : decodeURIComponent(part.slice(i + 1));
    });
  return out;
}
