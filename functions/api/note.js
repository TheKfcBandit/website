import { verifyTurnstile, throttled } from "../_lib.js";

function fail(status, error) {
  return Response.json({ error }, { status });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad-note");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "bad-note");
  if (body.website) return new Response(null, { status: 204 });
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note || note.length > 280) return fail(400, "bad-note");
  if (!env.DISCORD_WEBHOOK_URL || !env.TURNSTILE_SECRET) return fail(503, "not-configured");
  if (!(await verifyTurnstile(body.token, request, env))) return fail(403, "unverified");
  try {
    if (await throttled(request, env, "note", 30000)) return fail(429, "slow-down");
  } catch { return fail(503, "temporarily-unavailable"); }
  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "notes", content: note, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return new Response(null, { status: 204 });
    return fail(res.status === 429 ? 429 : 502, res.status === 429 ? "slow-down" : "delivery-failed");
  } catch {
    return fail(502, "delivery-failed");
  }
}
