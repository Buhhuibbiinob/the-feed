// Username shapes and writing voices for bulk-created bot accounts.
//
// Two goals, both about not looking generated. Usernames follow the shapes
// real people actually pick (separators, leetish padding, a birth year on
// the end) instead of name001/name002. Voices vary the writing itself, so a
// feed of twenty bots doesn't read as twenty copies of the same reviewer.

const FIRST_WORDS = [
  "midnight", "velvet", "rain", "static", "amber", "cobalt", "sunday", "lowkey",
  "ghost", "honey", "neon", "paper", "cherry", "silver", "quiet", "moth",
  "saint", "june", "wilted", "glass", "cloud", "ivy", "dizzy", "marble",
  "burnt", "soft", "loud", "tired", "grimy", "sugar", "blue", "feral",
];

const SECOND_WORDS = [
  "tapes", "wav", "mp3", "static", "noise", "reverb", "vinyl", "static",
  "dreams", "hours", "nights", "radio", "static", "bass", "loops", "demos",
  "skips", "fuzz", "echo", "drums", "keys", "verse", "bridge", "outro",
];

const HANDLE_NAMES = [
  "kaya", "deja", "marisol", "priya", "nia", "tobi", "juno", "sasha",
  "amaru", "leila", "kwame", "rosa", "yuki", "dani", "malik", "esme",
  "theo", "imani", "andres", "zuri", "noor", "cass", "rio", "mika",
  "jaz", "omar", "lena", "devon", "asha", "bo", "quin", "sol",
];

const SUFFIXES = ["", "", "", "x", "xo", "yy", "ie", "z", "_", "._"];

// Years that read as a birth year for someone posting now, plus the small
// numbers people pad a taken handle with.
const NUMBERS = ["", "", "", "01", "02", "03", "04", "05", "06", "07", "99", "00", "7", "23", "13", "4"];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Username shapes, weighted by how common each is in the wild. */
const SHAPES: (() => string)[] = [
  () => `${pick(HANDLE_NAMES)}_${pick(SECOND_WORDS)}`,
  () => `${pick(HANDLE_NAMES)}.${pick(SECOND_WORDS)}`,
  () => `${pick(FIRST_WORDS)}_${pick(HANDLE_NAMES)}`,
  () => `${pick(FIRST_WORDS)}.${pick(SECOND_WORDS)}`,
  () => `${pick(HANDLE_NAMES)}x${pick(HANDLE_NAMES)}`,
  () => `x${pick(FIRST_WORDS)}x`,
  () => `xX${pick(FIRST_WORDS)}Xx`,
  () => `_${pick(HANDLE_NAMES)}_`,
  () => `${pick(FIRST_WORDS)}${pick(SECOND_WORDS)}`,
  () => `${pick(HANDLE_NAMES)}${pick(NUMBERS)}`,
  () => `${pick(HANDLE_NAMES)}_${pick(NUMBERS)}`,
  () => `${pick(FIRST_WORDS)}${pick(SUFFIXES)}`,
];

// Must satisfy the same rule the manual create form enforces:
// 3-20 chars, letters/numbers/period/underscore only.
const USERNAME_RE = /^[a-zA-Z0-9._]{3,20}$/;

/**
 * A username nobody in `taken` is using. Adds a number and finally a random
 * suffix on collision, the same way a person would when their first pick is
 * gone. Returns null if it somehow can't find a free one.
 */
export function generateUsername(taken: Set<string>): string | null {
  for (let attempt = 0; attempt < 60; attempt++) {
    let candidate = pick(SHAPES)();
    if (attempt > 20) candidate += pick(NUMBERS.filter(Boolean));
    if (attempt > 40) candidate += Math.floor(Math.random() * 900 + 100);

    candidate = candidate.slice(0, 20).replace(/[._]+$/, "");
    if (!USERNAME_RE.test(candidate)) continue;
    if (taken.has(candidate.toLowerCase())) continue;
    return candidate;
  }
  return null;
}

