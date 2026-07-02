import { stepSpring } from "./spring.js";

export function initPeel(card, onFirst, reduced, onKeyFlip) {
  const peel = card.querySelector(".peel");
  const hint = 22;

  let t = 0;
  let v = 0;
  let raf = 0;
  let open = false;
  let drag = null;
  let loaded = false;
  let suppress = false;

  const max = () => card.offsetWidth + card.offsetHeight;

  function apply() {
    card.style.setProperty("--t", `${t}px`);
    card.style.setProperty("--fold", String(Math.max(0, 1 - t / (max() * 0.5))));
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
      const s = { x: t, v };
      const done = stepSpring(s, target, 150, 15, dt, 3, 0.5);
      t = s.x;
      v = s.v;
      apply();
      if (!done) raf = requestAnimationFrame(step);
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

  const end = e => {
    if (!drag) return;
    const moved = Math.abs(t - drag.t) > 6;
    drag = null;
    if (moved) {
      suppress = e.type === "pointerup";
      setOpen(t > max() * 0.4);
      spring(open ? max() : 0);
    } else {
      card.toggleAttribute("data-peel", open);
    }
  };
  peel.addEventListener("pointerup", end);
  peel.addEventListener("pointercancel", end);

  peel.addEventListener("click", e => {
    if (suppress) {
      suppress = false;
      return;
    }
    if (e.detail === 0 && open) {
      onKeyFlip();
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
