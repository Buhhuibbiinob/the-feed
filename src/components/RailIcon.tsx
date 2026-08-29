/**
 * The little glossy square on each navigation row.
 *
 * The rail was a column of text in white boxes, which is the one part of
 * the iOS grouped-table reference it had not actually copied: every row
 * in Settings, Messages or Music on that system carried a rounded-square
 * icon, and it is most of why those lists read as a place rather than as
 * a list of words.
 *
 * Built the way the originals were, which is three layers and nothing
 * more: a saturated vertical gradient, one highlight across the top half
 * that fades out by the middle, and a flat white glyph. No outline, no
 * drop shadow - at 22px both turn into mud.
 *
 * Drawn here rather than pulled from the sticker pack. Those are objects
 * with heavy outlines meant to be scaled up on a profile; these have to
 * read at 22px in a row of six, which is a different drawing.
 */

type Icon = {
  /** [top, bottom] of the tile gradient. */
  tile: [string, string];
  /** The white shape, on a 24x24 grid. */
  glyph: React.ReactNode;
};

const W = "#ffffff";

const ICONS: Record<string, Icon> = {
  // --- Browse
  feed: {
    tile: ["#5aa9f8", "#1f6fd0"],
    glyph: (
      <>
        <rect x="4" y="5" width="16" height="3.4" rx="1.4" fill={W} />
        <rect x="4" y="10.3" width="16" height="3.4" rx="1.4" fill={W} />
        <rect x="4" y="15.6" width="16" height="3.4" rx="1.4" fill={W} />
      </>
    ),
  },
  discover: {
    tile: ["#7ed0ff", "#1a92c8"],
    glyph: (
      <>
        <circle cx="12" cy="12" r="8.4" fill="none" stroke={W} strokeWidth="2.1" />
        {/* The compass needle, as two triangles meeting at the centre. */}
        <path d="M15.6 8.4 10.6 10.6 8.4 15.6 13.4 13.4Z" fill={W} />
      </>
    ),
  },
  clubs: {
    tile: ["#b98cf0", "#6a34c0"],
    glyph: (
      <>
        <rect x="3.6" y="2.6" width="2.6" height="19" rx="1.3" fill={W} />
        <path d="M7.4 3.6h12.4l-3.2 4.6 3.2 4.6H7.4Z" fill={W} />
      </>
    ),
  },
  collections: {
    tile: ["#ffb257", "#e07a10"],
    glyph: (
      <>
        <rect x="3.4" y="6" width="6.4" height="12.6" rx="1.2" fill={W} />
        <rect x="10.8" y="6" width="4" height="12.6" rx="1.2" fill={W} />
        <path d="M16.6 6.6 20.8 5.6l2.2 12.4-4.2 1Z" fill={W} transform="translate(-2 0)" />
      </>
    ),
  },
  creators: {
    tile: ["#ff8fb1", "#d62f6b"],
    glyph: (
      <>
        <circle cx="9" cy="17" r="3.4" fill={W} />
        <circle cx="18" cy="15" r="3.4" fill={W} />
        <path d="M11.4 17V6.4l9-1.8V15h-2.8V7.4l-3.4.7V17Z" fill={W} />
      </>
    ),
  },
  profiles: {
    // A grid of cards, not a person - this is the directory, and the
    // single figure belongs to My Profile further down the rail.
    tile: ["#6fd39a", "#1e9257"],
    glyph: (
      <>
        <rect x="3" y="4" width="8" height="7.4" rx="1.5" fill={W} />
        <rect x="13" y="4" width="8" height="7.4" rx="1.5" fill={W} />
        <rect x="3" y="12.6" width="8" height="7.4" rx="1.5" fill={W} />
        <rect x="13" y="12.6" width="8" height="7.4" rx="1.5" fill={W} />
      </>
    ),
  },

  // --- Community
  weekly: {
    tile: ["#ffd35a", "#e0980c"],
    glyph: (
      <>
        <rect x="3.4" y="5" width="17.2" height="15.4" rx="2.4" fill={W} />
        <rect x="3.4" y="5" width="17.2" height="4.4" rx="2.2" fill="#00000033" />
        <rect x="7" y="2.6" width="2.4" height="4.6" rx="1.2" fill={W} />
        <rect x="14.6" y="2.6" width="2.4" height="4.6" rx="1.2" fill={W} />
        <circle cx="12" cy="15" r="3" fill="#e0980c" />
      </>
    ),
  },
  leaderboard: {
    tile: ["#ffc46a", "#d98a00"],
    glyph: (
      <>
        <rect x="3" y="12.4" width="5" height="8" rx="1" fill={W} />
        <rect x="9.5" y="7.4" width="5" height="13" rx="1" fill={W} />
        <rect x="16" y="10" width="5" height="10.4" rx="1" fill={W} />
      </>
    ),
  },
  chat: {
    tile: ["#7ee08a", "#22a03c"],
    glyph: (
      <path
        d="M3.4 9.6C3.4 6.5 7.2 4 12 4s8.6 2.5 8.6 5.6-3.8 5.7-8.6 5.7c-1 0-2-.1-2.9-.3L5.4 17.6l.8-3.3c-1.7-1-2.8-2.6-2.8-4.7Z"
        fill={W}
      />
    ),
  },
  newsletter: {
    tile: ["#9fb6d4", "#4d6e8f"],
    glyph: (
      <>
        <rect x="3" y="6" width="18" height="12.4" rx="2" fill={W} />
        <path d="M3.9 7.4 12 13.2l8.1-5.8" fill="none" stroke="#4d6e8f" strokeWidth="1.9" />
      </>
    ),
  },

  // --- You
  profile: {
    tile: ["#8fd0ff", "#2b7fc4"],
    glyph: (
      <>
        <circle cx="12" cy="8.6" r="4.1" fill={W} />
        <path d="M3.8 20.4c0-4.2 3.7-6.6 8.2-6.6s8.2 2.4 8.2 6.6Z" fill={W} />
      </>
    ),
  },
  messages: {
    // Two bubbles and a different hue. Chat is the room everyone is in;
    // messages are between two people, which is what the pair says.
    tile: ["#6fb8ff", "#1a63c8"],
    glyph: (
      <>
        <path
          d="M2.6 8.4C2.6 5.9 5.6 4 9.4 4s6.8 1.9 6.8 4.4-3 4.5-6.8 4.5c-.8 0-1.6-.1-2.3-.3L3.9 14.4l.6-2.6c-1.2-.8-1.9-1.9-1.9-3.4Z"
          fill={W}
        />
        <path
          d="M21.4 14.2c0-2.2-2.4-3.9-5.6-3.9s-5.6 1.7-5.6 3.9 2.4 3.9 5.6 3.9c.7 0 1.4-.1 2-.2l2.6 1.5-.5-2.2c1-.7 1.5-1.7 1.5-3Z"
          fill={W}
          stroke="#1a63c8"
          strokeWidth="1.4"
        />
      </>
    ),
  },
  alerts: {
    tile: ["#ff8f7a", "#d63a1e"],
    glyph: (
      <>
        <path d="M12 3.2a5.8 5.8 0 0 1 5.8 5.8v4l1.8 2.8a.9.9 0 0 1-.8 1.4H5.2a.9.9 0 0 1-.8-1.4L6.2 13V9A5.8 5.8 0 0 1 12 3.2Z" fill={W} />
        <path d="M9.6 18.4h4.8a2.4 2.4 0 0 1-4.8 0Z" fill={W} />
      </>
    ),
  },
  wrapped: {
    tile: ["#e79bf5", "#a02fc0"],
    glyph: (
      <>
        <rect x="3.4" y="9.4" width="17.2" height="10.8" rx="1.8" fill={W} />
        <rect x="10.4" y="9.4" width="3.2" height="10.8" fill="#a02fc0" />
        <rect x="2.4" y="6" width="19.2" height="4" rx="1.4" fill={W} />
        <path d="M12 6c-1.6-3.4-6-2.6-5.4.4M12 6c1.6-3.4 6-2.6 5.4.4" fill="none" stroke={W} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  settings: {
    tile: ["#c3cad4", "#6f7887"],
    glyph: (
      <>
        <path
          d="M12 2.8l2.1 1.5 2.5-.5 1.1 2.3 2.3 1.1-.5 2.5 1.5 2.1-1.5 2.1.5 2.5-2.3 1.1-1.1 2.3-2.5-.5L12 21.2l-2.1-1.5-2.5.5-1.1-2.3-2.3-1.1.5-2.5L3 12l1.5-2.1-.5-2.5 2.3-1.1 1.1-2.3 2.5.5Z"
          fill={W}
        />
        <circle cx="12" cy="12" r="3.4" fill="#6f7887" />
      </>
    ),
  },
  admin: {
    tile: ["#9aa3b0", "#4a5260"],
    glyph: (
      <>
        <path d="M12 2.8 20 6v6.2c0 4.6-3.3 7.9-8 9.2-4.7-1.3-8-4.6-8-9.2V6Z" fill={W} />
        <path d="M8.6 12.2l2.4 2.4 4.4-4.6" fill="none" stroke="#4a5260" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
};

export function RailIcon({ name, size = 22 }: { name: string; size?: number }) {
  const icon = ICONS[name];
  if (!icon) return null;
  const id = `ri-${name}`;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="rail-icon">
      <defs>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={icon.tile[0]} />
          <stop offset="100%" stopColor={icon.tile[1]} />
        </linearGradient>
        {/* The highlight is the whole trick: hard at the top, gone by the
            middle, so the tile reads as a curved surface catching light
            rather than as a coloured square. */}
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="52%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="52%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <rect x="0" y="0" width="24" height="24" rx="5.6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <rect width="24" height="24" fill={`url(#${id}-t)`} />
        <g transform="translate(3.2 3.2) scale(0.735)">{icon.glyph}</g>
        <rect width="24" height="24" fill={`url(#${id}-s)`} />
      </g>
    </svg>
  );
}