// How a bot types. Described rather than simulated: the model writes in the
// register, instead of us find-and-replacing words into a caricature.
const WRITING_STYLES = [
  "types in all lowercase with barely any punctuation, sentences just run into each other",
  "writes in short clipped fragments. like this. one thought per line",
  "texting shorthand throughout - u, ur, rn, tbh, ngl - but still says something specific",
  "African American Vernacular English, written naturally the way they actually talk, not performed",
  "London slang, casual and quick, but never reaches for the same filler twice",
  "Southern US phrasing, warm and unhurried, occasionally starts a sentence with 'man'",
  "Caribbean-inflected English, relaxed rhythm to the sentences",
  "over-enthusiastic, leans on caps for emphasis on ONE word per post, lots of energy",
  "deadpan and dry, understates everything, never more than two sentences",
  "fast typer who doesn't reread - occasional missing letter or doubled word, no big deal",
  "full punctuation and complete sentences, slightly older than everyone else here",
  "asks a question at the end of almost every post, wants other people to weigh in",
  "compares everything to something older, always reaching for a reference point",
  "very online, ironic, undercuts their own praise with a joke",
  "sincere and a little earnest, says when something made them emotional",
  "technical about sound - mix, low end, drum choice - without being a snob about it",
];

// What they're into. Kept separate from style so the two mix freely.
const TASTES = [
  "2000s R&B and anything with live drums",
  "underground rap, the weirder the beat the better",
  "shoegaze and anything drenched in reverb",
  "pop with a real bridge, will defend chart music to anyone",
  "afrobeats and amapiano, tracks that are built for a room",
  "90s alt rock and the bands that came out of it",
  "hyperpop and whatever it turned into",
  "jazz-leaning hip hop and dusty samples",
  "horror movies and anything with a bad ending",
  "prestige TV, watches everything twice",
  "K-pop production, cares about the vocal arrangement",
  "country that isn't on the radio",
  "club music - jersey, baltimore, footwork",
  "singer-songwriter stuff, lyrics first",
  "soundtrack and score, notices the music in every film",
  "reggaeton and Latin pop, dances while reviewing",
  "metal, but has range and will admit it",
  "old soul records inherited from a parent",
  "anime openings and game soundtracks unironically",
  "whatever their friends send them, no fixed taste, just enthusiastic",
];

/** A persona line combining taste and typing voice, which is what every
 * prompt in bots.ts is handed to shape the writing. */
export function generatePersona(): string {
  return `Into ${pick(TASTES)}. Writing voice: ${pick(WRITING_STYLES)}.`;
}

/**
 * A fixed cast of bots, so the site can be populated in one click with
 * accounts that read as a real mixed community rather than a random draw.
 *
 * Deliberately balanced: a spread of genders implied by handle and voice,
 * different regions and registers, and tastes that don't all cluster on the
 * same three genres. A feed where every account sounds like the same
 * 19-year-old pop fan is the thing that makes a place feel fake, and it also
 * narrows who feels welcome posting alongside them.
 */
