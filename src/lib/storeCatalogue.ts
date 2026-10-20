import type { SupabaseClient } from "@supabase/supabase-js";
import { itunesFetch } from "@/lib/itunes";
import { normalizeName, workKey } from "@/lib/works";
import { SCENE_ROSTER, SEED_ARTISTS } from "@/lib/lastfm";
import { ALBUM_ARTIST_SEEDS, FILM_SEEDS, type FilmSeed } from "@/lib/storeSeeds";
import type { StoreFormat, StoreMediaType } from "@/lib/store";

// Filling the record store's catalogue from Apple.
//
// Apple's Search API is already how this site gets album art and clips,
// it needs no key, and it has films too: the poster, the synopsis, the
// director and a trailer, all on one record. Using it for both halves of
// the shop means no new provider, and it means a DVD's cover and its
// title come from the same catalogue entry - the poster cannot belong to
// a different film than the name printed under it.
//
// The one way that can still go wrong is asking for "Heat" and being
// handed a different film called Heat. So a match is strict: the same
// title once normalised, and for a film the same year give or take one
// (release dates drift between countries). Nothing close-enough is ever
// stocked. A seed with no exact match is written down as a miss and the
// shelf slot goes to something else.

// ---------- what Apple sends ----------

export type ItunesSongRow = {
  wrapperType?: string;
  kind?: string;
  trackName?: string;
  artistName?: string;
  collectionId?: number;
  collectionName?: string;
  collectionViewUrl?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackCount?: number;
};

export type ItunesMovieRow = {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  shortDescription?: string;
  longDescription?: string;
};

/** A row ready for store_items. */
export type CatalogueItem = {
  work_key: string;
  media_type: StoreMediaType;
  format: StoreFormat;
  title: string;
  artist: string | null;
  year: number | null;
  genre: string | null;
  blurb: string | null;
  artwork_url: string;
  preview_url: string | null;
  preview_label: string | null;
  store_url: string | null;
  source: "itunes";
  source_id: string;
};

// ---------- formats ----------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Which shelf a record sits on, from the year it came out.
 *
 * The same idea as formatForYear in physicalMedia.ts - an object from
 * the wrong era reads as decoration - widened for a shop that has to
 * stock every section. Overlapping years, where both formats were on
 * sale, are split by a stable hash so a record is always on the same
 * shelf.
 */
export function storeFormatFor(year: number | null, key: string): Exclude<StoreFormat, "dvd"> {
  const flip = hash(key) % 2 === 0;
  if (!year) return flip ? "cd" : "vinyl";
  if (year < 1979) return "vinyl";
  if (year < 1991) return "cassette";
  if (year < 2000) return flip ? "cd" : "cassette";
  if (year < 2008) return "cd";
  // The vinyl revival: new records come out on both.
  return flip ? "vinyl" : "cd";
}

// ---------- titles ----------

