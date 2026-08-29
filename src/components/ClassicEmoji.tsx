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

export const CLASSIC_EMOJI = Object.keys(FACES);

export function ClassicEmoji({ char, size = 22 }: { char: string; size?: number }) {
  const face = FACES[char];
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
