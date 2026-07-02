const SITEKEY = "0x4AAAAAAABTM1I_DEeNiW-I";

let widgetId;
let pending;
let loader;

function load() {
  loader ??= new Promise((ok, fail) => {
    window.tsReady = () => {
      widgetId = turnstile.render("#ts", {
        sitekey: SITEKEY,
        execution: "execute",
        callback: token => pending?.resolve(token),
        "error-callback": () => pending?.reject(new Error()),
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
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    setTimeout(() => reject(new Error()), 30000);
    turnstile.reset(widgetId);
    turnstile.execute(widgetId);
  });
}
