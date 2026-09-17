import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// Run the real main.js DOM wiring with only the external feeds/GPU stubbed.
const { outputFiles } = await build({
  entryPoints: [new URL('../js/main.js', import.meta.url).pathname], bundle: true, write: false, format: 'iife',
  plugins: [{ name: 'external-feeds', setup(b) {
    b.onResolve({ filter: /\/(presence|lastfm|card|glow)\.js$/ }, args => ({ path: args.path, namespace: 'feeds' }));
    b.onLoad({ filter: /.*/, namespace: 'feeds' }, ({ path }) => ({ contents:
      path.includes('presence') ? 'export const watchPresence = (id, fn) => { window.presence = fn; };' :
      path.includes('lastfm') ? 'export const watchTrack = (id, key, fn) => { window.lastfm = fn; };' :
      path.includes('glow') ? 'export const initGlow = () => null;' : 'export const initCard = async () => null;',
    }));
  } }],
});

test('presence changes preserve immediate progress, dropped connections restore Last.fm, and completed songs expire', t => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window: w } = dom;
  const timers = new Map();
  w.matchMedia = () => ({ matches: true, addEventListener() {} });
  w.setInterval = (fn, ms) => timers.set(ms, fn);
  w.Date.now = () => 1500;
  w.eval(outputFiles[0].text);
  const player = w.document.querySelector('.player'), name = w.document.querySelector('.track .name');
  const presence = { discord_status: 'online', discord_user: {}, activities: [], listening_to_spotify: true,
    spotify: { track_id: 'abc', song: 'Spotify song', artist: 'Artist', timestamps: { start: 1000, end: 2000 } } };
  w.lastfm({ name: 'Last.fm song', artist: 'Artist', url: 'https://last.fm/track', nowPlaying: false, ago: '1m ago' });
  w.presence(presence);
  assert.equal(player.style.getPropertyValue('--p'), '0.5');
  w.presence({ ...presence, discord_status: 'idle' });
  assert.equal(player.style.getPropertyValue('--p'), '0.5');
  w.Date.now = () => 500; timers.get(1000)();
  assert.equal(player.style.getPropertyValue('--p'), '0');
  w.presence(null);
  assert.equal(name.textContent, 'Last.fm song');
  assert.equal(player.style.getPropertyValue('--p'), '');
  assert.equal(w.document.querySelector('.queue').hidden, true);
  w.presence(presence);
  w.Date.now = () => 8000; timers.get(1000)();
  assert.equal(name.textContent, 'Last.fm song');
  assert.equal(w.document.querySelector('.track').hasAttribute('data-spotify'), false);
});
