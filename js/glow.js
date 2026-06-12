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
uniform vec2 u_pointer;
uniform vec4 u_card;
uniform float u_radius;

float sdCard(vec2 p) {
  vec2 d = abs(p - u_card.xy) - u_card.zw + u_radius;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - u_radius;
}

vec3 palette(float a) {
  float s = fract(a / 6.2832) * 4.0;
  vec3 col = mix(vec3(0.231, 0.231, 1.0), vec3(1.0, 0.361, 0.38), smoothstep(0.0, 1.0, s));
  col = mix(col, vec3(0.361, 0.498, 1.0), smoothstep(1.0, 2.0, s));
  col = mix(col, vec3(0.447, 0.361, 1.0), smoothstep(2.0, 3.0, s));
  return mix(col, vec3(0.231, 0.231, 1.0), smoothstep(3.0, 4.0, s));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 pos = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float d = max(sdCard(pos), 0.0);
  float a = atan(pos.y - u_card.y, pos.x - u_card.x) + u_time * 0.25;
  vec3 rim = palette(a);
  float cursor = exp(-length(pos - u_pointer) / (170.0 * u_scale));
  float halo = exp(-length(pos - u_pointer) / (520.0 * u_scale));
  float glow = exp(-d / (130.0 * u_scale));
  float i = glow * (0.38 + 0.03 * sin(u_time * 0.6) + 1.1 * cursor) + 0.05 * halo;
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
  const pointer = [innerWidth / 2, innerHeight / 2];
  const target = [...pointer];
  let uniforms;

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
      ["u_resolution", "u_time", "u_scale", "u_pointer", "u_card", "u_radius"]
        .map(name => [name, gl.getUniformLocation(program, name)])
    );
    resize();
    return true;
  }

  function setCard() {
    const r = card.getBoundingClientRect();
    gl.uniform4f(uniforms.u_card,
      (r.left + r.width / 2) * scale, (r.top + r.height / 2) * scale,
      (r.width / 2) * scale, (r.height / 2) * scale);
    gl.uniform1f(uniforms.u_radius, 24 * scale);
  }

  function resize() {
    scale = Math.min(devicePixelRatio, 2) * 0.5;
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
    const k = 1 - Math.exp(-8 * dt);
    pointer[0] += (target[0] - pointer[0]) * k;
    pointer[1] += (target[1] - pointer[1]) * k;
    gl.uniform1f(uniforms.u_time, time);
    gl.uniform2f(uniforms.u_pointer, pointer[0] * scale, pointer[1] * scale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add("on");
    raf = requestAnimationFrame(frame);
  }

  function start() {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  const onPointer = e => {
    target[0] = e.clientX;
    target[1] = e.clientY;
  };
  const onVisibility = () => document.hidden ? pause() : start();
  const onLost = e => {
    e.preventDefault();
    pause();
  };
  const onRestored = () => {
    if (setup()) start();
  };

  const observer = new ResizeObserver(setCard);

  if (!setup()) return null;
  addEventListener("pointermove", onPointer);
  addEventListener("resize", resize);
  addEventListener("scroll", setCard);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  observer.observe(card);
  start();

  return () => {
    pause();
    removeEventListener("pointermove", onPointer);
    removeEventListener("resize", resize);
    removeEventListener("scroll", setCard);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    observer.disconnect();
    canvas.classList.remove("on");
  };
}
