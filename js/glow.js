const vert = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const frag = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scale;
uniform vec2 u_quad[4];
uniform vec2 u_center;
uniform float u_radius;
uniform vec3 u_tint;
uniform float u_tintAmt;
uniform float u_hue;

float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

float side(vec2 a, vec2 b, vec2 p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

float sdCard(vec2 p) {
  float d = min(
    min(seg(p, u_quad[0], u_quad[1]), seg(p, u_quad[1], u_quad[2])),
    min(seg(p, u_quad[2], u_quad[3]), seg(p, u_quad[3], u_quad[0])));
  float s = min(
    min(side(u_quad[0], u_quad[1], p), side(u_quad[1], u_quad[2], p)),
    min(side(u_quad[2], u_quad[3], p), side(u_quad[3], u_quad[0], p)));
  return (s > 0.0 ? -d : d) - u_radius;
}

vec3 hue2rgb(float h) {
  h = fract(h);
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

vec3 palette(float a) {
  float hue = u_hue + 0.085 * sin(a) + 0.035 * sin(2.0 * a + 1.0);
  return mix(hue2rgb(hue), vec3(1.0), 0.22);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 pos = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float d = sdCard(pos);
  float a = atan(pos.y - u_center.y, pos.x - u_center.x) + u_time * 0.02;
  vec3 rim = mix(palette(a), u_tint, u_tintAmt);
  float lum = dot(rim, vec3(0.3, 0.59, 0.11));
  float glow = d > 0.0 ? exp(-d / (140.0 * u_scale)) : exp(d / (38.0 * u_scale));
  float i = glow * (0.6 + 0.06 * sin(u_time * 0.6)) * (1.0 - lum * 0.42);
  vec3 col = vec3(0.031, 0.031, 0.043) + rim * i;
  col += (hash(pos + fract(u_time)) - 0.5) / 128.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export function initGlow(canvas, card) {
  const gl = canvas.getContext("webgl", { antialias: false, depth: false, stencil: false });
  if (!gl) return null;

  let raf = 0;
  let scale = 1;
  let time = 0;
  let last = 0;
  let uniforms;
  let cardKey = "";
  const quad = new Float32Array(8);
  const tint = [0, 0, 0];
  const targetTint = [0, 0, 0];
  let amt = 0;
  let targetAmt = 0;
  let hue = 0.66;
  let targetHue = 0.66;
  let hueSet = false;

  function setup() {
    const program = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    uniforms = Object.fromEntries(
      ["u_resolution", "u_time", "u_scale", "u_quad", "u_center", "u_radius", "u_tint", "u_tintAmt", "u_hue"]
        .map(name => [name, gl.getUniformLocation(program, name)])
    );
    resize();
    return true;
  }

  function setCard() {
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const t = getComputedStyle(card).transform;
    const key = `${t}|${card.offsetLeft},${card.offsetTop},${w},${h},${scrollX},${scrollY}`;
    if (key === cardKey) return;
    cardKey = key;
    const m = t === "none" ? new DOMMatrix() : new DOMMatrix(t);
    const ox = (card.offsetLeft - scrollX + w / 2) * scale;
    const oy = (card.offsetTop - scrollY + h / 2) * scale;
    const r = 24;
    let cx = 0;
    let cy = 0;
    [[r - w / 2, r - h / 2], [w / 2 - r, r - h / 2], [w / 2 - r, h / 2 - r], [r - w / 2, h / 2 - r]]
      .forEach(([x, y], i) => {
        const p = m.transformPoint(new DOMPoint(x, y));
        quad[i * 2] = ox + (p.x / p.w) * scale;
        quad[i * 2 + 1] = oy + (p.y / p.w) * scale;
        cx += quad[i * 2] / 4;
        cy += quad[i * 2 + 1] / 4;
      });
    gl.uniform2fv(uniforms.u_quad, quad);
    gl.uniform2f(uniforms.u_center, cx, cy);
    gl.uniform1f(uniforms.u_radius, r * scale);
  }

  function resize() {
    scale = Math.min(devicePixelRatio, 2) * 0.5;
    cardKey = "";
    canvas.width = innerWidth * scale;
    canvas.height = innerHeight * scale;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.u_scale, scale);
    setCard();
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;
    const k = Math.min(dt * 1.2, 1);
    amt += (targetAmt - amt) * k;
    for (let i = 0; i < 3; i++) tint[i] += (targetTint[i] - tint[i]) * k;
    let dh = targetHue - hue;
    if (dh > 0.5) dh -= 1;
    if (dh < -0.5) dh += 1;
    hue = (hue + dh * Math.min(dt * 0.5, 1) + 1) % 1;
    setCard();
    gl.uniform1f(uniforms.u_time, time);
    gl.uniform3fv(uniforms.u_tint, tint);
    gl.uniform1f(uniforms.u_tintAmt, amt);
    gl.uniform1f(uniforms.u_hue, hue);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add("on");
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  const onVisibility = () => document.hidden ? pause() : start();
  const onLost = e => {
    e.preventDefault();
    pause();
  };
  const onRestored = () => {
    if (setup()) start();
  };

  if (!setup()) return null;
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  start();

  return {
    setTint(rgb, amount) {
      [targetTint[0], targetTint[1], targetTint[2]] = rgb;
      targetAmt = amount;
    },
    setHue(h) {
      targetHue = h;
      if (!hueSet) {
        hue = h;
        hueSet = true;
      }
    },
    stop() {
      pause();
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      canvas.classList.remove("on");
    },
  };
}
