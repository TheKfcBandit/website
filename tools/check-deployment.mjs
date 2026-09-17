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
const required = ['DISCORD_WEBHOOK_URL', 'TURNSTILE_SECRET', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN'];
const configurations = Object.fromEntries(['production', 'preview'].map(name => {
  const config = data.result?.deployment_configs?.[name];
  const limits = Boolean(config?.durable_object_namespaces?.RATE_LIMITS?.namespace_id);
  const missing = required.filter(key => !config?.env_vars?.[key]);
  console.log(`${name}: RATE_LIMITS ${limits ? 'present' : 'missing'}; missing API settings: ${missing.join(', ') || 'none'}.`);
  return [name, { limits, missing }];
}));
const { limits, missing } = configurations[environment];
if (!limits) {
  throw new Error(`${environment}: RATE_LIMITS was not deployed; note, queue, and search requests would return 503`);
}
if (missing.length && environment === 'production') {
  throw new Error(`production: missing Pages settings: ${missing.join(', ')}`);
}
if (missing.length) {
  // Preview secrets are separate and may be omitted for visual review.
  console.warn('Preview API settings are incomplete; note/Spotify delivery remains unavailable there.');
} else {
  console.log(`${environment}: required note/Spotify settings are present.`);
}
