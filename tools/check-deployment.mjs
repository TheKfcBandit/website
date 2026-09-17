// Check deployed settings, not just the generated file. Never log secret values.
const environment = process.argv[2];
if (!['production', 'preview'].includes(environment)) throw new Error('Expected production or preview');
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!token || !account) throw new Error('Cloudflare deployment credentials are required');

const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/pages/projects/website`, {
  headers: { authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`Could not check Pages settings (HTTP ${response.status})`);
const data = await response.json();
if (!data.success) throw new Error('Could not check Pages settings');
const config = data.result?.deployment_configs?.[environment];
if (!config?.durable_object_namespaces?.RATE_LIMITS?.namespace_id) {
  throw new Error(`${environment}: RATE_LIMITS was not deployed; note, queue, and search requests would return 503`);
}
const required = ['DISCORD_WEBHOOK_URL', 'TURNSTILE_SECRET', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN'];
const missing = required.filter(name => !config.env_vars?.[name]);
if (missing.length) throw new Error(`${environment}: missing Pages settings: ${missing.join(', ')}`);
console.log(`${environment}: RATE_LIMITS binding and required note/Spotify settings are present.`);
