import { initGlow } from "./glow.js";
import { watchPresence } from "./presence.js";
import { watchTrack } from "./lastfm.js";
import { albumColor, hourHue } from "./tint.js";
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
    stopGlow?.setHue(hourHue());
    syncTint();
  }
}

async function syncTint() {
  if (!stopGlow) return;
  const art = spotify?.album_art_url ?? (lastfm?.nowPlaying ? lastfm.art : null);
  if (art) {
    const c = await albumColor(art);
    if (c) return stopGlow.setTint(c, 0.4);
  }
  stopGlow.setTint([0, 0, 0], 0);
}

syncGlow();
reduced.addEventListener("change", syncGlow);
setInterval(() => stopGlow?.setHue(hourHue()), 60000);
console.log("%cyo. flick the avatar harder.", "color:#7a96ff");

addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest("nav a");
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
});

const front = card.querySelector(".front");
const back = card.querySelector(".back");

let flip = 0;
let flipVel = 0;
let flipTarget = 0;
let drag = null;
let dragVel = 0;
let tiltX = 0;
let tiltY = 0;
let tiltTX = 0;
let tiltTY = 0;
let raf = 0;
let last = 0;
let hoverRect = null;

async function loadNotes() {
  const notes = await fetch("notes.json").then(r => r.json()).catch(() => []);
  card.querySelector(".notes").replaceChildren(...notes.map((n, i) => {
    const li = document.createElement("li");
    li.textContent = n.text;
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = `— ${n.who}`;
    li.append(who);
    li.style.setProperty("--r", `${(i % 2 ? 1 : -1) * (1.5 + Math.random() * 4)}deg`);
    li.style.setProperty("--side", i % 2 ? "flex-end" : "flex-start");
    return li;
  }));
}

function faces() {
  const n = ((flip % 360) + 360) % 360;
  const backUp = n > 90 && n < 270;
  front.style.visibility = backUp ? "hidden" : "visible";
  back.style.visibility = backUp ? "visible" : "hidden";
  front.inert = backUp;
  back.inert = !backUp;
  card.dataset.flip = backUp ? "1" : "";
}

function compose() {
  card.style.transform = `perspective(900px) rotateY(${flip + tiltY}deg) rotateX(${tiltX}deg)`;
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const k = 1 - Math.exp(-10 * dt);
  tiltX += (tiltTX - tiltX) * k;
  tiltY += (tiltTY - tiltY) * k;
  if (!drag) {
    flipVel += (flipTarget - flip) * 60 * dt;
    flipVel *= Math.exp(-11 * dt);
    flip += flipVel * dt;
    if (Math.abs(flipVel) < 0.4 && Math.abs(flipTarget - flip) < 0.3) {
      flip = flipTarget;
      flipVel = 0;
    }
  }
  faces();
  compose();
  if (!drag && flip === flipTarget && Math.abs(tiltTX - tiltX) < 0.02 && Math.abs(tiltTY - tiltY) < 0.02) {
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(loop);
}

function kick() {
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

const interactive = ".avatar, a, button, input, textarea, .suggest, .note";

card.addEventListener("pointerdown", e => {
  if (dragX !== null || !card.hasAttribute("data-peel") || e.target.closest(interactive)) return;
  if (reduced.matches) {
    flip = flipTarget = flip < 90 ? 180 : 0;
    faces();
    compose();
    return;
  }
  e.preventDefault();
  drag = { x: e.clientX, base: flip };
  dragVel = 0;
  card.setPointerCapture(e.pointerId);
});

card.addEventListener("pointerenter", () => {
  if (!drag) hoverRect = card.getBoundingClientRect();
});

card.addEventListener("pointermove", e => {
  if (drag) {
    const nf = drag.base + (e.clientX - drag.x) * 0.5;
    dragVel = nf - flip;
    flip = nf;
    kick();
    return;
  }
  if (reduced.matches || dragX !== null || !hoverRect) return;
  tiltTX = -((e.clientY - hoverRect.top) / hoverRect.height - 0.5) * 6;
  tiltTY = ((e.clientX - hoverRect.left) / hoverRect.width - 0.5) * 6;
  kick();
});

const endDrag = () => {
  if (!drag) return;
  drag = null;
  flipVel = dragVel * 60;
  flipTarget = Math.round((flip + dragVel * 3) / 180) * 180;
  kick();
};
card.addEventListener("pointerup", endDrag);
card.addEventListener("pointercancel", endDrag);

card.addEventListener("pointerleave", () => {
  hoverRect = null;
  tiltTX = 0;
  tiltTY = 0;
  kick();
});

faces();
const peelControl = initPeel(card, loadNotes);

document.querySelector(".close").addEventListener("click", () => {
  flipTarget = 0;
  kick();
  peelControl.close();
});

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
const statusText = card.querySelector(".status .text");
const gameIcon = card.querySelector(".status .game");

function renderStatus(d) {
  const game = d.activities.find(a => a.type === 0);
  statusText.textContent = d.activities.find(a => a.type === 4)?.state ?? "";
  gameIcon.hidden = !game;
  if (game) gameIcon.dataset.game = `playing ${game.name}`;
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
  renderStatus(d);
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
