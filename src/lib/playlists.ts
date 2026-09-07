// Playlists people already made somewhere else.
//
// Nobody is going to rebuild their playlists here, and asking them to
// would be the wrong thing to want: the value is that a playlist someone
// has actually been living with for a year can be put in front of the
// other twelve people, in one paste.
//
// Both providers will embed a playlist for anyone, with no key and no
// account, as long as you have the link. That is the whole feature.
// Connecting an account is a separate and much larger thing - see
// APPLE_MUSIC_CONNECT_NOTE at the bottom.

export type PlaylistProvider =
  | "spotify"
  | "apple"
  | "youtube"
  | "soundcloud"
  | "deezer"
  | "tidal";

export type ParsedPlaylist = {
  provider: PlaylistProvider;
  /** The provider's own id. Stored, and all the embed needs. */
  providerId: string;
  /**
   * Two spare slots for the providers whose address is more than an id.
   *
   * Apple needs a storefront and a slug in the path. SoundCloud has no
   * numeric id at all in a share link - a set IS its uploader and its
   * slug - so it uses the same two fields, uploader in the first. Every
   * other provider leaves both null. Two generic columns rather than one
   * per service, because a new service should be a parser and an embed
   * URL, not a migration.
   */
  storefront: string | null;
  slug: string | null;
};

export const MAX_PLAYLISTS_PER_PERSON = 12;
export const MAX_PLAYLIST_TITLE = 120;

/**
 * A Spotify playlist id out of anything somebody might paste.
 *
 * Four shapes, all of which people really do paste: the web link, the
 * link with Spotify's ?si= share token on the end, the URI you get from
 * "Copy Spotify URI", and a bare id.
 */