// Edition noise Apple adds to album names. Stripped for display and for
// the work key, so "Rumours (Super Deluxe)" and "Rumours" are one album
// and can't be owned twice. Only these words: a bracket that says
// something else is part of the name.
const EDITION =
  /\s*[([](?:[^()[\]]*\b(?:remaster(?:ed)?|deluxe|expanded|anniversary|edition|bonus|version|reissue|special|collector'?s|explicit|clean|mono|stereo)\b[^()[\]]*)[)\]]\s*$/i;

export function cleanAlbumTitle(name: string): string {
  let out = name.trim();
  for (let i = 0; i < 3 && EDITION.test(out); i++) out = out.replace(EDITION, "").trim();
  return out;
}

function isSingleOrEp(name: string): boolean {
  return /\s-\s(single|ep)$/i.test(name.trim());
}

function yearOf(date: string | undefined): number | null {
  const y = Number(date?.slice(0, 4));
  return Number.isFinite(y) && y >= 1900 ? y : null;
}

/** Apple's 100px thumbnail URL, asked for at a useful size instead. */
export function largerArtwork(url: string, size = 600): string {
  return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);
}

// ---------- albums ----------

/**
 * The albums one artist search can confidently stock.
 *
 * Takes the songs Apple returns for an artist, keeps only those whose
 * artist IS the artist (normalised equality, not "contains" - Prince is
 * not Prince Royce), groups them into their albums, drops singles and
 * EPs, and returns the albums that appeared most, which are the ones
 * people play. The artwork on each is that album's own, from the songs
 * on it; the preview is one of those songs.
 */
export function pickAlbums(rows: ItunesSongRow[], artist: string, limit = 2): CatalogueItem[] {
  const want = normalizeName(artist);
  if (!want) return [];
  type Group = { rows: ItunesSongRow[]; title: string; year: number | null };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    if (r.wrapperType !== "track" || r.kind !== "song") continue;
    if (!r.collectionName || !r.artworkUrl100 || !r.artistName) continue;
    if (normalizeName(r.artistName) !== want) continue;
    if (isSingleOrEp(r.collectionName)) continue;
    const title = cleanAlbumTitle(r.collectionName);
    const key = normalizeName(title);
    if (!key) continue;
    const g = groups.get(key) ?? { rows: [], title, year: null };
    g.rows.push(r);
    // The earliest copy's year, so a remaster does not move a 1977
    // record onto the CD rack.
    const y = yearOf(r.releaseDate);
    if (y !== null && (g.year === null || y < g.year)) g.year = y;
    // Prefer the plain edition's name and art when both are present.
    if (r.collectionName === title) g.title = title;
    groups.set(key, g);
  }

  return [...groups.values()]
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, limit)
    .map((g) => {
      // The plain edition's own record when there is one, for its art.
      const face = g.rows.find((r) => r.collectionName === g.title) ?? g.rows[0];
      const withClip = g.rows.find((r) => r.previewUrl && r.collectionId === face.collectionId)
        ?? g.rows.find((r) => r.previewUrl);
      const key = workKey("music", g.title, face.artistName!);
      return {
        work_key: key,
        media_type: "music" as const,
        format: storeFormatFor(g.year, key),
        title: g.title,
        artist: face.artistName!,
        year: g.year,
        genre: face.primaryGenreName ?? null,
        blurb: null,
        artwork_url: largerArtwork(face.artworkUrl100!),
        preview_url: withClip?.previewUrl ?? null,
        preview_label: withClip?.trackName ?? null,
        store_url: face.collectionViewUrl ?? null,
        source: "itunes" as const,
        source_id: `album:${face.collectionId}`,
      };
    });
}

// ---------- films ----------

/** Apple sometimes names a film "Heat (1995)". The year is not the title. */
function filmName(raw: string): string {
  return raw.replace(/\s*\(\d{4}\)\s*$/, "").trim();
}

/**
 * The one catalogue record that is this film, or null.
 *
 * With a year: the title must match exactly once normalised and the year
 * must be within one. Without a year (a film somebody reviewed, which
 * the site stores by title only): the title must match and every match
 * must be the same film, or the answer is null - "Dune" alone could be
 * 1984 or 2021, and guessing is how a DVD gets the wrong poster.
 */
export function matchFilm(rows: ItunesMovieRow[], seed: { title: string; year?: number | null }): ItunesMovieRow | null {
  const want = normalizeName(seed.title);
  if (!want) return null;
  const same = rows.filter(
    (r) =>
      r.wrapperType === "track" &&
      r.kind === "feature-movie" &&
      !!r.trackName &&
      !!r.artworkUrl100 &&
      normalizeName(filmName(r.trackName)) === want
  );
  if (seed.year) {
    const year = seed.year;
    const close = same.filter((r) => {
      const y = yearOf(r.releaseDate);
      return y !== null && Math.abs(y - year) <= 1;
    });
    // Two different films with the same name a year apart is not a match.
    const ids = new Set(close.map((r) => r.trackId));
    return ids.size === 1 ? close[0] : null;
  }
  const years = new Set(same.map((r) => yearOf(r.releaseDate)));
  return same.length > 0 && years.size === 1 && !years.has(null) ? same[0] : null;
}

export function filmItem(r: ItunesMovieRow): CatalogueItem {
  const title = filmName(r.trackName!);
  const blurb = (r.shortDescription || r.longDescription || "").trim();
  return {
    work_key: workKey("movie_tv", title),
    media_type: "movie_tv",
    format: "dvd",
    title,
    artist: r.artistName ?? null,
    year: yearOf(r.releaseDate),
    genre: r.primaryGenreName ?? null,
    blurb: blurb ? (blurb.length > 320 ? `${blurb.slice(0, 317).trimEnd()}...` : blurb) : null,
    artwork_url: largerArtwork(r.artworkUrl100!),
    preview_url: r.previewUrl ?? null,
    preview_label: r.previewUrl ? "Trailer" : null,
    store_url: r.trackViewUrl ?? null,
    source: "itunes",
    source_id: `movie:${r.trackId}`,
  };
}

// ---------- restocking ----------

type Candidate =
  | { key: string; kind: "artist"; artist: string }
  | { key: string; kind: "film"; film: FilmSeed | { title: string; year: null } };

/** Every seed, as a candidate key. Order is shuffled per run by the caller. */
export function allCandidates(community: { artists: string[]; films: string[] }): Candidate[] {
  const artists = new Set<string>([
    ...ALBUM_ARTIST_SEEDS,
    ...SEED_ARTISTS,
    ...Object.values(SCENE_ROSTER).flat(),
    ...community.artists,
  ]);
  const out: Candidate[] = [];
  for (const artist of artists) {
    const n = normalizeName(artist);
    if (n) out.push({ key: `artist:${n}`, kind: "artist", artist });
  }
  for (const film of FILM_SEEDS) {
    out.push({ key: `film:${normalizeName(film.title)}:${film.year}`, kind: "film", film });
  }
  for (const title of community.films) {
    const n = normalizeName(title);
    if (n) out.push({ key: `film:${n}:`, kind: "film", film: { title, year: null } });
  }
  return out;
}

/** How many lookups one restock may spend. Apple allows about twenty a minute. */
export const RESTOCK_BUDGET = 12;
/** Ask again about a seed that found nothing after this long. */
const MISS_RETRY_DAYS = 21;
/** A restock at most this often, whatever triggers it. */
const RESTOCK_EVERY_MINUTES = 10;

export type RestockReport = {
  ran: boolean;
  asked: number;
  added: number;
  missed: number;
  throttled: boolean;
};

/**
 * Claims the right to restock, so a busy hour starts one restock rather
 * than one per visitor. The lock is a row in store_candidates whose
 * timestamp only one caller can move forward.
 */
async function claimRestock(admin: SupabaseClient, force: boolean): Promise<boolean> {
  const now = new Date();
  await admin
    .from("store_candidates")
    .upsert({ key: "__restock__", found: 0, tried_at: new Date(0).toISOString() }, { onConflict: "key", ignoreDuplicates: true });
  const cutoff = force ? now : new Date(now.getTime() - RESTOCK_EVERY_MINUTES * 60_000);
  const { data } = await admin
    .from("store_candidates")
    .update({ tried_at: now.toISOString() })
    .eq("key", "__restock__")
    .lte("tried_at", cutoff.toISOString())
    .select("key");
  return (data?.length ?? 0) > 0;
}

/**
 * One round of restocking: asks Apple about a handful of seeds the shop
 * has not asked about yet, and adds every confirmed match.
 *
 * Runs with the service role. The catalogue is shared by everybody, so
 * nobody signed in as themselves can write to it.
 */
export async function restock(
  admin: SupabaseClient,
  { budget = RESTOCK_BUDGET, force = false }: { budget?: number; force?: boolean } = {}
): Promise<RestockReport> {
  const report: RestockReport = { ran: false, asked: 0, added: 0, missed: 0, throttled: false };
  if (!(await claimRestock(admin, force))) return report;
  report.ran = true;

  // What members have reviewed recently, so the shop follows the site.
  const { data: recent } = await admin
    .from("posts")
    .select("media_type, title, artist")
    .in("media_type", ["music", "movie_tv"])
    .order("created_at", { ascending: false })
    .limit(300);
  const community = {
    artists: (recent ?? []).filter((p) => p.media_type === "music" && p.artist).map((p) => p.artist as string),
    films: (recent ?? []).filter((p) => p.media_type === "movie_tv").map((p) => p.title as string),
  };

  const { data: tried } = await admin.from("store_candidates").select("key, found, tried_at");
  const retryBefore = Date.now() - MISS_RETRY_DAYS * 86_400_000;
  const done = new Set(
    (tried ?? [])
      .filter((t) => t.found > 0 || new Date(t.tried_at).getTime() > retryBefore)
      .map((t) => t.key as string)
  );

  // Films and records alternate, so neither half of the shop starves.
  const fresh = allCandidates(community).filter((c) => !done.has(c.key));
  const shuffled = fresh
    .map((c) => ({ c, r: hash(c.key + new Date().toISOString().slice(0, 13)) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.c);
  const films = shuffled.filter((c) => c.kind === "film");
  const artists = shuffled.filter((c) => c.kind === "artist");
  const queue: Candidate[] = [];
  while ((films.length || artists.length) && queue.length < budget) {
    const a = artists.shift();
    if (a) queue.push(a);
    const f = films.shift();
    if (f && queue.length < budget) queue.push(f);
  }

  for (const c of queue) {
    const params =
      c.kind === "artist"
        ? new URLSearchParams({ term: c.artist, media: "music", entity: "song", attribute: "artistTerm", limit: "60" })
        : new URLSearchParams({ term: c.film.title, media: "movie", entity: "movie", limit: "15" });
    const { data, throttled } = await itunesFetch(`https://itunes.apple.com/search?${params.toString()}`);
    if (throttled) {
      // Not a fact about the seed. Stop, and leave it for next time.
      report.throttled = true;
      break;
    }
    report.asked++;
    const rows = ((data as { results?: unknown[] } | null)?.results ?? []) as (ItunesSongRow & ItunesMovieRow)[];
    let items: CatalogueItem[] = [];
    if (c.kind === "artist") {
      items = pickAlbums(rows, c.artist);
    } else {
      const match = matchFilm(rows, c.film);
      items = match ? [filmItem(match)] : [];
    }

    let added = 0;
    for (const item of items) {
      // Unique on the work key and on Apple's id: a second copy of
      // something already stocked is ignored, never doubled.
      const { data: inserted } = await admin
        .from("store_items")
        .upsert(item, { onConflict: "work_key", ignoreDuplicates: true })
        .select("id");
      added += inserted?.length ?? 0;
    }
    report.added += added;
    if (items.length === 0) report.missed++;
    await admin
      .from("store_candidates")
      .upsert({ key: c.key, found: items.length, tried_at: new Date().toISOString() }, { onConflict: "key" });
  }
  return report;
}
