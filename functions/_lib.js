export async function verifyTurnstile(token, request, env) {
  if (typeof token !== "string" || !token || !env.TURNSTILE_SECRET) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: request.headers.get("cf-connecting-ip"),
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok && (await res.json()).success === true;
  } catch {
    return false;
  }
}

const hits = new Map();

export async function throttled(request, env, key, ms) {
  const ip = request.headers.get("cf-connecting-ip") ?? "?";
  if (env.RATE_LIMITS) {
    // idFromName hashes the visitor key; no IP or message is stored in the object.
    const id = env.RATE_LIMITS.idFromName(`${key}:${ip}`);
    const res = await env.RATE_LIMITS.get(id).fetch(`https://limits/${key}`, {
      method: "POST", signal: AbortSignal.timeout(5000),
    });
    if (res.status === 429) return true;
    if (res.status !== 204) throw new Error("request limits unavailable");
    return false;
  }
  // Only the loopback development server uses in-memory limits.
  if (env.LOCAL_DEV !== true) throw new Error("RATE_LIMITS binding is missing");
  const now = Date.now();
  for (const [id, until] of hits) if (until <= now) hits.delete(id);
  const id = `${key}:${ip}`;
  if ((hits.get(id) ?? 0) > now) return true;
  hits.set(id, now + ms);
  return false;
}
