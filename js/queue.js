import { getToken } from "./turnstile.js";

const cache = new Map();

const MESSAGES = {
  "not-playing": "nothing's playing right now",
  "slow-down": "one song a minute, please",
  unverified: "couldn't verify you",
  "reauth-needed": "spotify needs reconnecting",
  forbidden: "spotify wouldn't take that",
};

export function initQueue(player, toast) {
  const button = player.querySelector(".queue");
  const form = player.querySelector(".find");
  const input = form.querySelector("input");
  const send = form.querySelector(".send");
  const list = form.querySelector(".results");

  let results = [];
  let picked = null;
  let active = -1;
  let timer = 0;
  let controller = null;
  let seq = 0;
  let deleting = false;

  function clear() {
    input.value = "";
    results = [];
    picked = null;
    active = -1;
    list.replaceChildren();
    send.disabled = true;
    controller?.abort();
  }

  function open(next) {
    const on = next ?? form.hidden;
    form.hidden = !on;
    button.setAttribute("aria-expanded", String(on));
    if (on) input.focus();
    else clear();
  }

  function pick(i) {
    active = i;
    picked = results[i] ?? null;
    send.disabled = !picked;
    list.querySelectorAll("button").forEach((b, n) => b.setAttribute("aria-selected", String(n === i)));
  }

  function render() {
    list.replaceChildren(...results.map((t, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const img = document.createElement("img");
      img.alt = "";
      if (t.art) img.src = t.art;
      const name = document.createElement("span");
      name.className = "n";
      name.textContent = t.name;
      const artist = document.createElement("span");
      artist.className = "a";
      artist.textContent = t.artist;
      b.append(img, name, artist);
      b.addEventListener("click", () => {
        pick(i);
        input.value = t.name;
        input.focus();
      });
      li.append(b);
      return li;
    }));
    if (results.length) pick(0);
    else {
      picked = null;
      send.disabled = true;
    }
  }

  function autofill(q) {
    const top = results[0]?.name;
    if (deleting || !top || input.value !== q) return;
    if (!top.toLowerCase().startsWith(q.toLowerCase()) || top.length === q.length) return;
    input.value = top;
    input.setSelectionRange(q.length, top.length);
  }

  async function search(q) {
    if (cache.has(q)) {
      results = cache.get(q);
      render();
      autofill(q);
      return;
    }
    controller?.abort();
    controller = new AbortController();
    const mine = ++seq;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      if (!res.ok || mine !== seq) return;
      const data = await res.json();
      if (cache.size > 40) cache.clear();
      cache.set(q, data);
      results = data;
      render();
      autofill(q);
    } catch {}
  }

  button.addEventListener("click", () => open());

  input.addEventListener("beforeinput", e => {
    deleting = !!e.inputType?.startsWith("delete");
  });

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(timer);
    picked = null;
    send.disabled = true;
    if (!q) {
      results = [];
      list.replaceChildren();
      return;
    }
    timer = setTimeout(() => search(q), 250);
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      open(false);
      button.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (!results.length) return;
    e.preventDefault();
    const n = results.length;
    pick((((active + (e.key === "ArrowDown" ? 1 : -1)) % n) + n) % n);
    input.value = results[active].name;
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!picked) return;
    const track = picked;
    open(false);
    try {
      const token = await getToken();
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uri: track.uri, token }),
      });
      if (res.ok) {
        toast(`queued ${track.name}`, "ok");
        return;
      }
      const data = await res.json().catch(() => ({}));
      toast(MESSAGES[data.error] ?? "couldn't queue that", "error");
    } catch {
      toast("couldn't queue that", "error");
    }
  });

  return {
    playing(on) {
      button.hidden = !on;
      if (!on) open(false);
    },
  };
}
