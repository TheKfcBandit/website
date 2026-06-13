const SITEKEY = "0x4AAAAAAABTM1I_DEeNiW-I";

let widgetId;
let pending;
let loader;

function load() {
  loader ??= new Promise(ok => {
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
    document.head.append(s);
  });
  return loader;
}

export async function getToken() {
  await load();
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    turnstile.reset(widgetId);
    turnstile.execute(widgetId);
  });
}
