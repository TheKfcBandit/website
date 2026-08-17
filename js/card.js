import { slabSvg, cssMatrix, projectQuad, offsetIn } from "./scene.js";
import { glowShader } from "./glow.js";

const RAD = Math.PI / 180;
const PERSPECTIVE = new DOMMatrix("perspective(900px)");
const RADIUS = 24;
const DEPTH = 0.03;
const BEVEL = 0.34;

let lib;

export async function initCard(canvas, card) {
  lib ??= await import("./vendor/glass-object.js");

  let w = 0;
  let h = 0;
  let originX = 0;
  let originY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let targetX = 0;
  let targetY = 0;
  let last = 0;

  const scene = lib.createGlassScene({ canvas }, {
    backgroundFragment: glowShader,
    backgroundUniforms: {
      u_resolution: [1, 1],
      u_time: 0,
      u_scale: 1,
      u_quad: [[0, 0], [0, 0], [0, 0], [0, 0]],
      u_center: [0, 0],
      u_radius: RADIUS,
      u_hue: 0.66,
      u_fill: 0.22,
    },
    focal: 900,
    cameraDistance: 4,
    ior: 1.28,
    thickness: 0.1,
    roughness: 0.46,
    dispersion: 0,
    clearcoat: 0.4,
    tint: "#1d2340",
    tintDensity: 6,
    depth: DEPTH,
    bevel: BEVEL,
    highlight: "#5c7fff",
    environmentIntensity: 0.14,
    floatIntensity: 0.16,
    rotationIntensity: 0.3,
    floatSpeed: 0.7,
    onFrame: compose,
  });
  if (!scene) return null;

  scene.add("card", {});

  function place() {
    const nw = card.offsetWidth;
    const nh = card.offsetHeight;
    const [cx, cy] = offsetIn(card, null);
    const nx = cx + nw / 2 - scrollX;
    const ny = cy + nh / 2 - scrollY;
    if (nw !== w || nh !== h) {
      w = nw;
      h = nh;
      schedule();
    }
    if (nx !== originX || ny !== originY) {
      originX = nx;
      originY = ny;
      scene.focus(originX - innerWidth / 2, originY - innerHeight / 2);
    }
  }

  function compose() {
    place();
    const now = performance.now();
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    const k = 1 - Math.exp(-10 * dt);
    tiltX += (targetX - tiltX) * k;
    tiltY += (targetY - tiltY) * k;
    scene.setTilt("card", -tiltX * RAD, tiltY * RAD);
    scene.scene.updateMatrixWorld();

    const m = cssMatrix(scene.nodeMatrix("card"), scene.pxPerUnit);
    card.style.transform = `perspective(900px) ${m}`;
    const { quad, cx, cy, radius } = projectQuad(PERSPECTIVE.multiply(m), w, h, RADIUS);
    for (let i = 0; i < 8; i += 2) {
      quad[i] += originX;
      quad[i + 1] += originY;
    }
    scene.setBackgroundUniform("u_quad", quad);
    scene.setBackgroundUniform("u_center", [cx + originX, cy + originY]);
    scene.setBackgroundUniform("u_radius", radius);
  }

  let shaped = "";

  function shape() {
    const key = `${w},${h}`;
    if (key === shaped || !w || !h) return;
    shaped = key;
    const thickness = DEPTH * Math.max(w, h);
    const inset = BEVEL * thickness * 0.45;
    const soften = BEVEL * (DEPTH * (Math.max(w, h) - 2 * inset)) * 0.625;
    scene.update("card", { src: slabSvg(w, h, RADIUS - inset - soften, inset) });
  }

  let pending = 0;
  function schedule() {
    clearTimeout(pending);
    pending = setTimeout(shape, 120);
  }

  const observer = new ResizeObserver(place);
  observer.observe(card);
  addEventListener("resize", place);
  place();
  shape();

  return {
    setTilt(x, y) {
      targetX = x;
      targetY = y;
    },
    setHue(hue) {
      scene.setBackgroundUniform("u_hue", hue);
    },
    ready() {
      canvas.classList.add("on");
    },
    stop() {
      clearTimeout(pending);
      observer.disconnect();
      removeEventListener("resize", place);
      scene.destroy();
      card.style.transform = "";
      canvas.classList.remove("on");
    },
  };
}
