import { initGlow } from "./glow.js";

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
