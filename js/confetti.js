const colors = ["#5c7fff", "#ff5c61", "#725cff", "#7a96ff", "#f0c54a"];

export function burst(x, y) {
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.background = colors[i % colors.length];
    document.body.append(p);
    const dir = i % 2 ? 1 : -1;
    const spread = (40 + Math.random() * 230) * dir;
    const rise = 130 + Math.random() * 150;
    const fall = 340 + Math.random() * 220;
    const rot = (Math.random() - 0.5) * 900;
    p.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + spread * 0.45}px, ${y - rise}px) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${x + spread}px, ${y + fall}px) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 2200 + Math.random() * 900, easing: "cubic-bezier(.33, .12, .55, 1)" }).onfinish = () => p.remove();
  }
}