function parseSpotify(raw: string): ParsedPlaylist | null {
  const uri = raw.match(/^spotify:playlist:([A-Za-z0-9]{16,32})$/);
  if (uri) return { provider: "spotify", providerId: uri[1], storefront: null, slug: null };

  const web = raw.match(
    /^(?:https?:\/\/)?(?:open|play)\.spotify\.com\/(?:[a-z-]+\/)?playlist\/([A-Za-z0-9]{16,32})(?:[/?#]|$)/
  );
  if (web) return { provider: "spotify", providerId: web[1], storefront: null, slug: null };

  // A bare id. The comment above has always said this was one of the
  // four shapes accepted and it never was, so somebody who copied the id
  // out of the URL bar got told their playlist link was not a playlist
  // link. It is unambiguous enough here: the box asks for a playlist and
  // nothing else this length is made only of base-62.
  const bare = raw.match(/^([A-Za-z0-9]{16,32})$/);
  if (bare) return { provider: "spotify", providerId: bare[1], storefront: null, slug: null };

  return null;
}

/**
 * An Apple Music playlist out of a link.
 *
 * Apple's ids are "pl." followed by a hash - either their own curated
 * ones or a member's, which start "pl.u-". The storefront and the slug
 * are both in the path and both are needed to embed it, so unlike
 * Spotify this is not just an id.
 */
function parseApple(raw: string): ParsedPlaylist | null {
  // Both the storefront and the slug are optional in the wild, and the
  // old pattern required both. Apple hands out
  // /us/playlist/pl.xxx with no slug, and /playlist/name/pl.xxx with no
  // storefront, and every one of those was answered with "that doesn't
  // look like a playlist link" - about a link that came straight off
  // Apple's own share button.
  //
  // The id is the part that is actually required. Everything before it
  // is read if it is there and defaulted if it is not, which is what
  // embedUrl and openUrl have always done anyway.
  const m = raw.match(
    /^(?:https?:\/\/)?(?:embed\.)?music\.apple\.com\/(?:([a-z]{2})\/)?playlist\/(?:([^/]+)\/)?(pl\.[A-Za-z0-9-]+)(?:[/?#]|$)/
  );
  if (!m) return null;
  return {
    provider: "apple",
    providerId: m[3],
    storefront: m[1] ?? null,
    // Apple accepts any slug in the path - it is decoration - but
    // keeping the real one means the link out reads like the playlist
    // rather than like an id.
    slug: m[2] ? decodeURIComponent(m[2]).slice(0, 80) : null,
  };
}

/**
 * A YouTube playlist.
 *
 * The id is in `list=`, wherever the link came from - the playlist page,
 * a video opened from inside a playlist, a youtu.be share, or YouTube
 * Music, which is the same playlists under a different hostname. A bare
 * video link has no `list=` and is refused, which is the point: a song
 * is not a playlist.
 */
function parseYoutube(raw: string): ParsedPlaylist | null {
  if (!/^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\//i.test(raw)) return null;
  const list = raw.match(/[?&]list=([A-Za-z0-9_-]{12,64})/);
  if (!list) return null;
  return { provider: "youtube", providerId: list[1], storefront: null, slug: null };
}

/**
 * A SoundCloud set.
 *
 * "/sets/" is the whole test, and it is a good one: soundcloud.com/user/
 * track is a track and soundcloud.com/user/sets/name is a playlist, so
 * the URL says which without asking anybody.
 */
function parseSoundcloud(raw: string): ParsedPlaylist | null {
  const m = raw.match(
    /^(?:https?:\/\/)?(?:www\.|m\.)?soundcloud\.com\/([A-Za-z0-9_-]+)\/sets\/([A-Za-z0-9_-]+)(?:[/?#]|$)/i
  );
  if (!m) return null;
  return { provider: "soundcloud", providerId: `${m[1]}/${m[2]}`, storefront: m[1], slug: m[2] };
}

/** A Deezer playlist. The locale segment is optional and ignored. */
function parseDeezer(raw: string): ParsedPlaylist | null {
  const m = raw.match(
    /^(?:https?:\/\/)?(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?playlist\/(\d{4,20})(?:[/?#]|$)/i
  );
  if (!m) return null;
  return { provider: "deezer", providerId: m[1], storefront: null, slug: null };
}

/** A Tidal playlist, which is a uuid behind an optional /browse. */
function parseTidal(raw: string): ParsedPlaylist | null {
  const m = raw.match(
    /^(?:https?:\/\/)?(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?playlist\/([0-9a-f-]{32,40})(?:[/?#]|$)/i
  );
  if (!m) return null;
  return { provider: "tidal", providerId: m[1].toLowerCase(), storefront: null, slug: null };
}

/** Whatever somebody pasted, or null if it is not a playlist link. */
export function parsePlaylistUrl(raw: unknown): ParsedPlaylist | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return (
    parseSpotify(trimmed) ??
    parseApple(trimmed) ??
    parseYoutube(trimmed) ??
    parseSoundcloud(trimmed) ??
    parseDeezer(trimmed) ??
    parseTidal(trimmed)
  );
}

/** What goes in the iframe. */
export function embedUrl(playlist: ParsedPlaylist): string {
  switch (playlist.provider) {
    case "spotify":
      return `https://open.spotify.com/embed/playlist/${playlist.providerId}`;
    case "youtube":
      return `https://www.youtube.com/embed/videoseries?list=${playlist.providerId}`;
    case "soundcloud":
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        `https://soundcloud.com/${playlist.providerId}`
      )}&color=%23222222&show_comments=false`;
    case "deezer":
      return `https://widget.deezer.com/widget/dark/playlist/${playlist.providerId}`;
    case "tidal":
      return `https://embed.tidal.com/playlists/${playlist.providerId}`;
    default: {
      const storefront = playlist.storefront ?? "us";
      const slug = playlist.slug ?? "playlist";
      return `https://embed.music.apple.com/${storefront}/playlist/${encodeURIComponent(slug)}/${playlist.providerId}`;
    }
  }
}

/** Where "open in the app" goes. */
export function openUrl(playlist: ParsedPlaylist): string {
  switch (playlist.provider) {
    case "spotify":
      return `https://open.spotify.com/playlist/${playlist.providerId}`;
    case "youtube":
      return `https://www.youtube.com/playlist?list=${playlist.providerId}`;
    case "soundcloud":
      return `https://soundcloud.com/${playlist.providerId}`;
    case "deezer":
      return `https://www.deezer.com/playlist/${playlist.providerId}`;
    case "tidal":
      return `https://tidal.com/browse/playlist/${playlist.providerId}`;
    default: {
      const storefront = playlist.storefront ?? "us";
      const slug = playlist.slug ?? "playlist";
      return `https://music.apple.com/${storefront}/playlist/${encodeURIComponent(slug)}/${playlist.providerId}`;
    }
  }
}

export type Playlist = ParsedPlaylist & {
  id: string;
  /** The artwork, fetched once when it was added. Null if none was found. */
  coverUrl: string | null;
  userId: string;
  title: string;
  note: string | null;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
};

type ProfileRef = { username: string; avatar_url: string | null };

export type PlaylistRow = {
  id: string;
  user_id: string;
  provider: PlaylistProvider;
  provider_id: string;
  storefront: string | null;
  slug: string | null;
  title: string;
  note: string | null;
  created_at: string;
  /** Optional so a database still on 013 does not break the mapping. */
  cover_url?: string | null;
  profiles: ProfileRef | ProfileRef[] | null;
};

/** Rows into something renderable, dropping any whose owner is gone. */
export function toPlaylists(rows: PlaylistRow[]): Playlist[] {
  return rows.flatMap((row) => {
    const owner = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!owner) return [];
    return [
      {
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        providerId: row.provider_id,
        storefront: row.storefront,
        slug: row.slug,
        coverUrl: row.cover_url ?? null,
        title: row.title,
        note: row.note,
        createdAt: row.created_at,
        username: owner.username,
        avatarUrl: owner.avatar_url,
      },
    ];
  });
}

export const PROVIDER_LABELS: Record<PlaylistProvider, string> = {
  spotify: "Spotify",
  apple: "Apple Music",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  deezer: "Deezer",
  tidal: "Tidal",
};

export const PROVIDERS = Object.keys(PROVIDER_LABELS) as PlaylistProvider[];

export function isProvider(value: unknown): value is PlaylistProvider {
  return typeof value === "string" && (PROVIDERS as string[]).includes(value);
}

/**
 * Where to ask for a playlist's cover, without a key.
 *
 * Four of the six answer oEmbed, which is a public endpoint that hands
 * back a thumbnail for any public playlist and costs nothing - no token,
 * no quota, no account. Apple and Tidal have no oEmbed, so those fall
 * back to reading the og:image out of the page, which every one of these
 * services publishes because that is what makes a link unfurl in a chat
 * window.
 */
export function oembedUrl(playlist: ParsedPlaylist): string | null {
  const page = encodeURIComponent(openUrl(playlist));
  switch (playlist.provider) {
    case "spotify":
      return `https://open.spotify.com/oembed?url=${page}`;
    case "youtube":
      return `https://www.youtube.com/oembed?url=${page}&format=json`;
    case "soundcloud":
      return `https://soundcloud.com/oembed?format=json&url=${page}`;
    case "deezer":
      return `https://api.deezer.com/oembed?url=${page}&format=json`;
    default:
      return null;
  }
}

/**
 * Why there is no "Connect Apple Music" button yet.
 *
 * Embedding a playlist by link needs nothing at all, which is why that
 * half works today. Reading somebody's OWN library - their playlists,
 * without them pasting each link - is MusicKit, and MusicKit needs a
 * developer token signed with a private key from a paid Apple Developer
 * account, renewed every six months. There is no way to write that
 * without the key, and a button that opens a dialogue and then fails is
 * worse than no button.
 *
 * The same is true of Spotify's playlist-reading scopes, though those at
 * least reuse the client id this site already has.
 */
export const APPLE_MUSIC_CONNECT_NOTE =
  "Paste a link and it works. No account needed on either service. " +
  "Pulling your playlists in automatically needs an Apple Developer key, " +
  "which the site doesn't have yet.";
