// preview gate: register/login before serving web/dist
// invite code (PREVIEW_INVITE_CODE secret) required to register while WIP
import { handleApi } from "./api.js";
import { json } from "./edge-cache.js";

const COOKIE = "tw_preview";
const SESSION_DAYS = 14;
const PBKDF2_ITERS = 100_000;

/**
 * @param {Request} request
 * @param {Env} env
 * @returns {Promise<Response>}
 */
export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (err) {
      const msg = err && err.message ? String(err.message) : "error";
      console.error("preview_gate", msg);
      return new Response("preview gate failed", { status: 500 });
    }
  },
};

/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/auth" || path === "/auth/") {
    const mode = url.searchParams.get("mode") === "register" ? "register" : "login";
    const next = safeNext(url.searchParams.get("next") || "/");
    return html(authPage(env.APP_NAME || "TermalWave Preview", null, { next, mode }));
  }
  if (path === "/auth/register" && request.method === "POST") {
    return handleRegister(request, env);
  }
  if (path === "/auth/login" && request.method === "POST") {
    return handleLogin(request, env);
  }
  if (path === "/auth/logout") {
    return handleLogout(request, env);
  }

  const session = await readSession(request, env);
  if (!session) {
    // only page loads get the login redirect; a fetch that follows it would
    // receive the login html with status 200 and cache it as data
    const mode = request.headers.get("sec-fetch-mode");
    if (mode && mode !== "navigate") {
      return json({ error: "unauthenticated" }, 401);
    }
    const next = encodeURIComponent(path + url.search);
    return Response.redirect(new URL(`/auth?next=${next}`, url).toString(), 302);
  }

  const api = await handleApi(request, env, ctx);
  if (api) return api;

  if (!env.ASSETS) {
    return new Response("ASSETS binding missing", { status: 500 });
  }
  return withCachePolicy(path, await env.ASSETS.fetch(request));
}

// hashed build output never changes under the same name; everything else
// (index, sw, config, dataset, overlays) must revalidate so a deploy shows up at once
function withCachePolicy(path, res) {
  if (!res.ok) return res;
  const out = new Response(res.body, res);
  out.headers.set(
    "cache-control",
    path.startsWith("/assets/") ? "private, max-age=31536000, immutable" : "private, no-cache",
  );
  return out;
}

/**
 * @typedef {{
 *   ASSETS: Fetcher,
 *   DB: D1Database,
 *   APP_NAME?: string,
 *   PREVIEW_INVITE_CODE?: string,
 *   SESSION_SECRET?: string,
 *   GOOGLE_MAPS_SERVER_API_KEY?: string,
 * }} Env
 */

async function handleRegister(request, env) {
  const form = await request.formData();
  const email = String(form.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") || "");
  const invite = String(form.get("invite") || "");
  const next = safeNext(String(form.get("next") || "/"));

  const inviteNeeded = Boolean(env.PREVIEW_INVITE_CODE);
  if (inviteNeeded && invite !== env.PREVIEW_INVITE_CODE) {
    return html(authPage(env.APP_NAME, "Codigo de invitacion invalido.", { next, mode: "register" }), 400);
  }
  if (!emailLooksOk(email) || password.length < 10) {
    return html(
      authPage(env.APP_NAME, "Email o contraseña invalidos (minimo 10 caracteres).", { next, mode: "register" }),
      400,
    );
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    return html(authPage(env.APP_NAME, "Ese email ya esta registrado. Entra con login.", { next, mode: "login" }), 409);
  }

  const id = crypto.randomUUID();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO users (id, email, pass_salt, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, email, b64(salt), b64(hash), now)
    .run();

  const token = await createSession(env, id);
  return redirectWithSession(request, next, token);
}

async function handleLogin(request, env) {
  const form = await request.formData();
  const email = String(form.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") || "");
  const next = safeNext(String(form.get("next") || "/"));

  const row = await env.DB.prepare("SELECT id, pass_salt, pass_hash FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (!row) {
    return html(authPage(env.APP_NAME, "Email o contraseña incorrectos.", { next, mode: "login" }), 401);
  }

  const salt = fromB64(String(row.pass_salt));
  const expected = fromB64(String(row.pass_hash));
  const got = await hashPassword(password, salt);
  if (!timingSafeEqual(got, expected)) {
    return html(authPage(env.APP_NAME, "Email o contraseña incorrectos.", { next, mode: "login" }), 401);
  }

  const token = await createSession(env, String(row.id));
  return redirectWithSession(request, next, token);
}

async function handleLogout(request, env) {
  const token = cookieValue(request, COOKIE);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
  return redirectWithCookie(new URL("/auth", request.url).toString(), clearCookie());
}

async function readSession(request, env) {
  const token = cookieValue(request, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT user_id, expires_at FROM sessions WHERE token = ?",
  )
    .bind(token)
    .first();
  if (!row) return null;
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  return { userId: String(row.user_id) };
}

async function createSession(env, userId) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expires)
    .run();
  return token;
}

