import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import { initQueue } from '../js/queue.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const song = (name = 'Test Song', id = 'A') => ({ name, artist: 'Test Artist', uri: `spotify:track:${id.repeat(22)}`, art: '' });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup(t, verify = async () => 'test-verification-token') {
  const dom = new JSDOM(html, { url: 'https://example.test/' });
  t.mock.method(globalThis, 'fetch', async () => Response.json([song()]));
  const previous = globalThis.document;
  globalThis.document = dom.window.document;
  const player = document.querySelector('.player');
  const queue = initQueue(player, { verify });
  const button = player.querySelector('.queue'), form = player.querySelector('.find');
  const input = player.querySelector('input'), send = player.querySelector('.send');
  queue.playing(true); button.click();
  t.after(() => { queue.playing(false); dom.window.close(); globalThis.document = previous; });
  return { dom, queue, button, form, input, send,
    type(value) { input.value = value; input.dispatchEvent(new dom.window.Event('input')); },
    submit() { form.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); },
    key(key, target = input) { target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); },
    feedback: () => player.querySelector('.queue-feedback').textContent,
    names: () => [...player.querySelectorAll('.results .n')].map(n => n.textContent),
  };
}

test('all social destinations are real keyboard-accessible links, including a Discord invite', t => {
  const dom = new JSDOM(html);
  t.after(() => dom.window.close());
  const links = [...dom.window.document.querySelectorAll('nav a')];
  assert.equal(links.length, 6);
  const [discord, ...profiles] = links;
  assert.equal(discord.getAttribute('aria-label'), 'Discord');
  // Invite codes can change; validate the destination instead of pinning a code.
  assert.match(discord.getAttribute('href'), /^https:\/\/(?:discord\.gg\/|discord\.com\/invite\/)[A-Za-z0-9-]+\/?$/);
  assert.deepEqual(profiles.map(a => a.href), [
    'https://www.youtube.com/channel/UCVPjxHVPKVtaKiDoOXoiqBg',
    'https://steamcommunity.com/id/TheKfcBandit/',
    'https://open.spotify.com/user/ev7e6bhyilmi51ab40a08puol',
    'https://account.xbox.com/en-US/Profile?gamerTag=ihavbigpens',
    'https://www.last.fm/user/thekfcbandit',
  ]);
  assert.ok(links.every(a => a.tabIndex === 0));
});

test('typing a new query invalidates an older response immediately', async t => {
  const ui = setup(t), old = deferred();
  globalThis.fetch = t.mock.fn(url => url.includes('old') ? old.promise : Promise.resolve(Response.json([song('New Song')])));
  ui.type('old'); await delay(280);
  ui.type('new');
  old.resolve(Response.json([song('Old Song')])); await delay(10);
  assert.deepEqual(ui.names(), []);
  assert.equal(ui.send.disabled, true);
  await delay(280);
  assert.deepEqual(ui.names(), ['New Song']);
});

test('clearing and closing cancel both debounced and in-flight searches', async t => {
  const ui = setup(t), pending = deferred();
  globalThis.fetch = t.mock.fn(() => pending.promise);
  ui.type('cancel'); ui.button.click(); await delay(280);
  assert.equal(fetch.mock.callCount(), 0);
  ui.button.click(); ui.type('pending'); await delay(280);
  ui.type(''); pending.resolve(Response.json([song('Stale')])); await delay(10);
  assert.deepEqual(ui.names(), []);
  assert.equal(ui.input.value, '');
  assert.equal(ui.send.disabled, true);
});

test('keyboard selection queues the selected URI once and restores focus after success', async t => {
  const ui = setup(t), post = deferred();
  globalThis.fetch = t.mock.fn((url, options) => options?.method === 'POST' ? post.promise : Promise.resolve(Response.json([song('One'), song('Two', 'B')])));
  ui.type('query'); await delay(280);
  ui.key('ArrowDown'); ui.submit(); ui.submit(); await delay(10);
  const posts = fetch.mock.calls.filter(c => c.arguments[1]?.method === 'POST');
  assert.equal(posts.length, 1);
  assert.deepEqual(JSON.parse(posts[0].arguments[1].body), { uri: song('Two', 'B').uri, token: 'test-verification-token' });
  post.resolve(new Response(null, { status: 204 })); await delay(10);
  assert.equal(ui.feedback(), 'added to queue');
  ui.input.focus(); ui.submit(); assert.equal(fetch.mock.callCount(), 2);
  await delay(1450);
  assert.equal(ui.form.hidden, true);
  assert.equal(document.activeElement, ui.button);
});

test('closing while verification is pending does not send a queue request', async t => {
  const verify = deferred(), ui = setup(t, () => verify.promise);
  ui.type('song'); await delay(280); ui.submit(); ui.key('Escape');
  verify.resolve('token'); await delay(10);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(ui.form.hidden, true);
  assert.equal(ui.input.disabled, false);
});

test('no-device and search failures are visible and leave a usable picker', async t => {
  const ui = setup(t);
  globalThis.fetch = t.mock.fn((url, options) => options?.method === 'POST'
    ? Promise.resolve(Response.json({ error: 'not-playing' }, { status: 409 }))
    : Promise.resolve(Response.json([song()])));
  ui.type('song'); await delay(280); ui.submit(); await delay(10);
  assert.equal(ui.feedback(), "nothing's playing right now");
  assert.equal(ui.input.disabled, false);
  assert.equal(ui.send.disabled, false);
  globalThis.fetch = t.mock.fn(async () => new Response(null, { status: 502 }));
  ui.type('another'); await delay(280);
  assert.match(ui.feedback(), /couldn't search/);
  assert.equal(ui.send.disabled, true);
  ui.key('Escape');
  assert.equal(ui.button.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, ui.button);
});
