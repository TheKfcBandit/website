export function watchPresence(userId, onUpdate) {
  let heartbeat;
  let delay = 5000;

  function connect() {
    const ws = new WebSocket("wss://api.lanyard.rest/socket");
    ws.onmessage = e => {
      const { op, d } = JSON.parse(e.data);
      if (op === 1) {
        delay = 5000;
        clearInterval(heartbeat);
        heartbeat = setInterval(() => ws.send(JSON.stringify({ op: 3 })), d.heartbeat_interval);
        ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
      } else if (op === 0) {
        onUpdate(d);
      }
    };
    ws.onclose = () => {
      clearInterval(heartbeat);
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, 60000);
    };
  }

  connect();
}
