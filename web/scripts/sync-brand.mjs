// Copia el kit de marca de brand/ (fuente unica, del VPS) a web/public/brand/.
// No se duplica a mano: este script corre antes de dev y de build.
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "web", "public", "brand");
const files = [
  "wordmark/termal-wave-dark.png",
  "wordmark/termal-wave-light.png",
  "icon/favicon.ico",
  "icon/icon-32.png",
  "icon/apple-touch-icon.png",
  "pwa/icon-192.png",
  "pwa/icon-512.png",
  "pwa/maskable-512.png",
  "fonts/PressStart2P-Regular.ttf",
  "monigote/monigote.png",
  "social/og-1200x630.png",
  "social/og-1200x630-en.png",
];

mkdirSync(out, { recursive: true });
let missing = 0;
for (const rel of files) {
  const from = join(root, "brand", rel);
  if (!existsSync(from)) {
    console.warn(`brand: falta ${rel}`);
    missing += 1;
    continue;
  }
  const dest = join(out, rel.split("/").pop());
  // Se borra antes de copiar: sobrescribir un archivo de otro usuario falla con EPERM.
  rmSync(dest, { force: true });
  copyFileSync(from, dest);
}
console.log(`brand: ${files.length - missing} archivos en web/public/brand`);
