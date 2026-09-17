import { stepSpring } from "./spring.js";

const VELOCITY_WINDOW = 100; // Only the final 100 ms of a drag contributes momentum.
const MAX_SPEED = 1800; // Degrees per second; filters unusually large event jumps.
const COAST_TIME = 0.2;

// One rotation drives both the glass mesh and its native HTML faces.
export function initFlip(card, { onRotate, onStart = () => {}, reduced = matchMedia("(prefers-reduced-motion: reduce)") }) {
  const front = card.querySelector(".front");
  const back = card.querySelector(".back");
  const edges = [...card.querySelectorAll(".flip-edge")];
  let angle = 0, target = 0, frame = 0, isBack = false, drag = null;
  let returnEdge = front.querySelector(".flip-edge");

  function faces(frontInert, backInert) {
    for (const [face, inert] of [[front, frontInert], [back, backInert]]) {
      face.toggleAttribute("inert", inert);
      face.setAttribute("aria-hidden", String(inert));
    }
  }

  function begin(nextBack) {
    cancelAnimationFrame(frame);
    frame = 0;
    onStart(nextBack);
    if (card.contains(document.activeElement)) document.activeElement.blur();
    faces(true, true);
    card.dataset.flipping = "";
  }

  function finish() {
    frame = 0;
    isBack = Math.abs(Math.round(target / 180) % 2) === 1;
    angle = target;
    onRotate(angle);
    card.dataset.side = isBack ? "back" : "front";
    delete card.dataset.flipping;
    faces(isBack, !isBack);
    (isBack ? back.querySelector("textarea") : returnEdge).focus({ preventScroll: true });
  }

  function settle(next, velocity = 0) {
    cancelAnimationFrame(frame);
    target = next;
    if (reduced.matches || (angle === target && !velocity)) { finish(); return; }
    const spring = { x: angle, v: velocity };
    let last = performance.now();
    function animate(now) {
      let remaining = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      // Small steps keep the same spring stable on slow frames and after tab suspension.
      while (remaining > 0) {
        const dt = Math.min(remaining, 1 / 120);
        if (stepSpring(spring, target, 70, 14, dt, 2, 0.15)) { finish(); return; }
        remaining -= dt;
      }
      angle = spring.x;
      onRotate(angle);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  }

  function release() {
    const current = drag;
    drag = null;
    delete card.dataset.dragging;
    if (current && card.hasPointerCapture(current.id)) card.releasePointerCapture(current.id);
    return current;
  }

  function cancelDrag() {
    const current = release();
    if (current?.moved) settle(current.from + Math.round((angle - current.from) / 360) * 360);
  }

  for (const edge of edges) {
    const direction = edge.dataset.edge === "left" ? 1 : -1;
    edge.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.isPrimary === false || drag || card.hasAttribute("data-flipping")) return;
      if (!isBack) returnEdge = edge;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: angle,
        width: card.getBoundingClientRect().width, progress: 0, moved: false, direction: 0,
        samples: [{ angle: 0, time: performance.now() }] };
      card.setPointerCapture(e.pointerId);
    });
    // Native keyboard/assistive clicks still work; pointer clicks alone don't flip.
    edge.addEventListener("click", e => {
      if (e.detail !== 0 || drag || card.hasAttribute("data-flipping")) return;
      if (!isBack) returnEdge = edge;
      begin(!isBack);
      settle(angle + direction * 180);
    });
  }

  card.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) { release(); return; }
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      begin(!isBack);
      card.dataset.dragging = "";
    }
    drag.progress = dx / Math.max(drag.width * 0.6, 1) * 180;
    const now = performance.now(), previous = drag.samples.at(-1);
    const direction = Math.sign(drag.progress - previous.angle);
    // A reversal should carry its new direction, not the older forward motion.
    if (direction && drag.direction && direction !== drag.direction) drag.samples = [previous];
    if (direction) drag.direction = direction;
    drag.samples.push({ angle: drag.progress, time: now });
    while (drag.samples.length > 2 && drag.samples[1].time < now - VELOCITY_WINDOW) drag.samples.shift();
    if (!reduced.matches) {
      angle = drag.from + drag.progress;
      onRotate(angle);
    }
  });
  card.addEventListener("pointerup", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const current = release();
    if (current.moved) {
      const now = performance.now(), last = current.samples.at(-1);
      const first = current.samples.find(sample => sample.time >= now - VELOCITY_WINDOW) ?? last;
      const elapsed = last.time - first.time;
      let velocity = !reduced.matches && elapsed > 0 ? (last.angle - first.angle) * 1000 / elapsed : 0;
      velocity = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, velocity));
      velocity *= Math.max(0, 1 - (now - last.time) / VELOCITY_WINDOW);
      const turns = (current.from + current.progress + velocity * COAST_TIME) / 180;
      const direction = velocity || current.progress;
      // Project the release speed onto a face, then carry that speed into the spring.
      const nearest = direction < 0 ? Math.ceil(turns - 0.5) : Math.floor(turns + 0.5);
      settle(nearest * 180, velocity);
    }
  });
  card.addEventListener("pointercancel", e => { if (drag?.id === e.pointerId) cancelDrag(); });
  card.addEventListener("lostpointercapture", e => { if (drag?.id === e.pointerId) cancelDrag(); });
  const home = () => {
    release();
    begin(false);
    settle(Math.round(angle / 360) * 360);
  };
  card.querySelector(".flip-close").addEventListener("click", home);
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || (!isBack && !drag && !frame)) return;
    e.preventDefault();
    home();
  });
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    if (drag) cancelDrag();
    else if (frame) { cancelAnimationFrame(frame); finish(); }
  });
  faces(false, true);
}
