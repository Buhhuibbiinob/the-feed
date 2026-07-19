// Deterministic placeholder cover art: hashes a seed (e.g. post id) into a
// two-tone gradient so the same item always renders the same "cover", without
// needing real album/poster art from an external API.
export function coverGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const from = `hsl(${hue}, 85%, 75%)`;
  const to = `hsl(${(hue + 40) % 360}, 70%, 30%)`;
  return `linear-gradient(150deg, ${from}, ${to})`;
}
