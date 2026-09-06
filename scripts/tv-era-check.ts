/**
 * The Feed TV's era chassis.
 *
 * Two things here are easy to get subtly wrong and impossible to notice
 * by looking: a dial that turns through a full circle puts its first and
 * last positions in the same place, and a wheel that measures its own
 * travel the long way round scrubs violently backwards every time a
 * finger crosses twelve o'clock.
 *
 * Run: npx tsx scripts/tv-era-check.ts
 */
import {
  KNOB_SWEEP_DEGREES,
  TV_ERAS,
  WHEEL_STEP_DEGREES,
  angleFromCentre,
  knobAngle,
  nextChannel,
  tvEraForTheme,
  wheelDelta,
} from "../src/lib/tvEra";
import { THEMES } from "../src/lib/themes";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

// ---- every decade has a set -------------------------------------------

const decades = THEMES.filter((t) => t.id.startsWith("decade-"));
check("there are decade themes to dress", decades.length === 5, `${decades.length} found`);
for (const theme of decades) {
  const era = tvEraForTheme(theme.id);
  check(`${theme.label} has its own television`, era.themeId === theme.id, era.id);
}
check(
  "each era is a different chassis",
  new Set(TV_ERAS.map((e) => e.id)).size === TV_ERAS.length
);
check("an unknown theme still gets a television", tvEraForTheme("nonsense").id === "modern");
check("no theme at all gets the default one", tvEraForTheme(null).id === "modern");
check(
  "the 90s and 2000s sets take a disc, the others do not",
  TV_ERAS.filter((e) => e.hasDiscSlot).map((e) => e.id).join(",") === "90s,00s"
);
check("only the 2010s has a wheel", TV_ERAS.filter((e) => e.controls === "wheel").length === 1);

// ---- the channel dial wraps, like a tuner ------------------------------

check("turning up from the last channel returns to the first", nextChannel(4, 5, 1) === 0);
check("turning down from the first reaches the last", nextChannel(0, 5, -1) === 4);
check("an empty set of clips does not divide by zero", nextChannel(0, 0, 1) === 0);

// ---- a dial has stops --------------------------------------------------

check(
  "a dial does not turn through a full circle",
  KNOB_SWEEP_DEGREES < 360,
  `${KNOB_SWEEP_DEGREES} degrees between the stops`
);
check(
  "the first and last positions point different ways",
  knobAngle(0, 6) !== knobAngle(5, 6),
  `${knobAngle(0, 6)} vs ${knobAngle(5, 6)}`
);
check(
  "the dial sweeps the whole way and no further",
  knobAngle(5, 6) - knobAngle(0, 6) === KNOB_SWEEP_DEGREES
);
check("a single channel parks the dial at the first stop", knobAngle(0, 1) === -KNOB_SWEEP_DEGREES / 2);
check("a position past the end is clamped, not wrapped", knobAngle(99, 6) === knobAngle(5, 6));

// ---- the wheel measures the short way round ----------------------------

check("a small turn forwards is a small number", wheelDelta(10, 40) === 30);
check("a small turn backwards is negative", wheelDelta(40, 10) === -30);
check(
  "crossing twelve o'clock forwards is two degrees, not minus 358",
  wheelDelta(359, 1) === 2,
  `${wheelDelta(359, 1)}`
);
check(
  "crossing twelve o'clock backwards is minus two, not 358",
  wheelDelta(1, 359) === -2,
  `${wheelDelta(1, 359)}`
);
check("half a turn is not ambiguous in sign", Math.abs(wheelDelta(0, 180)) === 180);
check(
  "a click is a deliberate movement, not a twitch",
  WHEEL_STEP_DEGREES >= 15,
  `${WHEEL_STEP_DEGREES} degrees per click`
);

// ---- the wheel knows which way is up -----------------------------------

check("straight up is zero", Math.round(angleFromCentre(0, -10)) === 0);
check("right is a quarter turn", Math.round(angleFromCentre(10, 0)) === 90);
check("down is half", Math.round(angleFromCentre(0, 10)) === 180);
check("left is three quarters", Math.round(angleFromCentre(-10, 0)) === 270);
check(
  "every angle is positive, so deltas never straddle zero by accident",
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([x, y]) => angleFromCentre(x, y) >= 0)
);

console.log(
  failures === 0 ? "\nEvery decade gets the television it had." : `\n${failures} failing.`
);
process.exit(failures === 0 ? 0 : 1);
