// TMDB (themoviedb.org) powers the movie/TV side of New Releases — upcoming
// movies and TV currently on the air, merged and sorted by date.
export type TmdbItem = {
  id: string;
  title: string;
  date: string | null;
  imageUrl: string | null;
  mediaType: "movie" | "tv";
};

type RawTmdbMovie = { id: number; title: string; release_date?: string; poster_path?: string | null };
type RawTmdbShow = { id: number; name: string; first_air_date?: string; poster_path?: string | null };

async function tmdbFetch<T>(path: string): Promise<T | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const separator = path.includes("?") ? "&" : "?";
    const res = await fetch(`https://api.themoviedb.org/3${path}${separator}api_key=${apiKey}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getUpcomingMoviesAndTv(limit = 20): Promise<TmdbItem[]> {
  const [movies, shows] = await Promise.all([
    tmdbFetch<{ results: RawTmdbMovie[] }>("/movie/upcoming?region=US"),
    tmdbFetch<{ results: RawTmdbShow[] }>("/tv/on_the_air"),
  ]);

  const movieItems: TmdbItem[] = (movies?.results ?? []).map((m) => ({
    id: `movie-${m.id}`,
    title: m.title,
    date: m.release_date ?? null,
    imageUrl: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
    mediaType: "movie",
  }));

  const showItems: TmdbItem[] = (shows?.results ?? []).map((s) => ({
    id: `tv-${s.id}`,
    title: s.name,
    date: s.first_air_date ?? null,
    imageUrl: s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : null,
    mediaType: "tv",
  }));

  return [...movieItems, ...showItems]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, limit);
}
