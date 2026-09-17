// Zero-dependency local dev server: serves the static site AND runs the real
// Cloudflare Functions in functions/, reading secrets from .dev.vars.
// No wrangler, no native deps.  Run:  npm run dev
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 5050);

function loadEnv() {
  const env = { LOCAL_DEV: true };
  const f = join(root, ".dev.vars");
  if (!existsSync(f)) return env;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg",
  ".svg":"image/svg+xml", ".mjs":"text/javascript", ".md":"text/plain" };

function collect(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path;
  try { path = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400).end("bad path"); return; }

  // API routes -> real functions/ modules
  if (path.startsWith("/api/")) {
    const name = path.slice(5).replace(/[^a-z0-9_-]/gi, "");
    const file = join(root, "functions", "api", `${name}.js`);
    if (!existsSync(file)) { res.writeHead(404).end("no function"); return; }
    try {
      const mod = await import(pathToFileURL(file).href);
      const handler = { GET: mod.onRequestGet, POST: mod.onRequestPost }[req.method];
      if (!handler) { res.writeHead(405).end("no handler"); return; }
      const body = req.method === "GET" ? undefined : await collect(req);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      headers.set("cf-connecting-ip", req.socket.remoteAddress || "127.0.0.1");
      const request = new Request(url.href, { method: req.method, headers, body: body?.length ? body : undefined });
      const out = await handler({ request, env: loadEnv() });
      const text = await out.text();
      const h = {}; out.headers.forEach((v, k) => h[k] = v);
      res.writeHead(out.status, h).end(text);
    } catch (e) {
      console.error("function error:", e);
      res.writeHead(500).end("function threw");
    }
    return;
  }

  // static files
  let p = path.endsWith("/") ? path + "index.html" : path;
  if (p.includes("..") || !(p === "/index.html" || p === "/404.html" || p === "/style.css" || p.startsWith("/assets/") || p.startsWith("/js/"))) {
    res.writeHead(404).end("not found"); return;
  }
  const file = join(root, p);
  try {
    if ((await stat(file)).isDirectory()) throw 0;
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`dev server on http://127.0.0.1:${server.address().port}`));
