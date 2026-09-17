import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VisitorLimit } from '../workers/limits/index.js';
import { throttled } from '../functions/_lib.js';

function context() {
  const values = new Map();
  let queue = Promise.resolve(), alarm;
  return {
    storage: {
      async get(key) { return values.get(key); },
      async put(key, value) { values.set(key, value); },
      async setAlarm(time) { alarm = time; },
      async deleteAll() { values.clear(); alarm = undefined; },
    },
    blockConcurrencyWhile(fn) {
      const next = queue.then(fn);
      queue = next.catch(() => {});
      return next;
    },
    values, get alarmTime() { return alarm; },
  };
}
const claim = action => new Request(`https://limits/${action}`, { method: 'POST' });

test('concurrent requests and a fresh object share one persisted cooldown', async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const ctx = context(), object = new VisitorLimit(ctx);
  const responses = await Promise.all(Array.from({ length: 5 }, () => object.fetch(claim('queue'))));
  assert.deepEqual(responses.map(r => r.status), [204, 429, 429, 429, 429]);
  assert.equal((await new VisitorLimit(ctx).fetch(claim('queue'))).status, 429);
  now = 61000;
  assert.equal((await new VisitorLimit(ctx).fetch(claim('queue'))).status, 204);
  // An old alarm arriving after renewal must preserve the new cooldown.
  await object.alarm();
  assert.equal(ctx.values.get('until'), 121000);
  assert.equal(ctx.alarmTime, 121000);
  now = 121000;
  await object.alarm();
  assert.equal(ctx.values.size, 0);
});

test('separate Pages modules use the same limiter; actions and visitors remain independent', async () => {
  const objects = new Map();
  const env = { RATE_LIMITS: {
    idFromName: key => key,
    get(key) {
      if (!objects.has(key)) objects.set(key, new VisitorLimit(context()));
      return { fetch: (url, options) => objects.get(key).fetch(new Request(url, options)) };
    },
  } };
  const a = await import('../functions/_lib.js?instance=a');
  const b = await import('../functions/_lib.js?instance=b');
  const request = ip => new Request('https://example.test/api/queue', { headers: { 'cf-connecting-ip': ip } });
  assert.equal(await a.throttled(request('visitor-a'), env, 'queue', 60000), false);
  assert.equal(await b.throttled(request('visitor-a'), env, 'queue', 60000), true);
  assert.equal(await b.throttled(request('visitor-b'), env, 'queue', 60000), false);
  assert.equal(await b.throttled(request('visitor-a'), env, 'note', 30000), false);
});

test('missing or failed production bindings fail closed, without silently using a local Map', async () => {
  const request = new Request('https://example.test/');
  await assert.rejects(throttled(request, {}, 'queue', 60000), /binding/);
  await assert.rejects(throttled(request, { RATE_LIMITS: {
    idFromName: x => x, get: () => ({ fetch: async () => new Response(null, { status: 500 }) }),
  } }, 'queue', 60000), /unavailable/);
});

test('development limits preserve active entries when more than 1,000 visitors arrive', async t => {
  t.mock.method(Date, 'now', () => 100000);
  const request = ip => new Request('http://localhost/api/note', { headers: { 'cf-connecting-ip': ip } });
  const env = { LOCAL_DEV: true };
  assert.equal(await throttled(request('original'), env, 'note', 30000), false);
  for (let i = 0; i < 1002; i++) await throttled(request(`visitor-${i}`), env, 'note', 30000);
  assert.equal(await throttled(request('original'), env, 'note', 30000), true);
});
