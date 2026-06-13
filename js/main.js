import { initGlow } from "./glow.js";
import { watchPresence } from "./presence.js";
import { watchTrack } from "./lastfm.js";
import { albumColor, timeTint } from "./tint.js";
import { initPeel } from "./peel.js";
import { getToken } from "./turnstile.js";

const card = document.querySelector(".card");
const canvas = document.getElementById("glow");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let stopGlow = null;
let spotify = null;
let lastfm = null;

function syncGlow() {
  if (reduced.matches) {
    stopGlow?.stop();
    stopGlow = null;
  } else {
    stopGlow ??= initGlow(canvas, card);
    syncTint();
  }
}

async function syncTint() {
  if (!stopGlow) return;
  const art = spotify?.album_art_url ?? (lastfm?.nowPlaying ? lastfm.art : null);
  if (art) {
    const c = await albumColor(art);
    if (c) return stopGlow.setTint(c, 0.35);
  }
  stopGlow.setTint(...timeTint());
}

syncGlow();
reduced.addEventListener("change", syncGlow);
setInterval(syncTint, 300000);
console.log("%cyo. flick the avatar harder.", "color:#7a96ff");

addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest("nav a");
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
});

if (matchMedia("(hover: hover)").matches) {
  let rect;
  card.addEventListener("pointerenter", () => rect = card.getBoundingClientRect());
  card.addEventListener("pointermove", e => {
    if (reduced.matches || !rect || card.hasAttribute("data-peel")) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(900px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
  });
  card.addEventListener("pointerleave", () => {
    rect = null;
    card.style.transform = "";
  });
}

const avatar = card.querySelector(".avatar");
const avatarImg = avatar.querySelector("img");

let spin = 0;
let spinVel = 0;
let dragX = null;
let spinRaf = 0;

function renderSpin() {
  avatarImg.style.transform = spin ? `perspective(300px) rotateY(${spin}deg)` : "";
}

function settle() {
  spinVel *= 0.985;
  spin += spinVel;
  if (Math.abs(spinVel) < 0.3) {
    const target = Math.round(spin / 360) * 360;
    spin += (target - spin) * 0.05;
    if (Math.abs(target - spin) < 0.5) {
      spin = 0;
      spinVel = 0;
      renderSpin();
      return;
    }
  }
  renderSpin();
  spinRaf = requestAnimationFrame(settle);
}

avatar.addEventListener("pointerdown", e => {
  e.preventDefault();
  dragX = e.clientX;
  spinVel = 0;
  cancelAnimationFrame(spinRaf);
  avatar.setPointerCapture(e.pointerId);
});

avatar.addEventListener("pointermove", e => {
  if (dragX === null) return;
  const dx = e.clientX - dragX;
  spinVel = Math.max(-80, Math.min(80, dx * 0.8 + dx * Math.abs(dx) * 0.02));
  spin += dx * 0.5;
  dragX = e.clientX;
  renderSpin();
});

const releaseSpin = () => {
  if (dragX === null) return;
  dragX = null;
  if (Math.abs(spinVel) >= 75) {
    avatar.classList.add("rip");
    avatar.addEventListener("animationend", () => avatar.classList.remove("rip"), { once: true });
    stopGlow?.setTint([1, 0.8, 0.3], 0.5);
    setTimeout(syncTint, 700);
  }
  spinRaf = requestAnimationFrame(settle);
};
avatar.addEventListener("pointerup", releaseSpin);
avatar.addEventListener("pointercancel", releaseSpin);
const status = card.querySelector(".status");
const activity = card.querySelector(".activity");
const activityImg = activity.querySelector("img");
const activityText = activity.querySelector("span");

function renderActivity(a) {
  activityText.textContent = a ? `playing ${a.name}` : "";
  const asset = a?.assets?.small_image ?? a?.assets?.large_image;
  activityImg.hidden = !asset;
  if (asset) {
    activityImg.src = asset.startsWith("mp:")
      ? `https://media.discordapp.net/${asset.slice(3)}`
      : `https://cdn.discordapp.com/app-assets/${a.application_id}/${asset}.png`;
  }
}

const track = card.querySelector(".track");
const trackImg = track.querySelector("img");
const trackName = track.querySelector(".name");
const trackArtist = track.querySelector(".artist");
const trackWhen = track.querySelector(".when");

function renderTrack(t) {
  if (!t) return;
  track.href = t.url;
  track.toggleAttribute("data-live", t.nowPlaying);
  track.toggleAttribute("data-spotify", !!spotify);
  if (t.art) trackImg.src = t.art;
  trackName.textContent = t.name;
  trackArtist.textContent = t.artist;
  trackWhen.textContent = t.ago;
}

function fromSpotify(s) {
  return {
    name: s.song,
    artist: s.artist,
    url: `https://open.spotify.com/track/${s.track_id}`,
    art: s.album_art_url,
    nowPlaying: true,
    ago: "now playing",
  };
}

watchPresence("79427255851298816", d => {
  avatar.dataset.status = d.discord_status;
  if (d.discord_user.avatar) {
    avatarImg.src = `https://cdn.discordapp.com/avatars/${d.discord_user.id}/${d.discord_user.avatar}.webp?size=160`;
  }
  status.textContent = d.activities.find(a => a.type === 4)?.state ?? "";
  renderActivity(d.activities.find(a => a.type === 0));
  spotify = d.listening_to_spotify ? d.spotify : null;
  renderTrack(spotify ? fromSpotify(spotify) : lastfm);
  syncTint();
});

watchTrack("thekfcbandit", "537af0ef3262086893a19328d00f2e75", t => {
  lastfm = t;
  if (!spotify) {
    renderTrack(t);
    syncTint();
  }
});

setInterval(() => {
  if (!spotify) return;
  const { start, end } = spotify.timestamps;
  track.style.setProperty("--p", Math.min((Date.now() - start) / (end - start), 1));
}, 1000);

initPeel(card, async () => {
  const notes = await fetch("notes.json").then(r => r.json()).catch(() => []);
  card.querySelector(".notes").replaceChildren(...notes.map(n => {
    const li = document.createElement("li");
    li.textContent = n.text;
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = `— ${n.who}`;
    li.append(who);
    return li;
  }));
});

const noteForm = card.querySelector(".note");
const noteButton = noteForm.querySelector("button");
const noteFeedback = noteForm.querySelector(".feedback");

noteForm.addEventListener("submit", async e => {
  e.preventDefault();
  noteButton.disabled = true;
  noteFeedback.textContent = "";
  try {
    const data = Object.fromEntries(new FormData(noteForm));
    data.token = await getToken();
    const res = await fetch("/api/note", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw 0;
    noteForm.reset();
    noteFeedback.textContent = "sent, thanks";
  } catch {
    noteFeedback.textContent = "didn't send, try again";
  }
  noteButton.disabled = false;
});

const trackrow = card.querySelector(".trackrow");
const addButton = trackrow.querySelector(".add");
const suggest = trackrow.querySelector(".suggest");
const suggestInput = suggest.querySelector("input");
const results = suggest.querySelector(".results");
const suggestFeedback = suggest.querySelector(".feedback");
let searchTimer = 0;

function closeSuggest() {
  suggest.hidden = true;
  suggestInput.value = "";
  results.replaceChildren();
  suggestFeedback.textContent = "";
}

addButton.addEventListener("click", () => {
  suggest.hidden = !suggest.hidden;
  if (!suggest.hidden) suggestInput.focus();
  else closeSuggest();
});

suggest.addEventListener("submit", e => e.preventDefault());

suggest.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeSuggest();
    addButton.focus();
  }
});

suggestInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchSongs, 300);
});

async function searchSongs() {
  const q = suggestInput.value.trim();
  if (!q) return results.replaceChildren();
  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw 0;
    results.replaceChildren(...(await res.json()).map(t => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const img = new Image(28, 28);
      img.src = t.art;
      img.alt = "";
      const label = document.createElement("span");
      label.textContent = `${t.name} — ${t.artist}`;
      b.append(img, label);
      b.addEventListener("click", () => pickSong(t.uri));
      li.append(b);
      return li;
    }));
  } catch {}
}

async function pickSong(uri) {
  for (const b of suggest.querySelectorAll("button")) b.disabled = true;
  suggestFeedback.textContent = "";
  try {
    const token = await getToken();
    const res = await fetch("/api/spotify/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uri, token }),
    });
    if (!res.ok) throw 0;
    suggestFeedback.textContent = (await res.json()).queued ? "queued for right now" : "saved to the pile";
    setTimeout(closeSuggest, 2500);
  } catch {
    suggestFeedback.textContent = "didn't work, try again";
    for (const b of suggest.querySelectorAll("button")) b.disabled = false;
  }
}
