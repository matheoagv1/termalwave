// Fails when en/es catalogs drift, or when a tsx file shows raw text.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const root = join(import.meta.dirname, "..");
const src = join(root, "web", "src");

const { T: esT } = await import(pathToFileURL(join(src, "tw", "catalog.es-AR.js")).href);
const { T: enT } = await import(pathToFileURL(join(src, "context", "locales", "en.ts")).href);
const { es } = await import(pathToFileURL(join(src, "context", "locales", "es.ts")).href);
const { en } = await import(pathToFileURL(join(src, "context", "locales", "en.ts")).href);

const problems = [];

function walk(a, b, path) {
  const ak = a && typeof a === "object" ? Object.keys(a) : null;
  const bk = b && typeof b === "object" ? Object.keys(b) : null;
  if (!ak || !bk) {
    if ((ak && !bk) || (!ak && bk)) problems.push(`type mismatch at ${path}`);
    return;
  }
  const keys = new Set([...ak, ...bk]);
  for (const key of keys) {
    const next = path ? `${path}.${key}` : key;
    if (!(key in a)) problems.push(`missing in es: ${next}`);
    else if (!(key in b)) problems.push(`missing in en: ${next}`);
    else if (typeof a[key] === "object" && a[key] && !Array.isArray(a[key])) walk(a[key], b[key], next);
  }
}

walk(esT, enT, "T");
walk(es, en, "flat");

const textRe = />\s*([^<>{}]*[A-Za-zÁÉÍÓÚáéíóúñ]{3,}[^<>{}]*)\s*</;
const attrRe = /\b(?:aria-label|title|placeholder)="([^"]*[A-Za-zÁÉÍÓÚáéíóúñ]{3,}[^"]*)"/g;

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

for (const file of files(src)) {
  const body = readFileSync(file, "utf8");
  const rel = relative(root, file);
  for (const line of body.split("\n")) {
    const hit = line.match(textRe);
    if (hit && !/[()=?;]/.test(hit[1])) problems.push(`${rel}: text ${hit[1].trim()}`);
    for (const attr of line.matchAll(attrRe)) problems.push(`${rel}: attr ${attr[1]}`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("i18n-check: ok");
