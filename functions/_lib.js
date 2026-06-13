let spotify = { token: "", exp: 0 };

export async function spotifyToken(env) {
  if (spotify.exp > Date.now()) return spotify.token;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: "Basic " + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: env.SPOTIFY_REFRESH_TOKEN }),
  });
  if (!res.ok) throw new Error(res.status);
  const d = await res.json();
  spotify = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return spotify.token;
}

export async function verifyTurnstile(token, request, env) {
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET,
      response: token,
      remoteip: request.headers.get("cf-connecting-ip"),
    }),
  });
  return (await res.json()).success === true;
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
