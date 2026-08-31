/**
 * Smileys drawn the way they looked before emoji flattened out.
 *
 * Modern system emoji are matte vector art. The 2000s ones - AIM, MSN,
 * iChat, and the first iPhone sets - were little plastic spheres: a
 * radial yellow ball, a hard specular highlight up in the top left, a
 * darker rim where the light falls away, and a shadow underneath. That
 * lighting is the entire difference, and it is why the old ones read as
 * objects sitting on the page rather than as pictures printed on it.
 *
 * Drawn here rather than loaded as a font or an image set: a font would
 * be someone else's artwork, and at these sizes an SVG sphere with two
 * gradients is smaller than the PNG would be.
 *
 * Keyed by the unicode character the database already stores, so nothing
 * needs migrating and anything outside this set still renders as the
 * plain character.
 */

type Face = {
  /** Eyes and mouth, drawn over the ball. */
  features: React.ReactNode;
  /** A few faces want their own ball colour. */
  ball?: [string, string];
};

const BLACK = "#3a2c00";

const FACES: Record<string, Face> = {
  "\u{1F600}": {
    features: (
      <>
        <ellipse cx="21" cy="26" rx="4" ry="5" fill={BLACK} />
        <ellipse cx="43" cy="26" rx="4" ry="5" fill={BLACK} />
        <path d="M17 38c4 9 26 9 30 0z" fill={BLACK} />
      </>
    ),
  },
  "\u{1F642}": {
    features: (
      <>
        <circle cx="21" cy="27" r="4" fill={BLACK} />
        <circle cx="43" cy="27" r="4" fill={BLACK} />
        <path d="M19 39c5 7 21 7 26 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F60E}": {
    features: (
      <>
        <path d="M12 24h40v5a9 9 0 0 1-9 9h-4a9 9 0 0 1-8-6 9 9 0 0 1-8 6h-4a9 9 0 0 1-9-9z" fill="#1d2733" />
        {/* A slick of reflected light across the left lens. */}
        <path d="M14 26h16v3a7 7 0 0 1-14 1z" fill="#4a6480" />
        <path d="M19 41c5 6 21 6 26 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F622}": {
    features: (
      <>
        <circle cx="21" cy="27" r="4" fill={BLACK} />
        <circle cx="43" cy="27" r="4" fill={BLACK} />
        <path d="M19 45c5-7 21-7 26 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M17 32c-3 6-4 9-1 11s6-1 5-5z" fill="#5fb9f0" />
      </>
    ),
  },
  "\u{1F60D}": {
    features: (
      <>
        <path d="M14 22c4-4 9 0 7 4s-7 6-7 6-5-2-7-6 3-8 7-4z" fill="#e0344a" />
        <path d="M43 22c4-4 9 0 7 4s-7 6-7 6-5-2-7-6 3-8 7-4z" fill="#e0344a" />
        <path d="M19 40c5 7 21 7 26 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F634}": {
    features: (
      <>
        <path d="M15 27c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M36 27c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="32" cy="42" rx="5" ry="4" fill={BLACK} />
      </>
    ),
  },
  "\u{1F610}": {
    features: (
      <>
        <circle cx="21" cy="27" r="4" fill={BLACK} />
        <circle cx="43" cy="27" r="4" fill={BLACK} />
        <path d="M20 41h24" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F61C}": {
    features: (
      <>
        <path d="M15 25c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="43" cy="27" r="4" fill={BLACK} />
        <path d="M19 38c5 7 21 7 26 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M29 43c0 6 8 8 9 2 0-3-1-4-4-4z" fill="#e0566a" />
      </>
    ),
  },
  "\u{1F62E}": {
    features: (
      <>
        <circle cx="21" cy="26" r="4" fill={BLACK} />
        <circle cx="43" cy="26" r="4" fill={BLACK} />
        <ellipse cx="32" cy="42" rx="6" ry="7" fill={BLACK} />
      </>
    ),
  },
  "\u{1F601}": {
    features: (
      <>
        <path d="M14 24c4-4 10-4 14 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M36 24c4-4 10-4 14 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M16 36h32c0 9-7 13-16 13s-16-4-16-13z" fill={BLACK} />
        <path d="M19 37h26v4H19z" fill="#fff" />
      </>
    ),
  },
  "\u{1F609}": {
    features: (
      <>
        <path d="M15 27c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="43" cy="27" r="4" fill={BLACK} />
        <path d="M19 39c5 7 21 7 26 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F602}": {
    features: (
      <>
        <path d="M14 26c4-5 10-5 14 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M36 26c4-5 10-5 14 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M16 36h32c0 9-7 13-16 13s-16-4-16-13z" fill={BLACK} />
        <path d="M19 37h26v3H19z" fill="#fff" />
        {/* Tears, thrown outward rather than running down - the old sets
            drew them mid-air. */}
        <path d="M10 30c-4 5-5 8-2 10s6-1 5-5z" fill="#5fb9f0" />
        <path d="M54 30c4 5 5 8 2 10s-6-1-5-5z" fill="#5fb9f0" />
      </>
    ),
  },
  "\u{1F60A}": {
    ball: ["#ffe98a", "#e8a400"],
    features: (
      <>
        <path d="M15 28c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M36 28c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M20 39c5 7 19 7 24 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="12" cy="36" rx="6" ry="4" fill="#ff8fa8" opacity=".75" />
        <ellipse cx="52" cy="36" rx="6" ry="4" fill="#ff8fa8" opacity=".75" />
      </>
    ),
  },
  "\u{1F618}": {
    features: (
      <>
        <path d="M15 26c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="43" cy="27" r="4" fill={BLACK} />
        <ellipse cx="26" cy="42" rx="7" ry="5" fill={BLACK} />
        <path d="M44 34c4-4 9 0 7 4s-7 5-7 5-5-1-7-5 3-8 7-4z" fill="#e0344a" />
      </>
    ),
  },
  "\u{1F914}": {
    features: (
      <>
        <circle cx="22" cy="26" r="4" fill={BLACK} />
        <path d="M38 24c4-3 9-3 12 1" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M20 42c6-3 12-3 17 1" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* The hand at the chin, which is the whole joke of this one.
            Drawn low and to the right with the knuckles showing - as one
            rounded blob under the mouth it read as a tongue, which is a
            different emoji entirely. */}
        <path d="M34 48c2-4 9-6 14-3 5 3 5 9 1 12-5 3-17 1-15-4z" fill="#f2bd77" stroke="#a86a24" strokeWidth="2.5" />
        <path d="M39 47c1 4 1 7 0 10M45 47c1 4 1 7 0 9" stroke="#a86a24" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F60F}": {
    features: (
      <>
        <path d="M15 26c4-3 9-3 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="43" cy="27" r="4" fill={BLACK} />
        <path d="M20 42c6 4 16 2 22-4" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F631}": {
    ball: ["#fff3c4", "#dcb400"],
    features: (
      <>
        <ellipse cx="21" cy="25" rx="6" ry="7" fill="#fff" stroke={BLACK} strokeWidth="3" />
        <ellipse cx="43" cy="25" rx="6" ry="7" fill="#fff" stroke={BLACK} strokeWidth="3" />
        <circle cx="21" cy="26" r="3" fill={BLACK} />
        <circle cx="43" cy="26" r="3" fill={BLACK} />
        <ellipse cx="32" cy="44" rx="7" ry="9" fill={BLACK} />
      </>
    ),
  },
  "\u{1F633}": {
    ball: ["#ffd6a8", "#e07a2e"],
    features: (
      <>
        <path d="M15 27c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M36 27c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="32" cy="43" rx="6" ry="5" fill={BLACK} />
        <ellipse cx="12" cy="34" rx="7" ry="5" fill="#ff6f8f" opacity=".8" />
        <ellipse cx="52" cy="34" rx="7" ry="5" fill="#ff6f8f" opacity=".8" />
      </>
    ),
  },
  "\u{1F644}": {
    features: (
      <>
        <ellipse cx="21" cy="26" rx="6" ry="7" fill="#fff" stroke={BLACK} strokeWidth="3" />
        <ellipse cx="43" cy="26" rx="6" ry="7" fill="#fff" stroke={BLACK} strokeWidth="3" />
        <circle cx="21" cy="21" r="3" fill={BLACK} />
        <circle cx="43" cy="21" r="3" fill={BLACK} />
        <path d="M22 43h20" stroke={BLACK} strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F92F}": {
    ball: ["#ffe98a", "#e8a400"],
    features: (
      <>
        {/* The burst has to be a different hue from the ball or it is
            invisible - drawn yellow-on-yellow it just looked surprised. */}
        <path d="M32 0l6 13 13-5-5 13 14 5-14 6 5 13-13-5-6 13-6-13-13 5 5-13-14-6 14-5-5-13 13 5z" fill="#ff7a2e" stroke="#c04a00" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="22" cy="32" r="4" fill={BLACK} />
        <circle cx="42" cy="32" r="4" fill={BLACK} />
        <ellipse cx="32" cy="46" rx="6" ry="6" fill={BLACK} />
      </>
    ),
  },
  "\u{1F60B}": {
    features: (
      <>
        <path d="M15 26c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M36 26c4-4 9-4 13 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M18 38c5 7 23 7 28 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M36 42c0 8 10 10 11 2 0-4-2-5-5-5z" fill="#e0566a" />
      </>
    ),
  },
  "\u{1F624}": {
    ball: ["#ffd98a", "#e08a00"],
    features: (
      <>
        <path d="M13 21l14 6" stroke={BLACK} strokeWidth="4" strokeLinecap="round" />
        <path d="M51 21l-14 6" stroke={BLACK} strokeWidth="4" strokeLinecap="round" />
        <circle cx="22" cy="32" r="4" fill={BLACK} />
        <circle cx="42" cy="32" r="4" fill={BLACK} />
        <path d="M22 45h20" stroke={BLACK} strokeWidth="4" strokeLinecap="round" />
        {/* Steam out of both nostrils. */}
        <path d="M8 40c-5 2-7 6-4 8" stroke="#bcd3e8" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M56 40c5 2 7 6 4 8" stroke="#bcd3e8" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F615}": {
    features: (
      <>
        <circle cx="21" cy="27" r="4" fill={BLACK} />
        <circle cx="43" cy="27" r="4" fill={BLACK} />
        <path d="M20 44c5-6 13-3 24-5" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  "\u{1F621}": {
    ball: ["#ff8a6b", "#d63a1e"],
    features: (
      <>
        <path d="M13 20l14 6" stroke={BLACK} strokeWidth="4" strokeLinecap="round" />
        <path d="M51 20l-14 6" stroke={BLACK} strokeWidth="4" strokeLinecap="round" />
        <circle cx="22" cy="31" r="4" fill={BLACK} />
        <circle cx="42" cy="31" r="4" fill={BLACK} />
        <path d="M20 46c5-7 19-7 24 0" stroke={BLACK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
};


/**
 * Emoji drawn as artwork files rather than inline SVG.
 *
 * The faces above are spheres with two gradients, which is small enough
 * to inline. These are objects - a camera, a CD, a hand - and they are
 * already drawn, because they are the same files the sticker pack uses.
 * One set of artwork does both jobs: every one of these is a sticker you
 * can drop on your page and an emoji you can type into a review.
 *
 * Twenty-four yellow faces was the whole keyboard before this. There was
 * nothing for the three things this site is actually about, no way to
 * pick a heart that matched your page, and no person of any kind.
 */
const SPRITES: Record<string, string> = {
  // --- People. Hands do most of the work here: they say as much as a
  // face and none of them is a particular kind of person.
  "\u{1F9D1}": "person",
  "\u{1F465}": "people",
  "\u{1F44B}": "hand-wave",
  "\u{1F44D}": "hand-up",
  "\u{1F918}": "hand-rock",
  "\u{270C}": "hand-peace",
  "\u{1F44F}": "hand-clap",
  "\u{1FAF6}": "hand-heart",

  // --- Asked for by a member, and it belongs: a basketball is a sphere
  // with a highlight, which is exactly what this set draws.
  "\u{1F3C0}": "basketball",

  // --- A long scroll of vibes, drawn to the same rules as everything
  // else here. Asked for by name: California, 2016 Tumblr, underground,
  // scene, McBling, grunge. Every one is a sprite rather than a
  // passed-through character, because an undrawn emoji falls back to the
  // system's own artwork - which is the exact thing this whole file
  // exists to avoid.
  "\u{1F334}": "palm",
  "\u{2600}": "sun",
  "\u{1F30A}": "wave",
  "\u{1F34A}": "citrus",
  "\u{1F335}": "cactus",
  "\u{1F34D}": "pineapple",
  "\u{1F339}": "rose",
  "\u{1F4F8}": "flashcam",
  "\u{1F964}": "shake",
  "\u{1F4FB}": "boombox",
  "\u{1F6F9}": "skateboard",
  "\u{1F50A}": "speaker",
  "\u{1F480}": "skull",
  "\u{1F3B8}": "guitar",
  "\u{1F97E}": "boot",
  "\u{1F4F1}": "flipphone",
  "\u{1F484}": "lipgloss",
  "\u{1F485}": "nails",
  "\u{1FAA9}": "discoball",
  "\u{1F4B5}": "dollar",

  // --- Music, film and photography.
  "\u{1F3A7}": "headphones",
  "\u{1F4BF}": "cd",
  "\u{1F4FC}": "vhs",
  "\u{1F3AC}": "clapper",
  "\u{1F4F7}": "camera",
  "\u{1F39E}": "film",
  "\u{1F3A4}": "mic",
  "\u{1F4FA}": "tv",
  "\u{1F3B5}": "note",

  // --- Hearts in every colour, which is the cheapest way to let someone
  // match the emoji they use to the page they built.
  "\u{2764}": "heart",
  "\u{1F5A4}": "heart-black",
  "\u{1F90D}": "heart-white",
  "\u{1F49C}": "heart-purple",
  "\u{1F499}": "heart-blue",
  "\u{1F49A}": "heart-green",
  "\u{1F9E1}": "heart-orange",

  // --- The rest of the pack.
  "\u{2B50}": "star",
  "\u{2728}": "sparkle",
  "\u{1F319}": "moon",
  "\u{1F308}": "rainbow",
  "\u{1F98B}": "butterfly",
  "\u{1F48E}": "gem",
  "\u{2601}": "cloud",
  "\u{26A1}": "bolt",
  "\u{1F451}": "crown",
  "\u{1F352}": "cherry",
  "\u{1F338}": "flower",
  "\u{1F380}": "bow",
  "\u{1F43E}": "paw",
  "\u{1F4AC}": "bubble",
};

/**
 * Emoji arrive with and without a trailing variation selector depending
 * on where they were typed - U+2764 and U+2764 U+FE0F are the same heart
 * to a reader and different strings to a Record. Stored without it,
 * looked up without it.
 */
function baseChar(char: string): string {
  return char.replace(/\uFE0F/g, "");
}

export function spriteFor(char: string): string | null {
  return SPRITES[baseChar(char)] ?? null;
}

export const CLASSIC_EMOJI = Object.keys(FACES);

/**
 * What each face is called, for the `:` search in the keyboard.
 *
 * First word is the display name; the rest are things people actually
 * type. `:cry` should find the crying one even though nobody calls it
 * "loudly sobbing", and `:lol` should find the laughing one, which is
 * the name it has had since long before it had a codepoint.
 */
export const EMOJI_NAMES: Record<string, string[]> = {
  "\u{1F600}": ["grin", "happy", "smile"],
  "\u{1F642}": ["slight smile", "smile", "ok"],
  "\u{1F60E}": ["cool", "sunglasses", "shades"],
  "\u{1F622}": ["cry", "sad", "tear"],
  "\u{1F60D}": ["heart eyes", "love", "in love"],
  "\u{1F634}": ["sleeping", "sleep", "tired", "zzz"],
  "\u{1F610}": ["neutral", "blank", "meh", "straight face"],
  "\u{1F61C}": ["tongue", "wink tongue", "silly", "cheeky"],
  "\u{1F62E}": ["surprised", "wow", "shocked", "open mouth"],
  "\u{1F601}": ["beam", "grinning", "teeth", "cheese"],
  "\u{1F609}": ["wink", "winking"],
  "\u{1F602}": ["laughing", "lol", "crying laughing", "funny"],
  "\u{1F60A}": ["blush", "smiling", "shy", "sweet"],
  "\u{1F618}": ["kiss", "blowing a kiss", "mwah"],
  "\u{1F914}": ["thinking", "hmm", "think"],
  "\u{1F60F}": ["smirk", "smug", "sly"],
  "\u{1F631}": ["scream", "screaming", "shock", "horror"],
  "\u{1F633}": ["flushed", "embarrassed", "blushing"],
  "\u{1F644}": ["eye roll", "rolling eyes", "ugh", "whatever"],
  "\u{1F92F}": ["mind blown", "exploding head", "whoa"],
  "\u{1F60B}": ["yum", "delicious", "tasty"],
  "\u{1F624}": ["steam", "annoyed", "frustrated", "huff"],
  "\u{1F615}": ["confused", "unsure", "hmm"],
  "\u{1F621}": ["angry", "rage", "mad", "furious"],

  // --- People and hands.
  "\u{1F9D1}": ["person", "someone", "me"],
  "\u{1F465}": ["people", "friends", "everyone", "us"],
  "\u{1F44B}": ["wave", "hi", "hello", "bye"],
  "\u{1F44D}": ["thumbs up", "yes", "good", "agree"],
  "\u{1F918}": ["rock on", "horns", "metal", "yeah"],
  "\u{270C}": ["peace", "two", "victory"],
  "\u{1F44F}": ["clap", "applause", "bravo"],
  "\u{1FAF6}": ["heart hands", "love", "adore"],

  // --- Music, film, photography.
  "\u{1F3C0}": ["basketball", "ball", "hoops", "sports", "nba"],
  "\u{1F334}": ["palm", "tree", "beach", "cali", "summer"],
  "\u{2600}": ["sun", "sunny", "summer", "hot"],
  "\u{1F30A}": ["wave", "ocean", "surf", "sea", "beach"],
  "\u{1F34A}": ["orange", "citrus", "fruit", "summer"],
  "\u{1F335}": ["cactus", "desert", "plant"],
  "\u{1F34D}": ["pineapple", "fruit", "tropical"],
  "\u{1F339}": ["rose", "flower", "romantic"],
  "\u{1F4F8}": ["camera", "photo", "flash", "polaroid"],
  "\u{1F964}": ["milkshake", "drink", "diner", "shake"],
  "\u{1F4FB}": ["boombox", "radio", "stereo", "music"],
  "\u{1F6F9}": ["skateboard", "skate", "board"],
  "\u{1F50A}": ["speaker", "loud", "bass", "sound"],
  "\u{1F480}": ["skull", "spooky", "goth", "grunge"],
  "\u{1F3B8}": ["guitar", "band", "rock", "music"],
  "\u{1F97E}": ["boot", "docs", "grunge", "shoe"],
  "\u{1F4F1}": ["flip phone", "phone", "y2k", "razr"],
  "\u{1F484}": ["lipstick", "lip gloss", "makeup", "glam"],
  "\u{1F485}": ["nails", "manicure", "polish", "glam"],
  "\u{1FAA9}": ["disco ball", "disco", "party", "shiny"],
  "\u{1F4B5}": ["money", "cash", "dollar", "rich"],
  "\u{1F3A7}": ["headphones", "listening", "music"],
  "\u{1F4BF}": ["cd", "disc", "album", "record"],
  "\u{1F4FC}": ["vhs", "tape", "video"],
  "\u{1F3AC}": ["clapper", "film", "movie", "action"],
  "\u{1F4F7}": ["camera", "photo", "photography", "shot"],
  "\u{1F39E}": ["film strip", "frames", "cinema"],
  "\u{1F3A4}": ["mic", "microphone", "singing", "vocals"],
  "\u{1F4FA}": ["tv", "telly", "show", "series"],
  "\u{1F3B5}": ["music note", "song", "track", "tune"],

  // --- Hearts, one for every page.
  "\u{2764}": ["red heart", "love", "heart"],
  "\u{1F5A4}": ["black heart", "goth", "heart"],
  "\u{1F90D}": ["white heart", "heart"],
  "\u{1F49C}": ["purple heart", "heart"],
  "\u{1F499}": ["blue heart", "heart"],
  "\u{1F49A}": ["green heart", "heart"],
  "\u{1F9E1}": ["orange heart", "heart"],

  // --- Vibes.
  "\u{2B50}": ["star", "favourite", "five"],
  "\u{2728}": ["sparkles", "shiny", "magic", "glitter"],
  "\u{1F319}": ["moon", "night", "late"],
  "\u{1F308}": ["rainbow", "pride", "colours"],
  "\u{1F98B}": ["butterfly", "pretty"],
  "\u{1F48E}": ["gem", "diamond", "gorgeous"],
  "\u{2601}": ["cloud", "dreamy", "soft"],
  "\u{26A1}": ["lightning", "energy", "fast"],
  "\u{1F451}": ["crown", "queen", "king", "best"],
  "\u{1F352}": ["cherries", "cute", "fruit"],
  "\u{1F338}": ["flower", "blossom", "spring"],
  "\u{1F380}": ["bow", "ribbon", "coquette"],
  "\u{1F43E}": ["paws", "pet", "cat", "dog"],
  "\u{1F4AC}": ["speech", "talk", "comment", "say"],
};

/**
 * The keyboard's tabs.
 *
 * Sixty-one in one grid is a wall. Grouped, it is four short rows you can
 * take in - and the groups say what the site is: people, the three things
 * it reviews, and the decorative half people use to set a tone.
 */
export const EMOJI_GROUPS: { name: string; chars: string[] }[] = [
  { name: "Faces", chars: Object.keys(FACES) },
  {
    name: "People",
    chars: [
      "\u{1F9D1}", "\u{1F465}", "\u{1F44B}", "\u{1F44D}",
      "\u{1F918}", "\u{270C}", "\u{1F44F}", "\u{1FAF6}",
    ],
  },
  {
    name: "Music & film",
    chars: [
      "\u{1F3A7}", "\u{1F4BF}", "\u{1F3B5}", "\u{1F3A4}",
      "\u{1F3AC}", "\u{1F4FC}", "\u{1F39E}", "\u{1F4FA}",
      "\u{1F4F7}",
    ],
  },
  {
    name: "Vibes",
    chars: [
      "\u{2764}", "\u{1F5A4}", "\u{1F90D}", "\u{1F49C}",
      "\u{1F499}", "\u{1F49A}", "\u{1F9E1}", "\u{2728}",
      "\u{2B50}", "\u{1F319}", "\u{1F308}", "\u{1F98B}",
      "\u{1F48E}", "\u{2601}", "\u{26A1}", "\u{1F451}",
      "\u{1F352}", "\u{1F338}", "\u{1F380}", "\u{1F43E}",
      "\u{1F4AC}", "\u{1F3C0}",
      "\u{1F334}", "\u{2600}", "\u{1F30A}", "\u{1F34A}",
      "\u{1F335}", "\u{1F34D}", "\u{1F339}", "\u{1F4F8}",
      "\u{1F964}", "\u{1F4FB}", "\u{1F6F9}", "\u{1F50A}",
      "\u{1F480}", "\u{1F3B8}", "\u{1F97E}", "\u{1F4F1}",
      "\u{1F484}", "\u{1F485}", "\u{1FAA9}", "\u{1F4B5}",
    ],
  },
];

/** Every emoji the keyboard offers, faces and sprites together. */
export const ALL_EMOJI = EMOJI_GROUPS.flatMap((g) => g.chars);

export function emojiLabel(char: string): string {
  return EMOJI_NAMES[baseChar(char)]?.[0] ?? "emoji";
}

/** Faces whose name or any of its aliases start with the typed text. */
export function searchEmoji(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_EMOJI;
  // Prefix rather than substring: typing `:s` should offer smile and
  // scream, not every name with an s buried in it.
  return ALL_EMOJI.filter((char) =>
    (EMOJI_NAMES[baseChar(char)] ?? []).some((name) =>
      name.split(" ").some((word) => word.startsWith(q))
    )
  );
}

export function ClassicEmoji({ char, size = 22 }: { char: string; size?: number }) {
  const sprite = spriteFor(char);
  if (sprite) {
    return (
      <img
        src={`/stickers/${sprite}.svg`}
        alt=""
        width={size}
        height={size}
        style={{ display: "block" }}
        role="img"
        aria-label={emojiLabel(char)}
      />
    );
  }

  const face = FACES[baseChar(char)];
  // Anything we have not drawn falls through to the character itself, so
  // a member who typed their own still gets what they typed.
  if (!face) {
    return (
      <span style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label="mood">
        {char}
      </span>
    );
  }

  const [light, dark] = face.ball ?? ["#ffe98a", "#e8a400"];
  const id = `ce-${char.codePointAt(0)}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="mood">
      <defs>
        {/* The ball: lit from the top left, falling to a saturated rim. */}
        <radialGradient id={`${id}-b`} cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor={light} />
          <stop offset="62%" stopColor={dark} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        {/* The specular highlight - the single most 2000s thing about it. */}
        <radialGradient id={`${id}-h`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="33" r="30" fill={`url(#${id}-b)`} />
      <circle cx="32" cy="33" r="30" fill="none" stroke="rgba(120,80,0,0.45)" strokeWidth="1.5" />
      {face.features}
      <ellipse cx="24" cy="15" rx="15" ry="10" fill={`url(#${id}-h)`} />
    </svg>
  );
}
