const colors = ["#5c7fff", "#ff5c61", "#725cff", "#7a96ff", "#f0c54a", "#4ad6a0"];

export function burst(x, y) {
  for (let i = 0; i < 34; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.background = colors[i % colors.length];
    p.style.width = `${5 + Math.random() * 4}px`;
    p.style.height = `${9 + Math.random() * 8}px`;
    document.body.append(p);

    const vx = (Math.random() - 0.5) * 260;
    const rise = 45 + Math.random() * 80;
    const fall = 360 + Math.random() * 260;
    const sway = 14 + Math.random() * 28;
    const swayN = 2 + Math.random() * 3;
    const phase = Math.random() * Math.PI * 2;
    const rx = (Math.random() - 0.5) * 1600;
    const ry = (Math.random() - 0.5) * 1600;
    const rz = (Math.random() - 0.5) * 700;
    const a = (rise + 0.3 * fall) / 0.21;
    const b = fall - a;

    const frames = [];
    for (let k = 0; k <= 16; k++) {
      const s = k / 16;
      const px = x + vx * s + sway * Math.sin(phase + s * swayN * Math.PI * 2);
      const py = y + a * s * s + b * s;
      const op = s < 0.75 ? 1 : 1 - (s - 0.75) / 0.25;
      frames.push({
        transform: `translate(${px}px, ${py}px) perspective(500px) rotateX(${rx * s}deg) rotateY(${ry * s}deg) rotateZ(${rz * s}deg)`,
        opacity: op,
        offset: s,
      });
    }
    p.animate(frames, { duration: 2100 + Math.random() * 1100, easing: "linear" }).onfinish = () => p.remove();
  }
}
