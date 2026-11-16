import type { CSSProperties } from "react";

// Convierte una cadena CSS en el objeto de estilo de React. Los estilos del
// diseño están escritos como cadenas con valores dinámicos; esto los mantiene
// tal cual en lugar de reescribirlos propiedad por propiedad.
const cache = new Map<string, CSSProperties>();

export function s(str: string): CSSProperties {
  const hit = cache.get(str);
  if (hit) return hit;
  const out: Record<string, string> = {};
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of str) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === ";" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  for (const part of parts) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) continue;
    const key = k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    out[key] = v;
  }
  const result = out as CSSProperties;
  if (cache.size > 4000) cache.clear();
  cache.set(str, result);
  return result;
}
