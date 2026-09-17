import { initGlow } from "./glow.js";
import { watchPresence } from "./presence.js";
import { watchTrack } from "./lastfm.js";
import { hourHue } from "./tint.js";
import { stepSpring } from "./spring.js";
import { initCard } from "./card.js";
import { initQueue } from "./queue.js";
import { initFlip } from "./flip.js";
import { initNote } from "./note.js";

const card = document.querySelector(".card");
const canvas = document.getElementById("glow");
const stage = document.getElementById("stage");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let stopGlow = null;
let slab = null;
let spotify = null;
let lastfm = null;
let flipAngle = 0;

function rotateCard(angle) {
  flipAngle = angle;
  if (slab) slab.setFlip(angle);
  else card.style.transform = `perspective(900px) rotateY(${angle}deg)`;
}

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
  if (e.pointerType !== "mouse" || reduced.matches || !slab || card.hasAttribute("data-flipping")) return;
  hoverRect ??= card.getBoundingClientRect();
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
  const el = e.target.closest?.(".icon-button");
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

function resetMagnets() {
  for (const [el, m] of magnets) {
    cancelAnimationFrame(m.raf);
    el.style.removeProperty("--pull-x");
    el.style.removeProperty("--pull-y");
  }
  magnets.clear();
  magnetic = null;
}
addEventListener("blur", resetMagnets);
reduced.addEventListener("change", resetMagnets);

let cardPending = false;
async function syncCard() {
  if (reduced.matches) {
    slab?.stop();
    slab = null;
    delete document.body.dataset.stage;
    rotateCard(flipAngle);
    syncGlow();
    return;
  }
  if (slab || cardPending) return;
  cardPending = true;
  const next = await initCard(stage, card, () => {
    slab = null;
    rotateCard(flipAngle);
    syncGlow();
  }).catch(() => null);
  cardPending = false;
  if (!next) return;
  if (reduced.matches) {
    next.stop();
    rotateCard(flipAngle);
    return;
  }
  slab = next;
  slab.setFlip(flipAngle);
  slab.ready();
  syncGlow();
}

if (document.readyState === "complete") syncCard();
else addEventListener("load", syncCard, { once: true });
reduced.addEventListener("change", syncCard);

const player = card.querySelector(".player");
const queue = initQueue(player);
const note = initNote(card.querySelector(".note"));
initFlip(card, {
  reduced,
  onRotate: rotateCard,
  onStart(back) {
    hoverRect = null;
    slab?.setTilt(0, 0);
    resetMagnets();
    if (back) queue.close(); else note.cancel();
  },
});

function syncQueue() {
  queue.playing(!!spotify || !!lastfm?.nowPlaying);
}

const avatar = card.querySelector(".avatar");
const avatarImg = avatar.querySelector("img");
const statusText = card.querySelector(".status .text");
const gameIcon = card.querySelector(".status .game");

function renderStatus(d) {
  const activities = Array.isArray(d?.activities) ? d.activities : [];
  const game = activities.find(a => a.type === 0);
  statusText.textContent = activities.find(a => a.type === 4)?.state ?? "";
  gameIcon.hidden = !game;
  if (game) gameIcon.dataset.game = `playing ${game.name}`;
}

const track = card.querySelector(".track");
const trackImg = track.querySelector("img");
const trackName = track.querySelector(".name");
const trackArtist = track.querySelector(".artist");
const trackWhen = track.querySelector(".when");

function renderTrack(t) {
  updateProgress();
  if (!t) {
    track.removeAttribute("href");
    track.removeAttribute("data-live");
    track.removeAttribute("data-spotify");
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
  avatar.dataset.status = d?.discord_status ?? "offline";
  if (d?.discord_user?.avatar) {
    avatarImg.src = `https://cdn.discordapp.com/avatars/${d.discord_user.id}/${d.discord_user.avatar}.webp?size=160`;
  }
  renderStatus(d);
  spotify = d?.listening_to_spotify ? d.spotify : null;
  renderTrack(spotify ? fromSpotify(spotify) : lastfm);
  syncQueue();
});

watchTrack("thekfcbandit", "537af0ef3262086893a19328d00f2e75", t => {
  lastfm = t;
  if (!spotify) renderTrack(t);
  syncQueue();
});

function updateProgress() {
  const { start, end } = spotify?.timestamps ?? {};
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    player.style.removeProperty("--p");
    return;
  }
  player.style.setProperty("--p", Math.max(0, Math.min((Date.now() - start) / (end - start), 1)));
}

setInterval(() => {
  // Don't keep a completed song live indefinitely if presence stops updating.
  if (spotify && Date.now() > spotify.timestamps?.end + 5000) {
    spotify = null;
    renderTrack(lastfm);
    syncQueue();
  } else updateProgress();
}, 1000);
