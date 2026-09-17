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

export function throttled(request, key, ms) {
  const ip = request.headers.get("cf-connecting-ip") ?? "?";
  const now = Date.now();
  if (now - (hits.get(`${key}:${ip}`) ?? 0) < ms) return true;
  if (hits.size > 1000) hits.clear();
  hits.set(`${key}:${ip}`, now);
  return false;
}
