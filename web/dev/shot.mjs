// dev-only: node dev/shot.mjs ('/' for the app, else harness query) 'layers=sky&z=1.3' /tmp/out.png [eval-js]
// needs `npx vite --port 5199` running in web/. waits for body[data-ready], prints console + eval result
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [query = "", out = "/tmp/space.png", evalJs] = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "shot-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0; const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.consoleAPICalled") console.log("console:", m.params.args.map((a) => a.value ?? a.description).join(" "));
  if (m.method === "Runtime.exceptionThrown") console.log("exception:", m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: query.startsWith("/") ? `http://localhost:5199${query}` : `http://localhost:5199/dev/space.html?${query}` });
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  const r = await cdp("Runtime.evaluate", { expression: query.startsWith("/") ? "!!document.querySelector('.maplibregl-canvas') && performance.now() > 9000" : "document.body?.dataset.ready === '1'", returnByValue: true });
  if (r.result?.result?.value) break;
  await sleep(300);
}
if (evalJs) console.log("eval:", JSON.stringify((await cdp("Runtime.evaluate", { expression: evalJs, awaitPromise: true, returnByValue: true })).result?.result?.value));
const shot = await cdp("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log("wrote", out);
ws.close(); chrome.kill();
process.exit(0);
