import { throttled } from "../_lib.js";

let token = null;
let expires = 0;

async function appToken(env) {
  if (token && Date.now() < expires) return token;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  token = data.access_token;
  expires = Date.now() + (data.expires_in - 60) * 1000;
  return token;
}

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  const empty = new Response("[]", { headers: { "content-type": "application/json" } });
  if (!q || q.length > 100) return empty;
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return new Response(null, { status: 503 });
  if (throttled(request, "search", 200)) return new Response(null, { status: 429 });

  try {
    const key = await appToken(env);
    if (!key) return new Response(null, { status: 502 });

    const url = `https://api.spotify.com/v1/search?type=track&limit=3&market=CA&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
    if (res.status === 401) {
      token = null;
      return new Response(null, { status: 502 });
    }
    if (!res.ok) return new Response(null, { status: res.status === 429 ? 429 : 502 });

    const items = (await res.json()).tracks?.items ?? [];
    const out = items.filter(t => t?.uri && t?.name).map(t => ({
      uri: t.uri,
      name: t.name,
      artist: (t.artists ?? []).map(a => a.name).join(", "),
      art: t.album?.images?.at(-1)?.url ?? "",
    }));
    return new Response(JSON.stringify(out), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
