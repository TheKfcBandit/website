import { initGlow } from "./glow.js";
import { watchPresence } from "./presence.js";

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
