import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { initFlip } from '../js/flip.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function setup(t, matches = false) {
  const dom = new JSDOM(html);
  const saved = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.document = dom.window.document;
  const frames = new Map(), rotations = [], starts = [];
  let id = 0, now = 0, motionChange;
  globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  t.mock.method(performance, 'now', () => now);
  const reduced = { matches, addEventListener(name, fn) { motionChange = fn; } };
  const card = document.querySelector('.card');
  let captured = null;
  card.setPointerCapture = id => { captured = id; };
  card.hasPointerCapture = id => captured === id;
  card.releasePointerCapture = () => { captured = null; };
  card.getBoundingClientRect = () => ({ width: 400 });
  initFlip(card, { reduced, onRotate: angle => rotations.push(angle), onStart: back => starts.push(back) });
  t.after(() => { Object.assign(globalThis, saved); dom.window.close(); });
  return {
    dom, card, rotations, starts, frames,
    front: card.querySelector('.front'), back: card.querySelector('.back'),
    open: card.querySelector('.front .flip-edge'), close: card.querySelector('.flip-close'),
    advance(ms) { now += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); },
    pointer(type, target, x, y = 100, pointerId = 1) {
      const event = new dom.window.Event(type, { bubbles: true });
      Object.assign(event, { clientX: x, clientY: y, pointerId, button: 0, isPrimary: true });
      target.dispatchEvent(event);
    },
    escape() { document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); },
    reduce() { reduced.matches = true; motionChange(); },
  };
}

test('flip uses 180 degrees and only the visible face is interactive, with focus restored on return', t => {
  const ui = setup(t);
  ui.open.click();
  assert.ok(ui.front.hasAttribute('inert') && ui.back.hasAttribute('inert'));
  ui.advance(230);
  assert.ok(Math.abs(ui.rotations.at(-1) - 90) < 0.001);
  ui.advance(230);
  assert.equal(ui.rotations.at(-1), 180);
  assert.equal(ui.card.dataset.side, 'back');
  assert.ok(ui.front.hasAttribute('inert'));
  assert.equal(ui.back.hasAttribute('inert'), false);
  assert.equal(document.activeElement, ui.back.querySelector('textarea'));
  ui.escape(); ui.advance(460);
  assert.equal(ui.rotations.at(-1), 360);
  assert.equal(ui.card.dataset.side, 'front');
  assert.equal(document.activeElement, ui.open);
  assert.deepEqual(ui.starts, [true, false]);
});

test('reduced motion and changing that preference mid-flip finish on the intended side', t => {
  const ui = setup(t);
  ui.open.click(); ui.advance(100); ui.reduce();
  assert.equal(ui.rotations.at(-1), 180);
  assert.equal(ui.frames.size, 0);
  ui.close.click();
  assert.equal(ui.rotations.at(-1), 360);
  assert.equal(ui.frames.size, 0);
});

test('Escape can reverse a flip before its first frame without invalid transforms', t => {
  const ui = setup(t);
  ui.open.click(); ui.escape();
  assert.equal(ui.rotations.at(-1), 0);
  assert.equal(ui.card.dataset.side, 'front');
  assert.ok(ui.rotations.every(Number.isFinite));
  assert.equal(ui.frames.size, 0);
});

for (const edge of ['left', 'right']) {
  test(`dragging the ${edge} edge follows the pointer and flips both faces`, t => {
    const ui = setup(t), sign = edge === 'left' ? 1 : -1;
    const handle = ui.front.querySelector(`[data-edge="${edge}"]`);
    ui.pointer('pointerdown', handle, 200);
    ui.pointer('pointermove', ui.card, 200 + sign * 120);
    assert.equal(ui.rotations.at(-1), sign * 90);
    ui.pointer('pointerup', ui.card, 200 + sign * 120);
    ui.advance(460);
    assert.equal(ui.card.dataset.side, 'back');
    assert.equal(document.activeElement, ui.back.querySelector('textarea'));
    const reverse = ui.back.querySelector(`[data-edge="${edge}"]`);
    ui.pointer('pointerdown', reverse, 200);
    ui.pointer('pointermove', ui.card, 200 + sign * 120);
    ui.pointer('pointerup', ui.card, 200 + sign * 120);
    ui.advance(460);
    assert.equal(ui.card.dataset.side, 'front');
    assert.equal(document.activeElement, handle);
  });
}

