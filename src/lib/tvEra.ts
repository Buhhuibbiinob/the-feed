// Which television the Feed TV is, this week.
//
// The player is the one piece of furniture on the homepage that is
// supposed to be an OBJECT rather than a panel, so when the site is
// wearing a decade it should be the television that decade had. That is
// not a recolour: a 1978 set has knobs, a 1996 one has a disc slot, and
// by 2009 the thing you carried had a wheel and no screen worth the name.
//
// Which is exactly why this does not live in the [data-theme] blocks in
// globals.css. Those are checked to only ever set colour, background and
// font - a theme that starts moving furniture makes every layout need
// re-testing against every theme. The era is a component variant instead:
// FeedTV reads the theme and picks its own chassis.

export type TvEraId = "modern" | "70s" | "80s" | "90s" | "00s" | "10s";

export type TvEra = {
  id: TvEraId;
  /** The site theme this chassis belongs to. */
  themeId: string;
  /** Printed on the set, where a real one carried a maker's name. */
  brand: string;
  /** What the controls are, so the markup can say it out loud. */
  controls: "knobs" | "buttons" | "wheel";
  /** Whether this set takes a disc. */
  hasDiscSlot: boolean;
};

export const TV_ERAS: TvEra[] = [
  // The default player, unchanged: the old-YouTube-app chrome.
  { id: "modern", themeId: "ios-light", brand: "The Feed", controls: "buttons", hasDiscSlot: false },
  // Wood veneer, a fabric speaker grille and two big rotary dials. The
  // 70s set is furniture - it sat on legs, not on a stand.
  { id: "70s", themeId: "decade-70s", brand: "Feedmaster", controls: "knobs", hasDiscSlot: false },
  // Still knobs, but the cabinet went matte black plastic and the dials
  // shrank and multiplied. Not neon: the 80s looked like a Trinitron.
  { id: "80s", themeId: "decade-80s", brand: "Feedtron", controls: "knobs", hasDiscSlot: false },
  // The grey CRT with a slot in the front and a tray that takes a disc.
  { id: "90s", themeId: "decade-90s", brand: "FeedVision", controls: "buttons", hasDiscSlot: true },
  // Silver-and-charcoal plastic, a row of soft buttons under the screen,
  // a media slot and a headphone socket on the front.
  { id: "00s", themeId: "decade-00s", brand: "Feed HD", controls: "buttons", hasDiscSlot: true },
  // By now the television is in your pocket and it has a wheel.
  { id: "10s", themeId: "decade-10s", brand: "FeedPod", controls: "wheel", hasDiscSlot: false },
];

const BY_THEME = new Map(TV_ERAS.map((era) => [era.themeId, era]));
const BY_ID = new Map(TV_ERAS.map((era) => [era.id, era]));

/** The chassis for a theme. Anything unrecognised gets the default set. */
export function tvEraForTheme(themeId: string | null | undefined): TvEra {
  return (themeId ? BY_THEME.get(themeId) : undefined) ?? BY_ID.get("modern")!;
}

export function tvEraById(id: TvEraId): TvEra {
  return BY_ID.get(id)!;
}

/**
 * What the two dials do on a set that has them.
 *
 * A real one had exactly these: what you are watching, and how loud. The
 * channel dial wraps, because a tuner wrapped - going past the last
 * channel put you back on the first, and that is the behaviour anybody
 * who used one expects from turning it all the way round.
 */
export function nextChannel(current: number, total: number, direction: 1 | -1): number {
  if (total <= 0) return 0;
  return (((current + direction) % total) + total) % total;
}

/**
 * Where a knob points, in degrees, for a given position.
 *
 * Real dials had a dead zone at the bottom rather than turning through a
 * full circle - the pointer swept about 300 degrees between the stops.
 * Rendering the full 360 makes the first and last positions identical,
 * which is the one thing a dial must never do.
 */
export const KNOB_SWEEP_DEGREES = 300;

export function knobAngle(position: number, total: number): number {
  if (total <= 1) return -KNOB_SWEEP_DEGREES / 2;
  const fraction = Math.min(1, Math.max(0, position / (total - 1)));
  return -KNOB_SWEEP_DEGREES / 2 + fraction * KNOB_SWEEP_DEGREES;
}

/**
 * Turning the click wheel into a number of steps.
 *
 * The wheel reports where a finger is as an angle. What matters is how
 * far it has travelled since the last reading, which has to be measured
 * the short way round: dragging past twelve o'clock takes the angle from
 * 359 to 1, and the naive difference reads that as a violent scrub
 * backwards instead of two degrees forwards.
 */
export function wheelDelta(fromAngle: number, toAngle: number): number {
  let delta = toAngle - fromAngle;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

/** Degrees of travel that count as one click of the wheel. */
export const WHEEL_STEP_DEGREES = 30;

/** The angle of a point on the wheel, measured clockwise from the top. */
export function angleFromCentre(dx: number, dy: number): number {
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}
