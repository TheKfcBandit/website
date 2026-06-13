const cache = new Map();

export async function albumColor(url) {
  if (cache.has(url)) return cache.get(url);
  let color = null;
  try {
    const blob = await (await fetch(url, { mode: "cors" })).blob();
    const bitmap = await createImageBitmap(blob, { resizeWidth: 16, resizeHeight: 16 });
    const ctx = new OffscreenCanvas(16, 16).getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, 16, 16).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      const sat = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) + 8;
      r += data[i] * sat;
      g += data[i + 1] * sat;
      b += data[i + 2] * sat;
    }
    const max = Math.max(r, g, b) || 1;
    color = [r / max, g / max, b / max];
  } catch {}
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  cache.set(url, color);
  return color;
}

export function timeTint() {
  const h = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Vancouver", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (h >= 22 || h < 5) return [[0.24, 0.38, 0.95], 0.3];
  if (h < 8) return [[0.3, 0.62, 0.85], 0.24];
  if (h < 16) return [[0.5, 0.62, 0.95], 0.14];
  if (h < 19) return [[1, 0.58, 0.3], 0.32];
  return [[1, 0.42, 0.52], 0.28];
}
