import { verifyTurnstile, throttled } from "../_lib.js";

const URI = /^spotify:track:[A-Za-z0-9]{22}$/;

let token = null;
let expires = 0;

async function userToken(env) {
  if (token && Date.now() < expires) return token;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  token = data.access_token;
  expires = Date.now() + (data.expires_in - 60) * 1000;
  return token;
}

function fail(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad-request");
  }
  if (!body || typeof body !== "object" || !URI.test(String(body.uri ?? ""))) return fail(400, "bad-uri");
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_REFRESH_TOKEN) return fail(503, "reauth-needed");
  if (!(await verifyTurnstile(body.token, request, env))) return fail(403, "unverified");
  if (throttled(request, "queue", 60000)) return fail(429, "slow-down");

  try {
    const key = await userToken(env);
    if (!key) return fail(503, "reauth-needed");

    const res = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(body.uri)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return new Response(null, { status: 204 });
    if (res.status === 404) return fail(409, "not-playing");
    if (res.status === 403) return fail(409, "forbidden");
    if (res.status === 429) return fail(429, "slow-down");
    if (res.status === 401) {
      token = null;
      return fail(503, "reauth-needed");
    }
    return fail(502, "spotify-error");
  } catch {
    return fail(502, "spotify-error");
  }
}
