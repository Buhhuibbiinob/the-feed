// The one pinned thing at the top of a profile. Separate from the
// currently-listening status: the status is "right now", this is the thing
// the member wants sitting at the top of their page until they change it.

export const OBSESSED_KINDS = ["artist", "album", "song", "movie", "show"] as const;
export type ObsessedKind = (typeof OBSESSED_KINDS)[number];

export const OBSESSED_LABELS: Record<ObsessedKind, string> = {
  artist: "Artist",
  album: "Album",
  song: "Song",
  movie: "Movie",
  show: "Show",
};

export function isObsessedKind(value: unknown): value is ObsessedKind {
  return typeof value === "string" && (OBSESSED_KINDS as readonly string[]).includes(value);
}
