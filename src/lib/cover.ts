// Deterministic placeholder cover art: hashes a seed (e.g. post id) into a
// flat color with a glossy top highlight (not a two-tone diagonal color
// gradient), so the same item always renders the same shiny "cover" without
// needing real album/poster art from an external API.
export function coverGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const base = `hsl(${hue}, 55%, 42%)`;
  return `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0) 55%), linear-gradient(${base}, ${base})`;
}
