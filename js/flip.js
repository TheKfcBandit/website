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

  function settle(next) {
    cancelAnimationFrame(frame);
    target = next;
    if (reduced.matches || angle === target) { finish(); return; }
    const from = angle, start = performance.now();
    const duration = 460 * Math.abs(target - from) / 180;
    function animate(now) {
      const t = Math.min((now - start) / duration, 1);
      angle = from + (target - from) * (0.5 - Math.cos(Math.PI * t) / 2);
      onRotate(angle);
      if (t < 1) frame = requestAnimationFrame(animate);
      else finish();
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
        width: card.getBoundingClientRect().width, progress: 0, moved: false };
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
    if (!reduced.matches) {
      angle = drag.from + drag.progress;
      onRotate(angle);
    }
  });
  card.addEventListener("pointerup", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const current = release();
    if (current.moved) {
      const turns = (current.from + current.progress) / 180;
      // Settle to the nearest face; an exact edge-on tie follows the drag.
      const nearest = current.progress < 0 ? Math.ceil(turns - 0.5) : Math.floor(turns + 0.5);
      settle(nearest * 180);
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
