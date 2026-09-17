// One-time helper to get a Spotify refresh token for the queue endpoint.
// Reads SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET from .dev.vars (or prompts if
// run interactively), runs the OAuth consent flow on 127.0.0.1:8888, and writes
// SPOTIFY_REFRESH_TOKEN back into .dev.vars. Nothing is sent anywhere but Spotify.
//
//   node tools/spotify-auth.mjs
//
// Add http://127.0.0.1:8888/callback as a redirect URI on your Spotify app first.

import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const varsPath = join(root, ".dev.vars");
const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "user-modify-playback-state";

function loadVars() {
  const e = {};
  if (existsSync(varsPath)) {
    for (const l of readFileSync(varsPath, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return e;
}

function saveVar(key, value) {
  let lines = existsSync(varsPath) ? readFileSync(varsPath, "utf8").split(/\r?\n/) : [];
  let found = false;
  lines = lines.map(l => (new RegExp(`^\\s*${key}\\s*=`).test(l) ? (found = true, `${key}=${value}`) : l));
  if (!found) lines.push(`${key}=${value}`);
  writeFileSync(varsPath, lines.filter((l, i) => l !== "" || i < lines.length - 1).join("\n").replace(/\n+$/, "") + "\n");
}

const vars = loadVars();
let id = vars.SPOTIFY_CLIENT_ID;
let secret = vars.SPOTIFY_CLIENT_SECRET;

if ((!id || !secret) && process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (!id) id = (await rl.question("client id: ")).trim();
  if (!secret) secret = (await rl.question("client secret: ")).trim();
  rl.close();
}
if (!id || !secret) {
  console.error("missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .dev.vars");
  process.exit(1);
}

const state = randomBytes(16).toString("hex");
const authorize = `https://accounts.spotify.com/authorize?${new URLSearchParams({
  client_id: id,
  response_type: "code",
  redirect_uri: REDIRECT,
  scope: SCOPE,
  state,
})}`;

console.log("AUTHORIZE_URL " + authorize);
console.log("waiting for approval...");

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    if (url.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    const done = (msg, val, err) => {
      res.writeHead(200, { "content-type": "text/plain" }).end(msg);
      server.close();
      err ? reject(err) : resolve(val);
    };
    if (url.searchParams.get("state") !== state) return done("state mismatch", null, new Error("state mismatch"));
    const err = url.searchParams.get("error");
    if (err) return done(`denied: ${err}`, null, new Error(err));
    done("done — you can close this tab", url.searchParams.get("code"));
  });
  server.listen(PORT, "127.0.0.1");
});

const res = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
  },
  body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT }),
});

if (!res.ok) {
  console.error(`token exchange failed: ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
saveVar("SPOTIFY_CLIENT_ID", id);
saveVar("SPOTIFY_CLIENT_SECRET", secret);
saveVar("SPOTIFY_REFRESH_TOKEN", data.refresh_token);
console.log("REFRESH_TOKEN_SAVED");

if (process.stdout.isTTY) {
  console.log("\nsaved to .dev.vars. for Cloudflare, add these three to the website project:");
  console.log("SPOTIFY_CLIENT_ID      " + id);
  console.log("SPOTIFY_CLIENT_SECRET  " + secret);
  console.log("SPOTIFY_REFRESH_TOKEN  " + data.refresh_token);
}
