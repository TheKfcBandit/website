const colors = ["#5c7fff", "#ff5c61", "#725cff", "#7a96ff", "#f0c54a", "#4ad6a0"];

let lib;

export async function burst(x, y) {
  lib ??= (await import("./canvas-confetti.js")).default;
  const origin = { x: x / innerWidth, y: y / innerHeight };
  lib({ particleCount: 70, spread: 80, startVelocity: 38, origin, colors, scalar: 0.9, ticks: 220, disableForReducedMotion: true });
  lib({ particleCount: 30, spread: 110, startVelocity: 26, origin, colors, scalar: 0.8, ticks: 220, disableForReducedMotion: true });
}
