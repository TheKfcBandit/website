import { initGlow } from "./glow.js";
import { watchPresence } from "./presence.js";
import { watchTrack } from "./lastfm.js";
import { initForm } from "./form.js";

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

initForm(document.getElementById("message"));
