function since(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function watchTrack(user, apiKey, onUpdate) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&format=json&limit=1&user=${user}&api_key=${apiKey}`;

  async function poll() {
    if (document.hidden) return;
    try {
      const res = await fetch(url);
      const track = (await res.json()).recenttracks.track[0];
      if (!track) return;
      const nowPlaying = track["@attr"]?.nowplaying === "true";
      onUpdate({
        name: track.name,
        artist: track.artist["#text"],
        url: track.url,
        art: track.image[2]?.["#text"],
        nowPlaying,
        ago: nowPlaying ? "now playing" : since(track.date.uts * 1000),
      });
    } catch {}
  }

  poll();
  setInterval(poll, 30000);
}
