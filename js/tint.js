const keys = [
  [0, 0.66], [6, 0.6], [9, 0.34], [12, 0.16], [14, 0.12],
  [16, 0.08], [18, 0.02], [20, 0.93], [22, 0.8], [24, 0.66],
];

export function hourHue() {
  const p = new Intl.DateTimeFormat("en", { timeZone: "America/Vancouver", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(p.find(x => x.type === "hour").value) + Number(p.find(x => x.type === "minute").value) / 60;
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (h >= keys[i][0] && h <= keys[i + 1][0]) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const t = (h - a[0]) / (b[0] - a[0]);
  let d = b[1] - a[1];
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return ((a[1] + d * t) % 1 + 1) % 1;
}
