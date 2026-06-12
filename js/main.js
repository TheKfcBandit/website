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
  const el = e.target.closest("nav a, .track");
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
const status = card.querySelector(".status");
const activity = card.querySelector(".activity");

watchPresence("79427255851298816", d => {
  avatar.dataset.status = d.discord_status;
  if (d.discord_user.avatar) {
    avatarImg.src = `https://cdn.discordapp.com/avatars/${d.discord_user.id}/${d.discord_user.avatar}.webp?size=160`;
  }
  status.textContent = d.activities.find(a => a.type === 4)?.state ?? "";
  const game = d.activities.find(a => a.type === 0);
  activity.textContent = game ? `playing ${game.name}` : "";
});

const track = card.querySelector(".track");
const trackImg = track.querySelector("img");
const trackName = track.querySelector(".name");
const trackArtist = track.querySelector(".artist");
const trackWhen = track.querySelector(".when");

watchTrack("thekfcbandit", "537af0ef3262086893a19328d00f2e75", t => {
  track.href = t.url;
  track.toggleAttribute("data-live", t.nowPlaying);
  if (t.art) trackImg.src = t.art;
  trackName.textContent = t.name;
  trackArtist.textContent = t.artist;
  trackWhen.textContent = t.ago;
});
