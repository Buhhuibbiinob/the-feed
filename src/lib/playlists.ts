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

export type PlaylistProvider = "spotify" | "apple";

export type ParsedPlaylist = {
  provider: PlaylistProvider;
  /** The provider's own id. Stored, and all the embed needs. */
  providerId: string;
  /** Apple's embed URL contains the storefront and the slug. */
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
  const m = raw.match(
    /^(?:https?:\/\/)?(?:embed\.)?music\.apple\.com\/([a-z]{2})\/playlist\/([^/]+)\/(pl\.[A-Za-z0-9-]+)(?:[/?#]|$)/
  );
  if (!m) return null;
  return {
    provider: "apple",
    providerId: m[3],
    storefront: m[1],
    // Apple accepts any slug in the path - it is decoration - but
    // keeping the real one means the link out reads like the playlist
    // rather than like an id.
    slug: decodeURIComponent(m[2]).slice(0, 80),
  };
}

/** Whatever somebody pasted, or null if it is not a playlist link. */
export function parsePlaylistUrl(raw: unknown): ParsedPlaylist | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return parseSpotify(trimmed) ?? parseApple(trimmed);
}

/** What goes in the iframe. */
export function embedUrl(playlist: ParsedPlaylist): string {
  if (playlist.provider === "spotify") {
    return `https://open.spotify.com/embed/playlist/${playlist.providerId}`;
  }
  const storefront = playlist.storefront ?? "us";
  const slug = playlist.slug ?? "playlist";
  return `https://embed.music.apple.com/${storefront}/playlist/${encodeURIComponent(slug)}/${playlist.providerId}`;
}

/** Where "open in the app" goes. */
export function openUrl(playlist: ParsedPlaylist): string {
  if (playlist.provider === "spotify") {
    return `https://open.spotify.com/playlist/${playlist.providerId}`;
  }
  const storefront = playlist.storefront ?? "us";
  const slug = playlist.slug ?? "playlist";
  return `https://music.apple.com/${storefront}/playlist/${encodeURIComponent(slug)}/${playlist.providerId}`;
}

export type Playlist = ParsedPlaylist & {
  id: string;
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
};

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
  "Paste a link and it works - no account needed, on either service. " +
  "Pulling your playlists in automatically needs an Apple Developer key, " +
  "which the site doesn't have yet.";
