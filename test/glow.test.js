import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initGlow } from '../js/glow.js';

test('fallback glow releases its WebGL resources on stop and on failed linking', t => {
  const dom = new JSDOM('<canvas></canvas><main></main>');
  const old = {};
  const globals = {
    document: dom.window.document, addEventListener() {}, removeEventListener() {},
    innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, scrollX: 0, scrollY: 0,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    getComputedStyle: () => ({ transform: 'none' }),
    DOMPoint: class { constructor(x, y) { Object.assign(this, { x, y, w: 1 }); } },
    DOMMatrix: class { transformPoint(point) { return point; } },
  };
  for (const key of Object.keys(globals)) old[key] = globalThis[key];
  Object.assign(globalThis, globals);
  t.after(() => { Object.assign(globalThis, old); dom.window.close(); });
  const deleted = { shader: 0, program: 0, buffer: 0 };
  let linked = true;
  const gl = new Proxy({
    createProgram: () => ({}), createBuffer: () => ({}), createShader: () => ({}),
    deleteShader: () => deleted.shader++, deleteProgram: () => deleted.program++, deleteBuffer: () => deleted.buffer++,
    getProgramParameter: () => linked, isContextLost: () => false,
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = document.querySelector('canvas'), card = document.querySelector('main');
  Object.defineProperties(card, { offsetWidth: { value: 400 }, offsetHeight: { value: 400 } });
  canvas.getContext = () => gl;
  const glow = initGlow(canvas, card);
  glow.stop(); glow.stop();
  assert.deepEqual(deleted, { shader: 2, program: 1, buffer: 1 });
  linked = false;
  assert.equal(initGlow(canvas, card), null);
  assert.deepEqual(deleted, { shader: 4, program: 2, buffer: 1 });
});
