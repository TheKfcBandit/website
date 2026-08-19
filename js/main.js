import { initGlow } from "./glow.js";
import { watchPresence } from "./presence.js";
import { watchTrack } from "./lastfm.js";
import { hourHue } from "./tint.js";
import { stepSpring } from "./spring.js";
import { initCard } from "./card.js";
import { initQueue } from "./queue.js";
import { initNote } from "./note.js";

const card = document.querySelector(".card");
const canvas = document.getElementById("glow");
const stage = document.getElementById("stage");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let stopGlow = null;
let slab = null;
let spotify = null;
let lastfm = null;

const glow = () => slab ?? stopGlow;

function syncGlow() {
  if (reduced.matches || slab) {
    stopGlow?.stop();
    stopGlow = null;
  } else {
    stopGlow ??= initGlow(canvas, card);
  }
  glow()?.setHue(hourHue());
}

syncGlow();
reduced.addEventListener("change", syncGlow);
setInterval(() => glow()?.setHue(hourHue()), 60000);

let hoverRect = null;

card.addEventListener("pointerenter", () => {
  hoverRect = card.getBoundingClientRect();
});

card.addEventListener("pointermove", e => {
  if (reduced.matches || !hoverRect || !slab) return;
  slab.setTilt(
    -((e.clientY - hoverRect.top) / hoverRect.height - 0.5) * 6,
    ((e.clientX - hoverRect.left) / hoverRect.width - 0.5) * 6
  );
});

card.addEventListener("pointerleave", () => {
  hoverRect = null;
  slab?.setTilt(0, 0);
});

const magnets = new Map();
let magnetic = null;

function pull(el, tx, ty) {
  let m = magnets.get(el);
  if (!m) {
    m = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, tx: 0, ty: 0, raf: 0, last: 0 };
    magnets.set(el, m);
  }
  m.tx = tx;
  m.ty = ty;
  if (m.raf) return;
  m.last = performance.now();
  const step = now => {
    const dt = Math.min((now - m.last) / 1000, 0.05);
    m.last = now;
    const restX = stepSpring(m.x, m.tx, 240, 24, dt, 0.4, 0.05);
    const restY = stepSpring(m.y, m.ty, 240, 24, dt, 0.4, 0.05);
    el.style.setProperty("--pull-x", `${m.x.x}px`);
    el.style.setProperty("--pull-y", `${m.y.x}px`);
    if (restX && restY) {
      m.raf = 0;
      if (!m.tx && !m.ty) {
        el.style.removeProperty("--pull-x");
        el.style.removeProperty("--pull-y");
      }
      return;
    }
    m.raf = requestAnimationFrame(step);
  };
  m.raf = requestAnimationFrame(step);
}

addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest?.("nav a");
  if (el !== magnetic) {
    if (magnetic) pull(magnetic, 0, 0);
    magnetic = el;
  }
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
  if (reduced.matches) return;
  pull(el, (e.clientX - r.left - r.width / 2) * 0.32, (e.clientY - r.top - r.height / 2) * 0.32);
});

async function syncCard() {
  if (reduced.matches) {
    slab?.stop();
    slab = null;
    delete document.body.dataset.stage;
    syncGlow();
    return;
  }
  if (slab) return;
  const next = await initCard(stage, card).catch(() => null);
  if (!next) return;
  if (reduced.matches) {
    next.stop();
    return;
  }
  slab = next;
  document.body.dataset.stage = "";
  slab.onFace(showBack);
  slab.ready();
  syncGlow();
}

addEventListener("load", syncCard, { once: true });
reduced.addEventListener("change", syncCard);

const front = card.querySelector(".face.front");
const back = card.querySelector(".face.back");
const note = initNote(back);

let flipped = false;

function showBack(on) {
  card.dataset.face = on ? "back" : "front";
  front.inert = on;
  back.inert = !on;
  if (on) back.querySelector("textarea").focus({ preventScroll: true });
}

function flip(on) {
  if (on === flipped) return;
  flipped = on;
  if (slab) slab.setFlip(on);
  else showBack(on);
  if (!on) note.reset();
}

card.querySelector(".close").addEventListener("click", () => flip(false));

// grab either side edge and drag across to turn the card over
const EDGE = 26;
let grab = null;

card.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (e.target.closest("a, button, input, textarea")) return;
  const r = card.getBoundingClientRect();
  const fromLeft = e.clientX - r.left;
  const fromRight = r.right - e.clientX;
  const edge = Math.min(fromLeft, fromRight);
  if (edge > EDGE) return;
  grab = { x: e.clientX, from: fromLeft < fromRight ? 1 : -1, w: r.width, moved: false };
  card.setPointerCapture(e.pointerId);
  card.dataset.grabbing = "";
});

card.addEventListener("pointermove", e => {
  if (!grab) return;
  const dx = (e.clientX - grab.x) * grab.from;
  if (Math.abs(dx) > 3) grab.moved = true;
  slab?.dragFlip(Math.max(0, Math.min(1, dx / (grab.w * 0.55))));
});

function release() {
  if (!grab) return;
  const settled = slab ? slab.endDrag() : null;
  if (!slab && grab.moved) flip(!flipped);
  else if (settled !== null) {
    flipped = settled;
    if (!flipped) note.reset();
  }
  grab = null;
  delete card.dataset.grabbing;
}

card.addEventListener("pointerup", release);
card.addEventListener("pointercancel", release);

addEventListener("keydown", e => {
  if (e.key === "Escape" && flipped) flip(false);
});

showBack(false);

const queue = initQueue(card.querySelector(".player"));

function syncQueue() {
  queue.playing(!!spotify || !!lastfm?.nowPlaying);
}

const avatar = card.querySelector(".avatar");
const avatarImg = avatar.querySelector("img");
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
  if (!t) {
    track.removeAttribute("href");
    track.removeAttribute("data-live");
    track.removeAttribute("data-spotify");
    track.style.removeProperty("--p");
    trackImg.removeAttribute("src");
    trackName.textContent = "";
    trackArtist.textContent = "";
    trackWhen.textContent = "";
    return;
  }
  track.href = t.url;
  track.toggleAttribute("data-live", t.nowPlaying);
  track.toggleAttribute("data-spotify", !!spotify);
  if (t.art) trackImg.src = t.art;
  else trackImg.removeAttribute("src");
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
  syncQueue();
});

watchTrack("thekfcbandit", "537af0ef3262086893a19328d00f2e75", t => {
  lastfm = t;
  if (!spotify) renderTrack(t);
  syncQueue();
});

setInterval(() => {
  if (!spotify) return;
  const { start, end } = spotify.timestamps;
  track.style.setProperty("--p", Math.min((Date.now() - start) / (end - start), 1));
}, 1000);
