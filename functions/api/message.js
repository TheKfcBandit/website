export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (body.website) return new Response(null, { status: 204 });
  const message = String(body.message ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!message || message.length > 1000 || name.length > 80) {
    return new Response(null, { status: 400 });
  }
  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: name || "website",
      content: message,
      allowed_mentions: { parse: [] },
    }),
  });
  return new Response(null, { status: res.ok ? 204 : 502 });
}
