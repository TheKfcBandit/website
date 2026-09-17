// One rotation drives both the glass mesh and its native HTML faces.
export function initFlip(card, { onRotate, onStart = () => {}, reduced = matchMedia("(prefers-reduced-motion: reduce)") }) {
  const front = card.querySelector(".front");
  const back = card.querySelector(".back");
  const open = card.querySelector(".flip-open");
  const close = card.querySelector(".flip-close");
  let angle = 0, target = 0, frame = 0;

  function faces(frontInert, backInert) {
    for (const [face, inert] of [[front, frontInert], [back, backInert]]) {
      face.toggleAttribute("inert", inert);
      face.setAttribute("aria-hidden", String(inert));
    }
  }

  function finish() {
    frame = 0;
    angle = target;
    onRotate(angle);
    const isBack = target === 180;
    card.dataset.side = isBack ? "back" : "front";
    delete card.dataset.flipping;
    faces(isBack, !isBack);
    (isBack ? back.querySelector("textarea") : open).focus({ preventScroll: true });
  }

  function show(isBack) {
    const next = isBack ? 180 : 0;
    if (target === next) return;
    cancelAnimationFrame(frame);
    target = next;
    onStart(isBack);
    open.setAttribute("aria-expanded", String(isBack));
    if (card.contains(document.activeElement)) document.activeElement.blur();
    faces(true, true);
    card.dataset.flipping = "";
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

  open.addEventListener("click", () => show(true));
  close.addEventListener("click", () => show(false));
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || target !== 180) return;
    e.preventDefault();
    show(false);
  });
  reduced.addEventListener("change", () => {
    if (!reduced.matches || !frame) return;
    cancelAnimationFrame(frame);
    finish();
  });
  faces(false, true);
}
