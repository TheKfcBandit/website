export function watchPresence(userId, onUpdate) {
  let heartbeat, reconnect, socket;
  let delay = 5000;
  let stopped = false;

  function connect() {
    if (stopped) return;
    const ws = socket = new WebSocket("wss://api.lanyard.rest/socket");
    ws.onmessage = e => {
      if (ws !== socket) return;
      let message;
      try { message = JSON.parse(e.data); } catch { return; }
      const { op, d } = message ?? {};
      if (op === 1 && Number.isFinite(d?.heartbeat_interval) && d.heartbeat_interval > 0) {
        delay = 5000;
        clearInterval(heartbeat);
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 3 }));
        }, d.heartbeat_interval);
        ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
      } else if (op === 0 && d?.discord_user) {
        onUpdate(d);
      }
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (ws !== socket || stopped) return;
      clearInterval(heartbeat);
      onUpdate(null);
      reconnect = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 60000);
    };
  }

  connect();
  return () => {
    stopped = true;
    clearInterval(heartbeat);
    clearTimeout(reconnect);
    socket?.close();
  };
}
