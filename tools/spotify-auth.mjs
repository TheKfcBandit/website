// One-time local helper. Prints a Spotify refresh token for the queue endpoint.
// Nothing is sent anywhere except to Spotify, and nothing is written to disk.
//
//   node tools/spotify-auth.mjs
//
// Add http://127.0.0.1:8888/callback as a redirect URI on your app first.

import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";

const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "user-modify-playback-state";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const id = (await rl.question("client id: ")).trim();
const secret = (await rl.question("client secret: ")).trim();
rl.close();

if (!id || !secret) {
  console.error("both are required");
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

console.log("\nopen this and approve:\n");
console.log(authorize);
console.log("\nwaiting for the callback...");

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    if (url.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    const done = (message, value, error) => {
      res.writeHead(200, { "content-type": "text/plain" }).end(message);
      server.close();
      error ? reject(error) : resolve(value);
    };
    if (url.searchParams.get("state") !== state) return done("state mismatch", null, new Error("state mismatch"));
    const err = url.searchParams.get("error");
    if (err) return done(`denied: ${err}`, null, new Error(err));
    done("done, close this tab", url.searchParams.get("code"));
  });
  server.listen(PORT, "127.0.0.1");
});

const res = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT,
  }),
});

if (!res.ok) {
  console.error(`\ntoken exchange failed: ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
console.log("\nadd these to cloudflare pages -> settings -> environment variables:\n");
console.log(`SPOTIFY_CLIENT_ID      ${id}`);
console.log(`SPOTIFY_CLIENT_SECRET  ${secret}`);
console.log(`SPOTIFY_REFRESH_TOKEN  ${data.refresh_token}`);
console.log("\nthe refresh token lasts about six months, then rerun this.");