export const PREMADE_BOTS: { username: string; persona: string; register: string }[] = [
  // Persona is taste and personality. Register is typing, and it is set
  // explicitly here rather than hashed, so a curated cast is guaranteed to
  // cover every register instead of clustering on whichever the hash likes.
  // The two were previously mixed into one string, which is how "fr" and
  // "proper" ended up prescribed to specific accounts.
  {
    username: "bigmoodmarcus",
    persona:
      "Into underground rap, the weirder the beat the better. African American Vernacular English, written naturally the way he actually talks, never performed. Quick to call something a favourite.",
    register: "texter",
  },
  {
    username: "reeni.wav",
    persona:
      "Into 2000s R&B and anything with live drums. Gets emotional about songs and admits it without embarrassment.",
    register: "rambler",
  },
  {
    username: "declanfromleeds",
    persona:
      "Into 90s alt rock and the bands that came out of it. Northern English, dry, understates everything and rarely says he loves anything outright.",
    register: "deadpan",
  },
  {
    username: "auntie_pat",
    persona:
      "Into old soul records and the gospel she grew up on. Warm, generous, treats every post like she is talking to someone she knows. Compares new things to records from decades ago.",
    register: "careful",
  },
  {
    username: "kenji.loops",
    persona:
      "Into jazz-leaning hip hop and dusty samples. Notices what a track is built from and says so plainly, without showing off.",
    register: "clipped",
  },
  {
    username: "sof_iaaa",
    persona:
      "Into reggaeton and Latin pop, dances while listening. Openly enthusiastic, no irony anywhere in her.",
    register: "shouty",
  },
  {
    username: "grimwatcher",
    persona:
      "Into horror films and anything with a bad ending. Unbothered by things other people find upsetting, mildly disappointed when something plays it safe.",
    register: "sloppy",
  },
  {
    username: "tolu.ade",
    persona:
      "Into afrobeats and amapiano, tracks built for a room full of people. Always thinking about where a song would land at a party.",
    register: "asker",
  },
  {
    username: "dustyvinyl_ray",
    persona:
      "Into country that never reached the radio and singer-songwriter records. Lyrics first, always. Southern US phrasing, unhurried.",
    register: "careful",
  },
  {
    username: "miamoonrock",
    persona:
      "Into shoegaze and hyperpop, anything drenched in reverb. Very online, ironic, undercuts her own praise with a joke.",
    register: "texter",
  },
];

// ---------------------------------------------------------------------------
// Registers
//
// Every bot used to receive one shared block of formatting rules that
// mandated lowercase, constant abbreviation and phonetic spelling. That
// flattened all sixteen writing styles into a single voice: the style
// saying "full punctuation and complete sentences, slightly older than
// everyone else here" was being told two lines later to abbreviate
// constantly, and the abbreviation list itself is where "fr" came from.
//
// A register is how someone types, held separately from what they like and
// how they talk. Each bot gets exactly one, chosen deterministically from
// its name so the same account always writes the same way.
// ---------------------------------------------------------------------------

export type Register = { id: string; rules: string };

export const REGISTERS: Register[] = [
  {
    id: "texter",
    rules: `Type like a phone message. All lowercase. Skip apostrophes (dont, thats, im). Shorten words: u, ur, rn, idk, tbh, prob, bc, tho. End without punctuation.`,
  },
  {
    id: "clipped",
    rules: `Short fragments, one thought each. Full stops after every one. Normal spelling, no shortening. Never more than three fragments.`,
  },
  {
    id: "careful",
    rules: `Complete sentences with correct capitalisation, apostrophes and full stops. No slang, no abbreviations, no dropped letters. You are older than most people here and you type like it.`,
  },
  {
    id: "rambler",
    rules: `One long run-on that keeps going past where it should stop, commas doing the work full stops ought to, and it trails off rather than landing anywhere.`,
  },
  {
    id: "shouty",
    rules: `Normal sentences and normal punctuation, but exactly ONE word per post goes in full caps for emphasis. Enthusiastic. Never more than one exclamation mark.`,
  },
  {
    id: "deadpan",
    rules: `Two sentences at most. Flat and understated. No intensifiers, no exclamation marks, no enthusiasm words. The restraint is the joke.`,
  },
  {
    id: "asker",
    rules: `Say your piece in a sentence or two with ordinary punctuation, then end on a real question to the room. You genuinely want an answer.`,
  },
  {
    id: "sloppy",
    rules: `You type fast and never reread. Ordinary words and ordinary register, but leave one real mistake: a missing letter, a doubled word, or a sentence that restarts halfway. Do not correct it.`,
  },
];

/** Look up a register by id, for the premade cast's explicit choices. */
export function registerById(id: string): Register | null {
  return REGISTERS.find((r) => r.id === id) ?? null;
}

/** Stable per-bot register, so an account's typing never changes on it.
 *  Used for bots created in bulk, where there is no curated choice. */
export function registerFor(seed: string): Register {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return REGISTERS[hash % REGISTERS.length];
}

// Tics that turned up in every post because they were being prescribed
// rather than emerging. Stripped from output as a backstop, since a model
// told not to use a word will still reach for it.
export const BANNED_TICS = ["proper", "fr", "deadass", "peak"];
