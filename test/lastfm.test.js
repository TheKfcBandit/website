import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchTrack } from '../js/lastfm.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
test('polling does not overlap and failed/empty responses clear stale now-playing data', async t => {
  const oldDocument = globalThis.document;
  globalThis.document = { hidden: false, addEventListener() {} };
  t.after(() => { globalThis.document = oldDocument; });
  t.mock.timers.enable({ apis: ['setInterval'] });
  let resolve, mode = 'pending';
  const calls = t.mock.method(globalThis, 'fetch', async () => {
    if (mode === 'error') throw new Error('offline');
    if (mode === 'empty') return Response.json({ recenttracks: { track: [] } });
    return new Promise(r => { resolve = r; });
  });
  const updates = [];
  watchTrack('user', 'key', value => updates.push(value));
  t.mock.timers.tick(60000);
  assert.equal(calls.mock.callCount(), 1);
  resolve(Response.json({ recenttracks: { track: [{ name: 'Song', artist: { '#text': 'Artist' }, '@attr': { nowplaying: 'true' } }] } }));
  await flush();
  assert.equal(updates.at(-1).nowPlaying, true);
  mode = 'error'; t.mock.timers.tick(30000); await flush();
  assert.equal(updates.at(-1), null);
  mode = 'empty'; t.mock.timers.tick(30000); await flush();
  assert.equal(updates.at(-1), null);
});
