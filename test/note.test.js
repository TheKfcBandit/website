import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { initNote } from '../js/note.js';
import { onRequestPost } from '../functions/api/note.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const env = { TURNSTILE_SECRET: 'test-secret', DISCORD_WEBHOOK_URL: 'https://discord.example.test/webhook' };
let requestId = 0;
const context = (body, config = env) => ({ env: config, request: new Request('https://example.test/api/note', {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `note-${++requestId}` },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}) });

function setup(t, verify = async () => 'test-token') {
  const dom = new JSDOM(html);
  const form = dom.window.document.querySelector('.note');
  const note = initNote(form, { verify });
  t.after(() => dom.window.close());
  return { note, form, input: form.querySelector('textarea'), send: form.querySelector('button'),
    feedback: () => form.querySelector('.note-feedback').textContent,
    submit() { form.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); },
  };
}

test('invalid notes and honeypot submissions never contact Discord', async t => {
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected network'); });
  for (const body of ['{', 'null', '[]', '{}', { note: 123 }, { note: ' ' }, { note: 'a'.repeat(281) }]) {
    assert.equal((await onRequestPost(context(body))).status, 400);
  }
  assert.equal((await onRequestPost(context({ website: 'bot', note: 'hello' }))).status, 204);
  assert.equal(network.mock.callCount(), 0);
});

test('notes require configuration and verification', async t => {
  const network = t.mock.method(globalThis, 'fetch', async () => Response.json({ success: false }));
  assert.equal((await onRequestPost(context({ note: 'hello', token: 'test' }, {}))).status, 503);
  assert.equal((await onRequestPost(context({ note: 'hello' }))).status, 403);
  assert.equal((await onRequestPost(context({ note: 'hello', token: 'test' }))).status, 403);
  assert.ok(network.mock.calls.every(c => c.arguments[0].includes('siteverify')));
});

test('verified notes reach the configured webhook without triggering mentions', async t => {
  const network = t.mock.method(globalThis, 'fetch', async url => url.includes('siteverify')
    ? Response.json({ success: true }) : new Response(null, { status: 204 }));
  const ctx = context({ note: '  hello @everyone  ', token: 'test' });
  const retry = { ...ctx, request: ctx.request.clone() };
  assert.equal((await onRequestPost(ctx)).status, 204);
  const sent = network.mock.calls.find(c => c.arguments[0] === env.DISCORD_WEBHOOK_URL);
  assert.deepEqual(JSON.parse(sent.arguments[1].body), { username: 'notes', content: 'hello @everyone', allowed_mentions: { parse: [] } });
  assert.ok(sent.arguments[1].signal instanceof AbortSignal);
  assert.equal((await onRequestPost(retry)).status, 429);
  assert.equal(network.mock.calls.filter(c => c.arguments[0] === env.DISCORD_WEBHOOK_URL).length, 1);
});

test('Discord errors and network failures return usable responses', async t => {
  let status = 429;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('siteverify')) return Response.json({ success: true });
    if (!status) throw new Error('offline');
    return new Response(null, { status });
  });
  assert.equal((await onRequestPost(context({ note: 'hello', token: 'test' }))).status, 429);
  status = 500;
  assert.equal((await onRequestPost(context({ note: 'hello', token: 'test' }))).status, 502);
  status = 0;
  assert.equal((await onRequestPost(context({ note: 'hello', token: 'test' }))).status, 502);
});

test('note form prevents duplicate sends and clears only after confirmed success', async t => {
  const post = deferred(), ui = setup(t);
  const network = t.mock.method(globalThis, 'fetch', () => post.promise);
  ui.input.value = 'hello'; ui.submit(); ui.submit(); await settle();
  assert.equal(network.mock.callCount(), 1);
  assert.equal(ui.send.disabled, true);
  assert.equal(ui.input.value, 'hello');
  post.resolve(new Response(null, { status: 204 })); await settle();
  assert.equal(ui.input.value, '');
  assert.equal(ui.feedback(), 'Sent, thanks!');
  assert.equal(ui.send.disabled, false);
});

test('flipping away during verification cancels delivery and preserves the draft', async t => {
  const verification = deferred(), ui = setup(t, () => verification.promise);
  const network = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  ui.input.value = 'draft'; ui.submit(); ui.note.cancel();
  verification.resolve('token'); await settle();
  assert.equal(network.mock.callCount(), 0);
  assert.equal(ui.input.value, 'draft');
  assert.equal(ui.input.readOnly, false);
  assert.equal(ui.send.disabled, false);
});

test('delivery failures preserve the draft and allow another attempt', async t => {
  const ui = setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'not-configured' }, { status: 503 }));
  ui.input.value = 'keep this'; ui.submit(); await settle();
  assert.equal(ui.input.value, 'keep this');
  assert.equal(ui.feedback(), 'Notes are unavailable right now.');
  assert.equal(ui.send.disabled, false);
});
