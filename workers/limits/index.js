// One Durable Object per visitor/action serializes claims across Pages instances.
// No public Worker route: only the Pages binding can reach these objects.
const windows = { search: 200, queue: 60000, note: 30000 };

export class VisitorLimit {
  constructor(ctx) { this.ctx = ctx; this.storage = ctx.storage; }

  async fetch(request) {
    const ms = windows[new URL(request.url).pathname.slice(1)];
    if (request.method !== "POST" || !ms) return new Response(null, { status: 400 });
    const allowed = await this.ctx.blockConcurrencyWhile(async () => {
      const storage = this.storage;
      const now = Date.now();
      if ((await storage.get("until") ?? 0) > now) return false;
      await storage.put("until", now + ms);
      await storage.setAlarm(now + ms);
      return true;
    });
    return new Response(null, { status: allowed ? 204 : 429 });
  }

  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const storage = this.storage;
      const until = await storage.get("until") ?? 0;
      // A delayed/retried alarm must not erase a newer request's limit.
      if (until > Date.now()) await storage.setAlarm(until);
      else await storage.deleteAll();
    });
  }
}

export default { fetch() { return new Response(null, { status: 404 }); } };
