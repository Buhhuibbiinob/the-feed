export type WikiSummary = {
  title: string;
  extract: string;
  url: string;
};

// Pulls a live summary for a club's artist/show from Wikipedia's free,
// keyless REST API so club pages can show up-to-date background info
// without depending on Spotify or any paid service. Never throws — a
// missing or unreachable page just means the panel doesn't render.
export async function getWikipediaSummary(query: string): Promise<WikiSummary | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.extract || data.type === "disambiguation") return null;

    return {
      title: data.title ?? query,
      extract: data.extract,
      url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
    };
  } catch {
    return null;
  }
}
