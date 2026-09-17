const flip = new DOMMatrix().scale(1, -1, 1);

export function slabSvg(w, h, r, inset) {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const k = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const d = `M${x0 + k} ${y0}H${x1 - k}A${k} ${k} 0 0 1 ${x1} ${y0 + k}V${y1 - k}A${k} ${k} 0 0 1 ${x1 - k} ${y1}H${x0 + k}A${k} ${k} 0 0 1 ${x0} ${y1 - k}V${y0 + k}A${k} ${k} 0 0 1 ${x0 + k} ${y0}Z`;
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="#fff"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

export function offsetIn(el, root) {
  let x = 0;
  let y = 0;
  for (let node = el; node && node !== root; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return [x, y];
}

export function cssMatrix(elements, pxPerUnit) {
  const s = new DOMMatrix().scale(pxPerUnit, pxPerUnit, pxPerUnit);
  const m = new DOMMatrix(Array.from(elements));
  return flip.multiply(s).multiply(m).multiply(s.inverse()).multiply(flip);
}

export function projectQuad(m, w, h, r) {
  const quad = new Float32Array(8);
  let cx = 0;
  let cy = 0;
  [[r - w / 2, r - h / 2], [w / 2 - r, r - h / 2], [w / 2 - r, h / 2 - r], [r - w / 2, h / 2 - r]]
    .forEach(([x, y], i) => {
      const p = m.transformPoint(new DOMPoint(x, y));
      quad[i * 2] = p.x / p.w;
      quad[i * 2 + 1] = p.y / p.w;
      cx += quad[i * 2] / 4;
      cy += quad[i * 2 + 1] / 4;
    });
  const topLen = Math.hypot(quad[2] - quad[0], quad[3] - quad[1]);
  const sideLen = Math.hypot(quad[4] - quad[2], quad[5] - quad[3]);
  const fore = Math.min(topLen / (w - 2 * r), sideLen / (h - 2 * r));
  return { quad, cx, cy, radius: r * Math.max(0.04, Math.min(1, fore)) };
}
