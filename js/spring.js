export function stepSpring(s, target, stiffness, damping, dt, vEps, xEps) {
  s.v += (target - s.x) * stiffness * dt;
  s.v *= Math.exp(-damping * dt);
  s.x += s.v * dt;
  if (Math.abs(s.v) < vEps && Math.abs(target - s.x) < xEps) {
    s.x = target;
    s.v = 0;
    return true;
  }
  return false;
}
