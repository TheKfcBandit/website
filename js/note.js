import { getToken } from "./turnstile.js";

const MESSAGES = {
  400: "that didn't look right",
  403: "couldn't verify you",
  429: "one message a minute, please",
  502: "couldn't deliver that",
};

export function initNote(back) {
  const form = back.querySelector(".note");
  const who = form.querySelector(".who");
  const body = form.querySelector("textarea");
  const send = form.querySelector(".send");
  const count = form.querySelector(".count");
  const trap = form.querySelector('input[name="website"]');
  const limit = Number(body.getAttribute("maxlength")) || 280;

  function sync() {
    const left = limit - body.value.length;
    count.textContent = String(left);
    count.toggleAttribute("data-low", left <= 20);
    if (!send.dataset.state) send.disabled = !body.value.trim();
  }

  function reset() {
    form.reset();
    delete send.dataset.state;
    send.removeAttribute("title");
    sync();
  }

  body.addEventListener("input", () => {
    if (send.dataset.state) {
      delete send.dataset.state;
      send.removeAttribute("title");
    }
    sync();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const note = body.value.trim();
    if (!note) return;
    send.disabled = true;
    send.dataset.state = "sending";
    send.removeAttribute("title");
    let status = 0;
    try {
      const token = await getToken();
      const res = await fetch("/api/note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note, name: who.value.trim(), website: trap.value, token }),
      });
      status = res.status;
    } catch {}
    const ok = status === 204;
    send.dataset.state = ok ? "ok" : "err";
    if (!ok) send.title = MESSAGES[status] ?? "couldn't send that";
    setTimeout(() => {
      if (ok) reset();
      else {
        delete send.dataset.state;
        send.removeAttribute("title");
        sync();
      }
    }, ok ? 1400 : 1800);
  });

  sync();
  return { reset };
}