function redirectWithSession(request, next, token) {
  // Response.redirect() is immutable on Workers; build a fresh 302
  const location = new URL(next, request.url).toString();
  return redirectWithCookie(
    location,
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`,
  );
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function redirectWithCookie(location, setCookie) {
  const headers = new Headers({ Location: location, "Set-Cookie": setCookie });
  return new Response(null, { status: 302, headers });
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

function emailLooksOk(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function safeNext(raw) {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

const enc = new TextEncoder();

function b64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    },
  });
}

function authPage(appName, error, opts = {}) {
  const next = opts.next || "/";
  const mode = opts.mode || "login";
  const inviteField =
    mode === "register"
      ? `<label>Codigo de invitacion<input name="invite" autocomplete="off" required /></label>`
      : "";
  const err = error ? `<p class="err">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html lang="es">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(appName)} — acceso</title>
<style>
  :root { color-scheme: dark; --bg:#0b1210; --fg:#e8f0ea; --muted:#9bb0a3; --line:#24332c; --acc:#6bcf8e; --err:#ff8a7a; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; font:15px/1.45 ui-sans-serif, system-ui, sans-serif; background:radial-gradient(1200px 600px at 20% 0%, #143024, var(--bg)); color:var(--fg); }
  main { width:min(420px, calc(100% - 2rem)); border:1px solid var(--line); padding:1.5rem; background:rgba(8,14,12,.72); }
  h1 { margin:0 0 .35rem; font-size:1.25rem; letter-spacing:.02em; }
  p { margin:.4rem 0 1rem; color:var(--muted); }
  form { display:grid; gap:.75rem; }
  label { display:grid; gap:.3rem; font-size:.85rem; color:var(--muted); }
  input { width:100%; padding:.65rem .7rem; border:1px solid var(--line); background:#0a100e; color:var(--fg); border-radius:0; }
  button { padding:.7rem .9rem; border:1px solid var(--acc); background:transparent; color:var(--acc); cursor:pointer; font-weight:600; }
  button:hover { background:rgba(107,207,142,.12); }
  .tabs { display:flex; gap:.5rem; margin-bottom:1rem; }
  .tabs a { color:var(--muted); text-decoration:none; padding:.2rem .1rem; border-bottom:1px solid transparent; }
  .tabs a.on { color:var(--fg); border-color:var(--acc); }
  .err { color:var(--err); margin:0 0 .75rem; }
</style>
<body>
<main>
  <h1>${escapeHtml(appName)}</h1>
  <p>Preview privado. Registrate con el codigo del equipo o entra si ya tenes cuenta.</p>
  <div class="tabs">
    <a class="${mode === "login" ? "on" : ""}" href="/auth?mode=login&next=${encodeURIComponent(next)}">Login</a>
    <a class="${mode === "register" ? "on" : ""}" href="/auth?mode=register&next=${encodeURIComponent(next)}">Registro</a>
  </div>
  ${err}
  <form method="post" action="${mode === "register" ? "/auth/register" : "/auth/login"}">
    <input type="hidden" name="next" value="${escapeHtml(next)}" />
    ${inviteField}
    <label>Email<input name="email" type="email" autocomplete="username" required /></label>
    <label>Contraseña<input name="password" type="password" autocomplete="${mode === "register" ? "new-password" : "current-password"}" minlength="10" required /></label>
    <button type="submit">${mode === "register" ? "Crear cuenta" : "Entrar"}</button>
  </form>
</main>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