test('short drags and canceled pointers settle back; vertical movement keeps scrolling available', t => {
  const ui = setup(t);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    ui.pointer('pointerdown', ui.open, 0);
    ui.pointer('pointermove', ui.card, event === 'pointerup' ? 30 : 120);
    ui.pointer(event, ui.card, 120);
    ui.advance(460);
    assert.equal(ui.card.dataset.side, 'front');
    assert.equal(ui.front.hasAttribute('inert'), false);
    assert.equal(ui.card.hasAttribute('data-dragging'), false);
  }
  ui.pointer('pointerdown', ui.open, 0);
  ui.pointer('pointermove', ui.card, 1, 120);
  ui.pointer('pointerup', ui.card, 120);
  assert.equal(ui.card.dataset.side, 'front');
  assert.equal(ui.frames.size, 0);
});

test('reduced-motion drags switch only on release and other pointers cannot steal the gesture', t => {
  const ui = setup(t, true);
  ui.pointer('pointerdown', ui.open, 0);
  ui.pointer('pointermove', ui.card, 120, 100, 2);
  assert.equal(ui.rotations.length, 0);
  ui.pointer('pointermove', ui.card, 120);
  assert.equal(ui.rotations.length, 0);
  ui.pointer('pointerup', ui.card, 120);
  assert.equal(ui.card.dataset.side, 'back');
  assert.equal(ui.rotations.at(-1), 180);
  assert.equal(ui.frames.size, 0);
});

for (const edge of ['left', 'right']) {
  test(`the ${edge} edge rotates through multiple full turns without clamping or resetting`, t => {
    const ui = setup(t), sign = edge === 'left' ? 1 : -1;
    const handle = ui.front.querySelector(`[data-edge="${edge}"]`);
    ui.pointer('pointerdown', handle, 0);
    for (const pixels of [240, 480, 720, 960]) {
      ui.pointer('pointermove', ui.card, sign * pixels);
      assert.equal(ui.rotations.at(-1), sign * pixels * 0.75);
    }
    ui.pointer('pointerup', ui.card, sign * 960);
    assert.equal(ui.rotations.at(-1), sign * 720);
    assert.equal(ui.card.dataset.side, 'front');
    assert.equal(ui.frames.size, 0);
    // A new grab continues from that angle instead of jumping back to zero.
    ui.pointer('pointerdown', handle, 0);
    ui.pointer('pointermove', ui.card, sign * 240);
    assert.equal(ui.rotations.at(-1), sign * 900);
    ui.pointer('pointerup', ui.card, sign * 240);
    assert.equal(ui.card.dataset.side, 'back');
    assert.equal(ui.back.hasAttribute('inert'), false);
  });
}

test('an edge accepts outward drags and reversals across the starting angle', t => {
  const ui = setup(t);
  ui.pointer('pointerdown', ui.open, 0);
  ui.pointer('pointermove', ui.card, -300);
  assert.equal(ui.rotations.at(-1), -225);
  ui.pointer('pointermove', ui.card, 520);
  assert.equal(ui.rotations.at(-1), 390);
  ui.pointer('pointerup', ui.card, 520);
  ui.advance(460);
  assert.equal(ui.rotations.at(-1), 360);
  assert.equal(ui.card.dataset.side, 'front');
});

test('canceling after several turns restores the original face without unwinding every turn', t => {
  const ui = setup(t);
  ui.pointer('pointerdown', ui.open, 0);
  ui.pointer('pointermove', ui.card, 1080);
  assert.equal(ui.rotations.at(-1), 810);
  ui.pointer('pointercancel', ui.card, 1080);
  ui.advance(460);
  assert.equal(ui.rotations.at(-1), 720);
  assert.equal(ui.card.dataset.side, 'front');
  assert.equal(ui.frames.size, 0);
});
