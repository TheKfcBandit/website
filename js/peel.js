export function initPeel(card, onOpen) {
  const peel = card.querySelector(".peel");
  const front = card.querySelector(".front");
  const back = card.querySelector(".back");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const rest = 28;

  let t = rest;
  let v = 0;
  let raf = 0;
  let open = false;
  let drag = null;
  let loaded = false;
  let suppress = false;

  const limit = () => card.offsetWidth + card.offsetHeight;

  function apply() {
    card.style.setProperty("--t", `${t}px`);
    card.style.setProperty("--fold", Math.min(Math.max((limit() - t) / (limit() * 0.3), 0), 1));
    back.style.visibility = open || t > 40 ? "visible" : "hidden";
  }

  function syncState() {
    const wasInBack = back.contains(document.activeElement);
    front.inert = open;
    back.inert = !open;
    peel.setAttribute("aria-expanded", open);
    card.toggleAttribute("data-peel", open || !!drag);
    if (open) {
      back.style.visibility = "visible";
      if (!loaded) {
        loaded = true;
        onOpen();
      }
      back.querySelector("h2").focus();
    } else if (wasInBack) {
      peel.focus();
    }
  }

  function spring(target) {
    cancelAnimationFrame(raf);
    let last = performance.now();
    const step = now => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      v += (target - t) * 170 * dt;
      v *= Math.exp(-16 * dt);
      t += v * dt;
      if (Math.abs(v) < 4 && Math.abs(target - t) < 0.5) {
        t = target;
        v = 0;
      } else {
        raf = requestAnimationFrame(step);
      }
      apply();
    };
    raf = requestAnimationFrame(step);
  }

  function toggle() {
    open = !open;
    card.style.transform = "";
    if (reduced.matches) {
      t = open ? limit() : rest;
      apply();
    } else {
      spring(open ? limit() : rest);
    }
    syncState();
  }

  peel.addEventListener("pointerdown", e => {
    if (reduced.matches) return;
    e.preventDefault();
    cancelAnimationFrame(raf);
    v = 0;
    drag = { x: e.clientX, y: e.clientY, t };
    card.style.transform = "";
    card.toggleAttribute("data-peel", true);
    peel.setPointerCapture(e.pointerId);
  });

  peel.addEventListener("pointermove", e => {
    if (!drag) return;
    t = Math.min(Math.max(drag.t + (drag.x - e.clientX + drag.y - e.clientY) * 0.75, rest), limit());
    apply();
  });

  const release = () => {
    if (!drag) return;
    const moved = Math.abs(t - drag.t) > 6;
    drag = null;
    if (moved) {
      suppress = true;
      open = t > limit() * 0.45;
      spring(open ? limit() : rest);
      syncState();
    } else {
      card.toggleAttribute("data-peel", open);
    }
  };
  peel.addEventListener("pointerup", release);
  peel.addEventListener("pointercancel", release);

  peel.addEventListener("click", () => {
    if (suppress) {
      suppress = false;
      return;
    }
    toggle();
  });

  peel.addEventListener("pointerenter", () => {
    if (!open && !drag && !reduced.matches) spring(36);
  });

  peel.addEventListener("pointerleave", () => {
    if (!open && !drag && !reduced.matches) spring(rest);
  });

  addEventListener("keydown", e => {
    if (e.key === "Escape" && open) toggle();
  });

  apply();
}
