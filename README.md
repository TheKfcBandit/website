# TheKfcBandit — V2

The original dark profile card, rebuilt around a real extruded glass mesh from
Canvas UI Glass Object. The card, glow, floating motion, and pointer tilt share
one projection; the text and controls remain native HTML so links, keyboard
navigation, text selection, and Spotify search keep working normally.

- All six social destinations match `main`, including Discord's `W8Bx8MSH` invite.
- Magnetic social hover, cursor glow, press animation, presence, and music remain.
- Visitors can search Spotify, select with the mouse or arrow keys, and add a song
  to the owner's queue while listening is active. Escape closes the picker.
- WebGPU is preferred, with WebGL2 and then the regular HTML/CSS card as fallbacks.
  No experimental HTML-in-canvas flag is required. Reduced motion disables the
  animated card and glow. Background tabs pause rendering.
- Drag either edge in either direction to rotate through as many turns as you
  like. Release to settle on the nearest face. The edges have no visible markers
  or tooltips, and also work with Enter/Space. Back or Escape returns to the profile.
  The back arrow shares the social icons' magnetic hover and press styles.
  Reduced motion switches sides on release without rotating.
  The hidden face is inert, and keyboard focus follows the visible side.
- Playback progress is clipped into the bottom edge of the player, including
  when the queue search is expanded. Its timing still comes from Lanyard.
  Disconnects and expired tracks fall back to Last.fm; presence-only updates
  preserve progress. Failed Last.fm polls clear stale playback state.

## Development

Use Node 22 or newer:

```sh
npm ci
npm run dev
```

The local server is at `http://127.0.0.1:5050`. It serves the site and runs the
Cloudflare Pages Functions. `npm test` exercises queue interactions and API error
handling with mocked external services. `npm run check` runs those tests and
builds the deployable `dist/` directory.

The vendor bundle is committed so existing zero-build previews still work.
After changing its sources, run `npm run build`; CI checks it is up to date.
See [Canvas UI source notes](js/vendor/SOURCE.md) for the renderer adaptation.

## Spotify and Cloudflare

Keep the existing Cloudflare Pages project, domains, and secrets. The queue needs
`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`, and
`TURNSTILE_SECRET` in each environment where it is used. The note form uses the
existing `DISCORD_WEBHOOK_URL` and the same `TURNSTILE_SECRET`. Production and preview
secrets are configured independently. The Turnstile site key is in
`js/turnstile.js`; its allowed hostnames must include the desired site/preview.
Never commit actual secret values.

For local setup, copy `.dev.vars.example` to `.dev.vars`. The optional
`node tools/spotify-auth.mjs` helper obtains a refresh token with
`user-modify-playback-state` permission. Spotify requires Premium and an active
playback device to accept queue additions. Search uses the app's client
credentials. See [Spotify's queue API](https://developer.spotify.com/documentation/web-api/reference/add-to-queue).

The main-branch deployment workflow builds and deploys `dist/` with Wrangler;
Pages Functions are compiled from the root `functions/` directory. If using
Cloudflare's Git integration, set the build command to `npm run build` and output
directory to `dist`. Committed root assets also remain usable by the existing
zero-build integration. `_routes.json` limits Function invocation to `/api/*`.
Pushes to `codex/**` run the checks and deploy a preview for that branch on the
same Pages project. Production continues to deploy from `main`.

Queue, note, and search cooldowns use the `RATE_LIMITS` Durable Object binding,
so separate Pages instances share the same per-visitor limits. The limiter is a
small private Worker in `workers/limits/`; only expiry times are persisted and
an alarm clears expired storage. Preview and production have separate Workers.
Missing or failed bindings return 503 before a song/note is delivered. The local
loopback server alone uses in-memory cooldowns.

The deployment workflows create/update the limiter, download current Pages
settings, and add only its binding before deploying the site. Generated Wrangler
settings are ignored by git and never published. The existing Cloudflare API
token needs Workers Scripts edit as well as Pages edit permission; no separate
secret value is required. When deploying manually, use the same sequence from
the workflow. See [Pages Durable Object bindings](https://developers.cloudflare.com/pages/functions/bindings/#durable-objects).

## Release review

Before merging changes, review the Pages preview, including the social hover
effects, phone-sized layout, expanded song search, flip, note form, and reduced-motion behavior. On a GPU
browser, `document.body.dataset.stage` reports `webgpu` or `webgl2` after the mesh
loads. If absent, the HTML fallback is active. A real queue addition needs the
configured Spotify/Turnstile environment and active playback; mocked tests do
not verify those account settings. Note delivery likewise needs the configured
Discord webhook and a valid Turnstile hostname; automated tests mock delivery.
