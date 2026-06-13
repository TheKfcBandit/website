import { spotifyToken, verifyTurnstile, throttled } from "../../_lib.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!/^spotify:track:[A-Za-z0-9]{22}$/.test(body.uri ?? "")) return new Response(null, { status: 400 });
  if (!(await verifyTurnstile(body.token, request, env))) return new Response(null, { status: 403 });
  if (throttled(request, "suggest", 15000)) return new Response(null, { status: 429 });
  try {
    const auth = { authorization: `Bearer ${await spotifyToken(env)}` };
    const queued = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${body.uri}`, {
      method: "POST",
      headers: auth,
    });
    if (queued.ok) return Response.json({ queued: true });
    const listed = await fetch(`https://api.spotify.com/v1/playlists/${env.SPOTIFY_PLAYLIST_ID}/tracks`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ uris: [body.uri] }),
    });
    return listed.ok ? Response.json({ playlisted: true }) : new Response(null, { status: 502 });
  } catch {
    return new Response(null, { status: 502 });
  }
}
