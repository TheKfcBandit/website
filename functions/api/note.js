import { verifyTurnstile, throttled } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (body.website) return new Response(null, { status: 204 });
  const note = String(body.note ?? "").trim();
  if (!note || note.length > 280) return new Response(null, { status: 400 });
  if (!(await verifyTurnstile(body.token, request, env))) return new Response(null, { status: 403 });
  if (throttled(request, "note", 30000)) return new Response(null, { status: 429 });
  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "notes",
      content: note,
      allowed_mentions: { parse: [] },
    }),
  });
  return new Response(null, { status: res.ok ? 204 : 502 });
}
