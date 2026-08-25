// Which panels a profile is made of, in what order, and which are hidden.
//
// The whole arrangement lives on profiles.profile_layout as one ordered
// text[]: a plain id is a shown section, an id prefixed with "-" is one the
// member turned off. Keeping hidden sections *in* the list is what lets the
// order survive turning something off and back on, and it means a section
// added in a later release (absent from the list entirely) can be appended
// as shown rather than being invisible to everyone who ever saved a layout.

export const PROFILE_SECTIONS = [
  { id: "obsessed", label: "Currently obsessed with" },
  { id: "song", label: "Profile song" },
  { id: "favorites", label: "Top artists, movies & shows" },
  { id: "stats", label: "Stats" },
  { id: "clubs", label: "Clubs" },
  { id: "reviews", label: "Reviews" },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

export type LayoutEntry = { id: ProfileSectionId; shown: boolean };

export const DEFAULT_SECTION_ORDER: ProfileSectionId[] = PROFILE_SECTIONS.map((s) => s.id);

const SECTION_IDS = new Set<string>(DEFAULT_SECTION_ORDER);

export function isProfileSectionId(value: unknown): value is ProfileSectionId {
  return typeof value === "string" && SECTION_IDS.has(value);
}

export function sectionLabel(id: ProfileSectionId): string {
  return PROFILE_SECTIONS.find((s) => s.id === id)!.label;
}

/** Parses the stored column into an entry per section, in display order. */
export function resolveProfileLayout(stored: string[] | null | undefined): LayoutEntry[] {
  const entries: LayoutEntry[] = [];
  const seen = new Set<ProfileSectionId>();

  for (const raw of stored ?? []) {
    if (typeof raw !== "string") continue;
    const shown = !raw.startsWith("-");
    const id = shown ? raw : raw.slice(1);
    if (!isProfileSectionId(id) || seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, shown });
  }

  for (const id of DEFAULT_SECTION_ORDER) {
    if (!seen.has(id)) entries.push({ id, shown: true });
  }

  return entries;
}

/** Encodes an arrangement back into the stored text[] form. */
export function encodeProfileLayout(entries: LayoutEntry[]): string[] {
  return entries.map((e) => (e.shown ? e.id : `-${e.id}`));
}

/**
 * Validates a submitted arrangement. Anything unrecognised, duplicated or
 * missing is dropped or appended, so a stale form post can't corrupt the
 * column or lose a section.
 */
export function sanitizeProfileLayout(raw: string[]): string[] {
  return encodeProfileLayout(resolveProfileLayout(raw));
}
