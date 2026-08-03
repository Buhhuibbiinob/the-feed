// TMDB (themoviedb.org) powers the movie/TV side of New Releases - upcoming
// movies and TV currently on the air, merged and sorted by date - and Orby's
// genre-aware movie/TV recommendations.
export type TmdbItem = {
  id: string;
  title: string;
  date: string | null;
  imageUrl: string | null;
  mediaType: "movie" | "tv";
};

export type TmdbRecommendation = TmdbItem & {
  overview: string;
  rating: number;
};

type RawTmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
};
type RawTmdbShow = {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
};

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

// Keyword -> TMDB genre id, for movies and TV respectively (the two
// namespaces don't fully overlap, e.g. TV has no bare "Action" genre - it's
// bundled into "Action & Adventure"). Used to turn a free-text request like
// "something scary" or "a good comedy series" into a real genre filter
// instead of blindly guessing from a static seed list.
export const MOVIE_GENRE_WORDS: Record<string, number> = {
  action: 28,
  adventure: 12,
  animated: 16,
  animation: 16,
  cartoon: 16,
  comedy: 35,
  funny: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  historical: 36,
  horror: 27,
  scary: 27,
  spooky: 27,
  musical: 10402,
  mystery: 9648,
  romance: 10749,
  romantic: 10749,
  "sci-fi": 878,
  scifi: 878,
  "science fiction": 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

export const TV_GENRE_WORDS: Record<string, number> = {
  action: 10759,
  adventure: 10759,
  animated: 16,
  animation: 16,
  cartoon: 16,
  comedy: 35,
  funny: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  reality: 10764,
  romance: 10766,
  romantic: 10766,
  "sci-fi": 10765,
  scifi: 10765,
  "science fiction": 10765,
  fantasy: 10765,
  war: 10768,
  western: 37,
};

function simplifyMovie(m: RawTmdbMovie): TmdbRecommendation {
  return {
    id: `movie-${m.id}`,
    title: m.title,
    date: m.release_date ?? null,
    imageUrl: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
    mediaType: "movie",
    overview: m.overview ?? "",
    rating: m.vote_average ?? 0,
  };
}

function simplifyShow(s: RawTmdbShow): TmdbRecommendation {
  return {
    id: `tv-${s.id}`,
    title: s.name,
    date: s.first_air_date ?? null,
    imageUrl: s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : null,
    mediaType: "tv",
    overview: s.overview ?? "",
    rating: s.vote_average ?? 0,
  };
}

// Popular, reasonably well-reviewed titles matching an optional genre -
// backs Orby's recommendations so it's pulling from TMDB's real catalog
// (with real overviews/ratings) instead of guessing at a YouTube trailer
// title.
export async function discoverMovies(genreId?: number, limit = 20): Promise<TmdbRecommendation[]> {
  const genreParam = genreId ? `&with_genres=${genreId}` : "";
  const data = await tmdbFetch<{ results: RawTmdbMovie[] }>(
    `/discover/movie?sort_by=popularity.desc&vote_count.gte=100${genreParam}`
  );
  return (data?.results ?? []).slice(0, limit).map(simplifyMovie);
}

export async function discoverTv(genreId?: number, limit = 20): Promise<TmdbRecommendation[]> {
  const genreParam = genreId ? `&with_genres=${genreId}` : "";
  const data = await tmdbFetch<{ results: RawTmdbShow[] }>(
    `/discover/tv?sort_by=popularity.desc&vote_count.gte=50${genreParam}`
  );
  return (data?.results ?? []).slice(0, limit).map(simplifyShow);
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

export type TmdbPerson = {
  id: string;
  name: string;
  department: string | null;
  knownFor: string[];
};

type RawTmdbPerson = {
  id: number;
  name: string;
  known_for_department?: string;
  known_for?: { title?: string; name?: string }[];
};

// Trending people this week - the only real source on this site for the
// "Up-and-Coming Actors" section, which has no site-generated equivalent.
export async function getTrendingPeople(limit = 10): Promise<TmdbPerson[]> {
  const data = await tmdbFetch<{ results: RawTmdbPerson[] }>("/trending/person/week");
  return (data?.results ?? [])
    .filter((p) => p.name)
    .slice(0, limit)
    .map((p) => ({
      id: `person-${p.id}`,
      name: p.name,
      department: p.known_for_department ?? null,
      knownFor: (p.known_for ?? []).map((k) => k.title || k.name || "").filter(Boolean),
    }));
}
