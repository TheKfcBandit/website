import { test } from 'node:test';
import assert from 'node:assert/strict';

const env = { LOCAL_DEV: true, SPOTIFY_CLIENT_ID: 'test-client', SPOTIFY_CLIENT_SECRET: 'test-secret', SPOTIFY_REFRESH_TOKEN: 'test-refresh', TURNSTILE_SECRET: 'test-turnstile' };
const uri = `spotify:track:${'A'.repeat(22)}`;
let requestId = 0, moduleId = 0;
function context(body, overrides = {}) {
  return { request: new Request('https://example.test/api/queue', {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `test-${++requestId}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), env, ...overrides };
}
const freshQueue = () => import(`../functions/api/queue.js?test=${++moduleId}`);
const freshSearch = () => import(`../functions/api/search.js?test=${++moduleId}`);
function spotifyMock(t, status = 204) {
  return t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('siteverify')) return Response.json({ success: true });
    if (url.includes('/api/token')) return Response.json({ access_token: 'test-access', expires_in: 3600 });
    return new Response(null, { status });
  });
}

test('malformed/null bodies and invalid track URIs never reach external services', async t => {
  const { onRequestPost } = await freshQueue();
  const network = spotifyMock(t);
  for (const body of ['{', 'null', '[]', JSON.stringify({ uri: 'https://spotify.com/bad' })]) {
    assert.equal((await onRequestPost(context(body))).status, 400);
  }
  assert.equal(network.mock.callCount(), 0);
});

test('unconfigured Spotify fails clearly; unverified visitors cannot queue songs', async t => {
  const { onRequestPost } = await freshQueue();
  const network = spotifyMock(t);
  let response = await onRequestPost(context({ uri, token: 'test' }, { env: {} }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'reauth-needed');
  response = await onRequestPost(context({ uri }));
  assert.equal(response.status, 403);
  assert.equal(network.mock.callCount(), 0);
});

test('verified request uses owner token and duplicate requests are throttled', async t => {
  const { onRequestPost } = await freshQueue();
  const network = spotifyMock(t);
  const ctx = context({ uri, token: 'test' });
  const copy = { ...ctx, request: ctx.request.clone() };
  assert.equal((await onRequestPost(ctx)).status, 204);
  const queueCall = network.mock.calls.find(c => c.arguments[0].includes('/v1/me/player/queue'));
  assert.equal(new URL(queueCall.arguments[0]).searchParams.get('uri'), uri);
  assert.equal(queueCall.arguments[1].headers.authorization, 'Bearer test-access');
  assert.equal(queueCall.arguments[1].method, 'POST');
  const response = await onRequestPost(copy);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error, 'slow-down');
  assert.equal(network.mock.calls.filter(c => c.arguments[0].includes('/v1/me/player/queue')).length, 1);
});

for (const [spotifyStatus, status, error] of [[404,409,'not-playing'],[403,409,'forbidden'],[429,429,'slow-down'],[401,503,'reauth-needed'],[500,502,'spotify-error']]) {
  test(`Spotify ${spotifyStatus} returns a useful queue error`, async t => {
    const { onRequestPost } = await freshQueue(); spotifyMock(t, spotifyStatus);
    const response = await onRequestPost(context({ uri, token: 'test' }));
    assert.equal(response.status, status); assert.equal((await response.json()).error, error);
  });
}

test('verification and Spotify network errors fail cleanly', async t => {
  const { onRequestPost } = await freshQueue();
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network offline'); });
  assert.equal((await onRequestPost(context({ uri, token: 'test' }))).status, 403);
  globalThis.fetch = async url => {
    if (url.includes('siteverify')) return Response.json({ success: true });
    throw new Error('network offline');
  };
  assert.equal((await onRequestPost(context({ uri, token: 'test' }))).status, 502);
});

test('search encodes the query, uses the CA market, and tolerates removed tracks', async t => {
  const { onRequestGet } = await freshSearch();
  const network = t.mock.method(globalThis, 'fetch', async url => url.includes('/api/token')
    ? Response.json({ access_token: 'test-access', expires_in: 3600 })
    : Response.json({ tracks: { items: [null, { uri, name: 'Song', artists: [{ name: 'Artist' }], album: { images: [{ url: 'https://example.test/art.png' }] } }] } }));
  const request = new Request('https://example.test/api/search?q=AC%2FDC%20%26%20live', { headers: { 'cf-connecting-ip': `test-${++requestId}` } });
  const res = await onRequestGet({ request, env });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [{ uri, name: 'Song', artist: 'Artist', art: 'https://example.test/art.png' }]);
  const url = new URL(network.mock.calls[1].arguments[0]);
  assert.equal(url.searchParams.get('q'), 'AC/DC & live');
  assert.equal(url.searchParams.get('market'), 'CA');
  assert.equal(url.searchParams.get('limit'), '3');
});

test('empty/oversize search does not use Spotify; network failure returns 502', async t => {
  const { onRequestGet } = await freshSearch();
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  for (const q of ['', 'a'.repeat(101)]) {
    const res = await onRequestGet({ request: new Request(`https://example.test/api/search?q=${q}`), env });
    assert.deepEqual(await res.json(), []);
  }
  assert.equal(network.mock.callCount(), 0);
  const res = await onRequestGet({ request: new Request('https://example.test/api/search?q=song'), env });
  assert.equal(res.status, 502);
});
