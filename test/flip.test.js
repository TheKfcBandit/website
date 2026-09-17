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
  initFlip(card, { reduced, onRotate: angle => rotations.push(angle), onStart: back => starts.push(back) });
  t.after(() => { Object.assign(globalThis, saved); dom.window.close(); });
  return {
    dom, card, rotations, starts, frames,
    front: card.querySelector('.front'), back: card.querySelector('.back'),
    open: card.querySelector('.flip-open'), close: card.querySelector('.flip-close'),
    advance(ms) { now += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); },
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
  assert.equal(ui.rotations.at(-1), 0);
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
  assert.equal(ui.rotations.at(-1), 0);
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
