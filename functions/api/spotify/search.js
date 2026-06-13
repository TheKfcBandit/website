import { spotifyToken, throttled } from "../../_lib.js";

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).hostname !== "thekfcbandit.ca" && new URL(origin).hostname !== "localhost") {
    return new Response(null, { status: 403 });
  }
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q || q.length > 100) return new Response(null, { status: 400 });
  if (throttled(request, "search", 1500)) return new Response(null, { status: 429 });
  try {
    const token = await spotifyToken(env);
    const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=5&q=${encodeURIComponent(q)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    return Response.json(d.tracks.items.map(t => ({
      uri: t.uri,
      name: t.name,
      artist: t.artists.map(a => a.name).join(", "),
      art: t.album.images.at(-1)?.url ?? "",
    })));
  } catch {
    return new Response(null, { status: 502 });
  }
}
