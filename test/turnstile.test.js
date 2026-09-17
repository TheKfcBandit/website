import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

test('a stalled verification script times out and a subsequent load can retry', async t => {
  const dom = new JSDOM('<div id="ts"></div>');
  const old = { document: globalThis.document, window: globalThis.window, turnstile: globalThis.turnstile };
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  t.after(() => { Object.assign(globalThis, old); dom.window.close(); });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { getToken } = await import('../js/turnstile.js');
  const failed = assert.rejects(getToken(), /could not load/);
  t.mock.timers.tick(10000);
  await failed;
  assert.equal(document.querySelectorAll('script').length, 0);
  let options;
  globalThis.turnstile = {
    render(selector, config) { options = config; return 'widget'; },
    reset() {}, execute() { options.callback('verified-token'); },
  };
  const retried = getToken();
  window.tsReady();
  assert.equal(await retried, 'verified-token');
});
