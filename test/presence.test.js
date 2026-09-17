import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchPresence } from '../js/presence.js';

test('lost presence invalidates the old song before reconnecting and ignores obsolete sockets', t => {
  const sockets = [], updates = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    sent = [];
    constructor() { sockets.push(this); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.onclose?.(); }
    message(data) { this.onmessage({ data: JSON.stringify(data) }); }
  }
  const old = globalThis.WebSocket;
  globalThis.WebSocket = Socket;
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const stop = watchPresence('visitor', d => updates.push(d));
  t.after(() => { stop(); globalThis.WebSocket = old; });
  const presence = { discord_user: { id: 'visitor' }, listening_to_spotify: true };
  sockets[0].message({ op: 1, d: { heartbeat_interval: 1000 } });
  sockets[0].message({ op: 0, d: presence });
  t.mock.timers.tick(1000);
  assert.deepEqual(sockets[0].sent.at(-1), { op: 3 });
  sockets[0].close();
  assert.equal(updates.at(-1), null);
  t.mock.timers.tick(5000);
  assert.equal(sockets.length, 2);
  sockets[0].message({ op: 0, d: presence });
  assert.equal(updates.at(-1), null);
  assert.doesNotThrow(() => sockets[1].onmessage({ data: '{' }));
  sockets[1].message({ op: 0, d: presence });
  assert.deepEqual(updates.at(-1), presence);
  stop(); t.mock.timers.tick(60000);
  assert.equal(sockets.length, 2);
});
