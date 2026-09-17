const SITEKEY = "0x4AAAAAAABTM1I_DEeNiW-I";

let widgetId;
let pending;
let loader;

function finish(error, token) {
  if (!pending) return;
  const current = pending;
  pending = null;
  clearTimeout(current.timeout);
  if (error) current.reject(error);
  else current.resolve(token);
}

function load() {
  loader ??= new Promise((ok, fail) => {
    window.tsReady = () => {
      widgetId = turnstile.render("#ts", {
        sitekey: SITEKEY,
        execution: "execute",
        callback: token => finish(null, token),
        "error-callback": () => finish(new Error("verification failed")),
        "expired-callback": () => finish(new Error("verification expired")),
        "timeout-callback": () => finish(new Error("verification timed out")),
      });
      ok();
    };
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=tsReady";
    s.onerror = () => {
      s.remove();
      loader = null;
      fail(new Error());
    };
    document.head.append(s);
  });
  return loader;
}

export async function getToken() {
  await load();
  if (pending) throw new Error("verification already pending");
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    pending.timeout = setTimeout(() => finish(new Error("verification timed out")), 30000);
    try {
      turnstile.reset(widgetId);
      turnstile.execute(widgetId);
    } catch (error) {
      finish(error);
    }
  });
}
