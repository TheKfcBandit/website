export function initPeel(card, onFirst) {
  const peel = card.querySelector(".peel");
  const front = card.querySelector(".front");
  const notes = card.querySelector(".notes");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const hint = 22;
  const R = 24;

  let t = 0;
  let v = 0;
  let raf = 0;
  let open = false;
  let drag = null;
  let loaded = false;
  let suppress = false;

  const max = () => card.offsetWidth + card.offsetHeight;

  function clip() {
    if (t <= 0) {
      front.style.clipPath = "";
      notes.style.clipPath = "polygon(0 0, 0 0, 0 0)";
      return;
    }
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const bx = Math.max(w - t, R);
    const ry = Math.max(h - t, R);
    front.style.clipPath = `path("M ${R} 0 L ${w - R} 0 A ${R} ${R} 0 0 1 ${w} ${R} L ${w} ${ry} L ${bx} ${h} L ${R} ${h} A ${R} ${R} 0 0 1 0 ${h - R} L 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 Z")`;
    notes.style.clipPath = `path("M ${w} ${ry} L ${bx} ${h} L ${w - R} ${h} A ${R} ${R} 0 0 0 ${w} ${h - R} Z")`;
  }

  function apply() {
    card.style.setProperty("--t", `${t}px`);
    card.style.setProperty("--fold", String(Math.max(0, 1 - t / (max() * 0.5))));
    clip();
  }

  function load() {
    if (loaded) return;
    loaded = true;
    onFirst();
  }

  function spring(target) {
    cancelAnimationFrame(raf);
    let last = performance.now();
    const step = now => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      v += (target - t) * 150 * dt;
      v *= Math.exp(-15 * dt);
      t += v * dt;
      if (Math.abs(v) < 3 && Math.abs(target - t) < 0.5) {
        t = target;
        v = 0;
        apply();
        return;
      }
      apply();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function setOpen(o) {
    open = o;
    peel.setAttribute("aria-expanded", o);
    card.toggleAttribute("data-peel", o || !!drag);
    if (o) load();
  }

  peel.addEventListener("pointerdown", e => {
    if (reduced.matches) return;
    e.preventDefault();
    cancelAnimationFrame(raf);
    v = 0;
    drag = { x: e.clientX, y: e.clientY, t };
    load();
    card.toggleAttribute("data-peel", true);
    peel.setPointerCapture(e.pointerId);
  });

  peel.addEventListener("pointermove", e => {
    if (!drag) return;
    t = Math.min(Math.max(drag.t + (drag.x - e.clientX + drag.y - e.clientY) * 0.8, 0), max());
    apply();
  });

  const end = () => {
    if (!drag) return;
    const moved = Math.abs(t - drag.t) > 6;
    drag = null;
    if (moved) {
      suppress = true;
      setOpen(t > max() * 0.4);
      spring(open ? max() : 0);
    } else {
      card.toggleAttribute("data-peel", open);
    }
  };
  peel.addEventListener("pointerup", end);
  peel.addEventListener("pointercancel", end);

  peel.addEventListener("click", () => {
    if (suppress) {
      suppress = false;
      return;
    }
    const next = !open;
    setOpen(next);
    if (reduced.matches) {
      t = next ? max() : 0;
      apply();
    } else {
      spring(next ? max() : 0);
    }
  });

  peel.addEventListener("pointerenter", () => {
    if (!open && !drag && !reduced.matches) spring(hint);
  });
  peel.addEventListener("pointerleave", () => {
    if (!open && !drag && !reduced.matches) spring(0);
  });

  function close() {
    setOpen(false);
    if (reduced.matches) {
      t = 0;
      apply();
    } else {
      spring(0);
    }
  }

  addEventListener("keydown", e => {
    if (e.key === "Escape" && open) close();
  });

  return { close };
}
