import { initGlow } from "./glow.js";
import { watchPresence } from "./presence.js";
import { watchTrack } from "./lastfm.js";

const card = document.querySelector(".card");
const canvas = document.getElementById("glow");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let stopGlow = null;

function syncGlow() {
  if (reduced.matches) {
    stopGlow?.();
    stopGlow = null;
  } else {
    stopGlow ??= initGlow(canvas, card);
  }
}

syncGlow();
reduced.addEventListener("change", syncGlow);

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
    if (reduced.matches || !rect) return;
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

let spotify = null;
let lastfm = null;

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
});

watchTrack("thekfcbandit", "537af0ef3262086893a19328d00f2e75", t => {
  lastfm = t;
  if (!spotify) renderTrack(t);
});

setInterval(() => {
  if (!spotify) return;
  const { start, end } = spotify.timestamps;
  track.style.setProperty("--p", Math.min((Date.now() - start) / (end - start), 1));
}, 1000);
