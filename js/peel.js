export function initPeel(card, onFirst) {
  const peel = card.querySelector(".peel");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const hint = 22;

  let t = 0;
  let v = 0;
  let raf = 0;
  let open = false;
  let drag = null;
  let loaded = false;
  let suppress = false;

  const size = () => ({ w: card.offsetWidth, h: card.offsetHeight });
  const max = () => {
    const { w, h } = size();
    return w + h;
  };

  function apply() {
    const { w, h } = size();
    const leftY = Math.min(h, Math.max(0, max() - t));
    const topX = Math.min(w, Math.max(0, max() - t));
    const rightY = Math.min(h, Math.max(0, h - t));
    const bottomX = Math.min(w, Math.max(0, w - t));
    card.style.setProperty("--t", `${t}px`);
    card.style.setProperty("--left-y", `${leftY}px`);
    card.style.setProperty("--top-x", `${topX}px`);
    card.style.setProperty("--right-y", `${rightY}px`);
    card.style.setProperty("--bottom-x", `${bottomX}px`);
    card.style.setProperty("--peel-x", `${Math.min(t, w)}px`);
    card.style.setProperty("--peel-y", `${Math.min(t, h)}px`);
    const fold = Math.min(t / 16, (Math.min(w, h) - t) / 80);
    card.style.setProperty("--fold", String(Math.max(0, Math.min(1, fold))));
    card.style.setProperty("--open", String(t / max()));
    card.toggleAttribute("data-unpeeled", t >= max() - 1);
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

  apply();

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
