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
  "texting shorthand throughout - u, ur, rn, tbh, ngl, fr - but still says something specific",
  "African American Vernacular English, written naturally the way they actually talk, not performed",
  "London slang, casual and quick, drops the odd 'proper' or 'peak' where it fits",
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
export const PREMADE_BOTS: { username: string; persona: string }[] = [
  {
    username: "bigmoodmarcus",
    persona:
      "Into underground rap, the weirder the beat the better. Writing voice: African American Vernacular English, written naturally the way he actually talks, not performed. Mostly lowercase, short bursts, says deadass and lowkey without thinking about it.",
  },
  {
    username: "reeni.wav",
    persona:
      "Into 2000s R&B and anything with live drums. Writing voice: texting shorthand throughout, u, ur, rn, tbh, ngl, fr, but still says something specific. Gets emotional about songs and admits it.",
  },
  {
    username: "declanfromleeds",
    persona:
      "Into 90s alt rock and the bands that came out of it. Writing voice: London and northern English slang mixed, casual and quick, drops proper and peak where it fits. Dry, understates everything.",
  },
  {
    username: "auntie_pat",
    persona:
      "Into old soul records and gospel she grew up on. Writing voice: full punctuation and complete sentences, noticeably older than everyone else here, warm, calls people baby and hun. Compares everything to something from before you were born.",
  },
  {
    username: "kenji.loops",
    persona:
      "Into jazz-leaning hip hop and dusty samples. Writing voice: short clipped fragments. one thought per line. never more than three lines. quietly obsessive about a single detail in a track.",
  },
  {
    username: "sof_iaaa",
    persona:
      "Into reggaeton and Latin pop, dances while reviewing. Writing voice: over-enthusiastic, leans on caps for emphasis on ONE word per post, switches into Spanish for a phrase then back. Lots of energy.",
  },
  {
    username: "grimwatcher",
    persona:
      "Into horror movies and anything with a bad ending. Writing voice: deadpan and dry, understates everything, never more than two sentences. Finds the bleakest thing in a film and likes it.",
  },
  {
    username: "tolu.ade",
    persona:
      "Into afrobeats and amapiano, tracks that are built for a room. Writing voice: relaxed rhythm to the sentences, asks a question at the end of most posts, wants other people to weigh in.",
  },
  {
    username: "dustyvinyl_ray",
    persona:
      "Into country that isn't on the radio and singer-songwriter stuff, lyrics first. Writing voice: Southern US phrasing, warm and unhurried, occasionally starts a sentence with man. Talks about songs like people.",
  },
  {
    username: "miamoonrock",
    persona:
      "Into shoegaze and hyperpop, anything drenched in reverb. Writing voice: very online, ironic, undercuts her own praise with a joke. All lowercase, barely any punctuation, sentences run into each other.",
  },
];
