const colors = ["#5c7fff", "#ff5c61", "#725cff", "#7a96ff", "#f0c54a"];

export function burst(x, y) {
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.background = colors[i % colors.length];
    document.body.append(p);
    const spread = (25 + Math.random() * 120) * (i % 2 ? 1 : -1);
    const rise = 35 + Math.random() * 60;
    const fall = 320 + Math.random() * 230;
    const rot = (Math.random() - 0.5) * 800;
    const a = (rise + 0.3 * fall) / 0.21;
    const b = fall - a;
    const frames = [];
    for (let s = 0; s <= 1.0001; s += 0.125) {
      const op = s < 0.7 ? 1 : 1 - (s - 0.7) / 0.3;
      frames.push({
        transform: `translate(${x + spread * s}px, ${y + a * s * s + b * s}px) rotate(${rot * s}deg)`,
        opacity: op,
        offset: Math.min(s, 1),
      });
    }
    p.animate(frames, { duration: 1700 + Math.random() * 700, easing: "linear" }).onfinish = () => p.remove();
  }
}
