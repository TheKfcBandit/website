const colors = ["#5c7fff", "#ff5c61", "#725cff", "#7a96ff", "#f0c54a"];

export function burst(x, y) {
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.background = colors[i % colors.length];
    document.body.append(p);
    const dir = i % 2 ? 1 : -1;
    const spread = (25 + Math.random() * 120) * dir;
    const rise = 40 + Math.random() * 65;
    const fall = 300 + Math.random() * 220;
    const rot = (Math.random() - 0.5) * 800;
    p.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1, easing: "ease-out" },
      { transform: `translate(${x + spread * 0.5}px, ${y - rise}px) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.3, easing: "ease-in" },
      { transform: `translate(${x + spread}px, ${y + fall}px) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700 }).onfinish = () => p.remove();
  }
}
