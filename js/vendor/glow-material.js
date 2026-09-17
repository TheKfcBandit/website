// The site's existing glow, expressed in Three's shader nodes so the same
// material compiles to WGSL (WebGPU) and GLSL (WebGL2 fallback).
import { MeshBasicNodeMaterial, Vector2 } from "three/webgpu";
import { Fn, uniform, uv, vec2, vec3, vec4, float, min, max, clamp, length,
  dot, sin, exp, fract, mod, abs, mix, atan, select } from "three/tsl";

export function createGlowMaterial(values) {
  const uniforms = {};
  for (const [name, value] of Object.entries(values)) {
    if (name === "u_quad") {
      value.forEach((v, i) => { uniforms[`u_quad${i}`] = uniform(new Vector2(...v)); });
    } else {
      uniforms[name] = uniform(Array.isArray(value) ? new Vector2(...value) : value);
    }
  }
  const u = uniforms;
  const segment = (p, a, b) => {
    const pa = p.sub(a), ba = b.sub(a);
    return length(pa.sub(ba.mul(clamp(dot(pa, ba).div(max(dot(ba, ba), 0.000001)), 0, 1))));
  };
  const side = (a, b, p) => b.x.sub(a.x).mul(p.y.sub(a.y)).sub(b.y.sub(a.y).mul(p.x.sub(a.x)));
  const material = new MeshBasicNodeMaterial({ toneMapped: false });
  material.fragmentNode = Fn(() => {
    const pos = vec2(uv().x, float(1).sub(uv().y)).mul(u.u_resolution).toVar();
    const q = [u.u_quad0, u.u_quad1, u.u_quad2, u.u_quad3];
    const distance = min(min(segment(pos, q[0], q[1]), segment(pos, q[1], q[2])),
      min(segment(pos, q[2], q[3]), segment(pos, q[3], q[0])));
    const s = min(min(side(q[0], q[1], pos), side(q[1], q[2], pos)),
      min(side(q[2], q[3], pos), side(q[3], q[0], pos)));
    const d = select(s.greaterThan(0), distance.negate(), distance).sub(u.u_radius).toVar();
    const delta = pos.sub(u.u_center);
    const a = atan(delta.y, delta.x).add(u.u_time.mul(0.02)).toVar();
    const hue = u.u_hue.add(sin(a).mul(0.06)).add(sin(a.mul(2).add(1)).mul(0.022));
    const rgb = clamp(abs(mod(fract(hue).mul(6).add(vec3(0, 4, 2)), 6).sub(3)).sub(1), 0, 1);
    const rim = mix(rgb, vec3(1), 0.22).toVar();
    const lum = dot(rim, vec3(0.3, 0.59, 0.11));
    const glow = select(d.greaterThan(0), exp(d.negate().div(u.u_scale.mul(140))), u.u_fill);
    const intensity = glow.mul(sin(u.u_time.mul(0.6)).mul(0.06).add(0.6)).mul(float(1).sub(lum.mul(0.42)));
    const noise = fract(sin(dot(pos.add(fract(u.u_time)), vec2(12.9898, 78.233))).mul(43758.5453));
    // Match the original raw GLSL output both on screen and in the glass's
    // transmission sample. The renderer deliberately leaves this unconverted.
    return vec4(vec3(0.031, 0.031, 0.043).add(rim.mul(intensity)).add(noise.sub(0.5).div(128)), 1);
  })();
  return {
    material,
    setUniform(name, value) {
      if (name === "u_quad") {
        for (let i = 0; i < 4; i++) u[`u_quad${i}`].value.set(value[i * 2], value[i * 2 + 1]);
      } else if (u[name]?.value?.isVector2) {
        u[name].value.set(...value);
      } else if (u[name]) {
        u[name].value = value;
      }
    },
  };
}
