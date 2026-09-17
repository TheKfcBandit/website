import { getToken } from "./turnstile.js";

const MESSAGES = {
  "not-playing": "nothing's playing right now",
  "slow-down": "one song a minute, please",
  unverified: "couldn't verify you — try again",
  "reauth-needed": "spotify needs reconnecting",
  forbidden: "spotify wouldn't take that",
  "temporarily-unavailable": "queue is temporarily unavailable — try again shortly",
};

export function initQueue(player, { verify = getToken } = {}) {
  const button = player.querySelector(".queue");
  const form = player.querySelector(".find");
  const input = form.querySelector("input");
  const send = form.querySelector(".send");
  const list = form.querySelector(".results");
  const feedback = form.querySelector(".queue-feedback");
  const cache = new Map();
  let results = [], picked = null, active = -1;
  let timer = 0, feedbackTimer = 0, controller = null, seq = 0, session = 0;
  let deleting = false, busy = false;

  function cancelSearch() {
    clearTimeout(timer);
    controller?.abort();
    controller = null;
    ++seq;
  }

  function clearResults() {
    results = [];
    picked = null;
    active = -1;
    list.replaceChildren();
    send.disabled = true;
  }

  function open(next) {
    const on = next ?? form.hidden;
    ++session;
    cancelSearch();
    clearTimeout(feedbackTimer);
    form.hidden = !on;
    button.setAttribute("aria-expanded", String(on));
    input.value = "";
    clearResults();
    feedback.textContent = "";
    delete send.dataset.state;
    if (on) input.focus();
  }

  function pick(i) {
    active = i;
    picked = results[i] ?? null;
    send.disabled = !picked || busy;
    list.querySelectorAll("button").forEach((b, n) => b.setAttribute("aria-pressed", String(n === i)));
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
        input.value = `${t.name} - ${t.artist}`;
        input.focus();
      });
      li.append(b);
      return li;
    }));
    pick(results.length ? 0 : -1);
    feedback.textContent = results.length ? "" : "no songs found";
  }

  function autofill(q) {
    const t = results[0];
    if (deleting || !t || input.value !== q || !t.name.toLowerCase().startsWith(q.toLowerCase())) return;
    const full = `${t.name} - ${t.artist}`;
    input.value = full;
    input.setSelectionRange(q.length, full.length);
  }

  async function search(q, mine) {
    try {
      let data = cache.get(q);
      if (!data) {
        controller = new AbortController();
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
        });
        if (!res.ok) throw new Error(res.status === 429 ? "search-slow" : "search-failed");
        data = await res.json();
        if (!Array.isArray(data)) throw new Error("search-failed");
      }
      // Also check after JSON parsing: typing, closing, or a cached search may
      // have invalidated this response while the network was still finishing.
      if (mine !== seq || form.hidden || busy) return;
      if (cache.size >= 40) cache.clear();
      cache.set(q, data);
      results = data;
      render();
      autofill(q);
    } catch (error) {
      if (mine !== seq || form.hidden || error.name === "AbortError") return;
      clearResults();
      feedback.textContent = error.message === "search-slow"
        ? "searching too fast — try again in a moment"
        : "couldn't search spotify — try again";
    }
  }

  button.addEventListener("click", () => open());
  input.addEventListener("beforeinput", e => { deleting = !!e.inputType?.startsWith("delete"); });
  input.addEventListener("input", () => {
    cancelSearch();
    clearResults();
    clearTimeout(feedbackTimer);
    delete send.dataset.state;
    const q = input.value.trim();
    feedback.textContent = q ? "searching…" : "";
    if (!q || busy) return;
    const mine = seq;
    timer = setTimeout(() => search(q, mine), 250);
  });

  form.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.preventDefault();
      open(false);
      button.focus();
    }
  });
  input.addEventListener("keydown", e => {
    if (busy || !results.length || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    pick((active + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    input.value = `${results[active].name} - ${results[active].artist}`;
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!picked || busy) return;
    const track = picked, mine = session;
    busy = true;
    cancelSearch();
    list.replaceChildren();
    input.disabled = true;
    send.disabled = true;
    form.setAttribute("aria-busy", "true");
    send.dataset.state = "sending";
    feedback.textContent = "adding to queue…";
    let ok = false, error = "";
    try {
      const token = await verify();
      // Closing the picker while verification is pending cancels the action.
      if (mine !== session || form.hidden) return;
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uri: track.uri, token }),
        signal: AbortSignal.timeout(40000),
      });
      ok = res.ok;
      if (!ok) error = (await res.json().catch(() => ({}))).error;
    } catch {
      error = "request-failed";
    } finally {
      busy = false;
      input.disabled = false;
      form.removeAttribute("aria-busy");
    }
    if (mine !== session || form.hidden) return;
    send.dataset.state = ok ? "ok" : "err";
    feedback.textContent = ok ? "added to queue" : (MESSAGES[error] ?? "couldn't confirm the add — check the queue before retrying");
    if (ok) {
      picked = null;
      feedbackTimer = setTimeout(() => {
        if (mine !== session) return;
        const restoreFocus = form.contains(document.activeElement);
        open(false);
        if (restoreFocus) button.focus();
      }, 1400);
    } else {
      send.disabled = false;
    }
  });

  return {
    close() { open(false); },
    playing(on) {
      button.hidden = !on;
      if (!on && !form.hidden) open(false);
    },
  };
}
