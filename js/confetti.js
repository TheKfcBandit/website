const colors = ["#5c7fff", "#ff5c61", "#725cff", "#7a96ff", "#f0c54a"];

export function burst(x, y) {
  for (let i = 0; i < 28; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.background = colors[i % colors.length];
    document.body.append(p);
    const ang = Math.random() * Math.PI * 2;
    const sp = 90 + Math.random() * 190;
    p.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg) scale(1)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(ang) * sp}px, ${y + Math.sin(ang) * sp + 190}px) rotate(${(Math.random() - 0.5) * 1080}deg) scale(0.6)`, opacity: 0 },
    ], { duration: 1000 + Math.random() * 500, easing: "cubic-bezier(.15, .6, .3, 1)" }).onfinish = () => p.remove();
  }
}
