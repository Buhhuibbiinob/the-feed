"use client";

import { useRef, useState } from "react";
import {
  KNOB_SWEEP_DEGREES,
  WHEEL_STEP_DEGREES,
  angleFromCentre,
  knobAngle,
  nextChannel,
  wheelDelta,
  type TvEra,
} from "@/lib/tvEra";
import type { FeedTvClip } from "@/components/FeedTV";

// The controls that come with each television.
//
// These are not decoration painted on the cabinet. A dial that does not
// turn is worse than no dial: it looks like the way you change the
// channel and then does not. So each one drives the same player the
// modern chrome drives - the buttons above just look like buttons.

export type TvActions = {
  select: (index: number) => void;
  next: () => void;
  previous: () => void;
  togglePause: () => void;
  toggleMute: () => void;
};

/**
 * A rotary dial.
 *
 * Turns by dragging round it, steps by clicking, and answers the arrow
 * keys - a dial that only responds to a circular drag is unusable with a
 * keyboard and fiddly with a mouse, and every one of those is somebody's
 * only way of working it.
 */
function Knob({
  label,
  position,
  total,
  onStep,
}: {
  label: string;
  position: number;
  total: number;
  onStep: (direction: 1 | -1) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Where the finger was when it last crossed a click boundary, so a slow
  // drag accumulates instead of every pointermove counting as a step.
  const lastAngle = useRef<number | null>(null);
  const carried = useRef(0);

  function angleAt(clientX: number, clientY: number): number | null {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return angleFromCentre(
      clientX - (rect.left + rect.width / 2),
      clientY - (rect.top + rect.height / 2)
    );
  }

  return (
    <div className="tv-knob-wrap">
      <div
        ref={ref}
        className="tv-knob"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, total)}
        aria-valuenow={position + 1}
        style={{ ["--knob-angle" as string]: `${knobAngle(position, total)}deg` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          lastAngle.current = angleAt(e.clientX, e.clientY);
          carried.current = 0;
        }}
        onPointerMove={(e) => {
          if (lastAngle.current === null) return;
          const now = angleAt(e.clientX, e.clientY);
          if (now === null) return;
          carried.current += wheelDelta(lastAngle.current, now);
          lastAngle.current = now;
          while (Math.abs(carried.current) >= KNOB_SWEEP_DEGREES / Math.max(1, total)) {
            const direction = carried.current > 0 ? 1 : -1;
            carried.current -= direction * (KNOB_SWEEP_DEGREES / Math.max(1, total));
            onStep(direction);
          }
        }}
        onPointerUp={(e) => {
          const dragged = lastAngle.current !== null && carried.current !== 0;
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          lastAngle.current = null;
          // A tap on a dial nudges it one place. Only when the pointer
          // never actually travelled, or a click after a drag would fire
          // an extra step on every release.
          if (!dragged) onStep(1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onStep(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onStep(-1);
          }
        }}
      >
        <span className="tv-knob-pointer" aria-hidden="true" />
      </div>
      <span className="tv-knob-label">{label}</span>
    </div>
  );
}

/** The 70s and 80s sets: two dials on the cabinet beside the screen. */
function KnobPanel({
  clips,
  index,
  muted,
  actions,
}: {
  clips: FeedTvClip[];
  index: number;
  muted: boolean;
  actions: TvActions;
}) {
  return (
    <div className="tv-knob-panel">
      <Knob
        label="Channel"
        position={index}
        total={clips.length}
        onStep={(direction) => actions.select(nextChannel(index, clips.length, direction))}
      />
      {/* Two positions, because the site has a mute and not a volume: a
          dial that pretended to be continuous and only had off and on
          would be the same lie as a knob that doesn't turn. */}
      <Knob label="Volume" position={muted ? 0 : 1} total={2} onStep={actions.toggleMute} />
      <div className="tv-grille" aria-hidden="true" />
    </div>
  );
}

/**
 * The 90s set: a disc slot, and the feed as a shelf of cases.
 *
 * Drag one in and it plays. Dropping a disc into a machine is the single
 * most era-accurate thing this player can do, so it is a real drag - with
 * a click as the shortcut, because dragging is nobody's only option.
 */
function DiscDeck({
  clips,
  index,
  actions,
  label,
}: {
  clips: FeedTvClip[];
  index: number;
  actions: TvActions;
  label: string;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  function load(i: number) {
    setDragging(null);
    setOver(false);
    actions.select(i);
  }

  return (
    <div className="tv-deck">
      <div
        className={`tv-slot${over ? " over" : ""}`}
        onDragOver={(e) => {
          // Without this the browser refuses the drop, and the case
          // springs back as though the slot were painted on.
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          const i = Number(e.dataTransfer.getData("text/plain"));
          if (Number.isInteger(i) && i >= 0 && i < clips.length) load(i);
          else setOver(false);
        }}
      >
        <span className="tv-slot-mouth" aria-hidden="true" />
        <span className="tv-slot-label">{over ? "Let go" : label}</span>
      </div>

      <div className="tv-cases">
        {clips.map((clip, i) => (
          <button
            key={clip.id}
            type="button"
            className={`tv-case${i === index ? " loaded" : ""}${dragging === i ? " lifting" : ""}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", String(i));
              e.dataTransfer.effectAllowed = "move";
              setDragging(i);
            }}
            onDragEnd={() => setDragging(null)}
            onClick={() => load(i)}
            title={clip.artist ? `${clip.title} - ${clip.artist}` : clip.title}
          >
            <img src={`https://img.youtube.com/vi/${clip.youtubeVideoId}/mqdefault.jpg`} alt="" />
            <span className="tv-case-spine">{clip.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The 2000s set: soft buttons, a media slot and a headphone socket. */
function ButtonPanel({
  clips,
  index,
  paused,
  muted,
  actions,
}: {
  clips: FeedTvClip[];
  index: number;
  paused: boolean;
  muted: boolean;
  actions: TvActions;
}) {
  return (
    <div className="tv-button-panel">
      <div className="tv-softkeys">
        <button type="button" onClick={actions.previous} aria-label="Previous">
          ⏮
        </button>
        <button type="button" onClick={actions.togglePause} aria-label={paused ? "Play" : "Pause"}>
          {paused ? "▶" : "❚❚"}
        </button>
        <button type="button" onClick={actions.next} aria-label="Next">
          ⏭
        </button>
        <button type="button" onClick={actions.toggleMute} className="wide">
          {muted ? "Unmute" : "Mute"}
        </button>
      </div>
      <DiscDeck clips={clips} index={index} actions={actions} label="Load a disc" />
      {/* Not a control. Every set of this shape had one on the front, and
          leaving it off is the detail people notice. */}
      <div className="tv-jack" aria-hidden="true">
        <span className="tv-jack-ring" />
        <span className="tv-jack-text">PHONES</span>
      </div>
    </div>
  );
}

/**
 * The 2010s: a click wheel.
 *
 * Turning it moves through the feed, the four edges are the buttons they
 * were, and the middle plays and pauses. The wheel accumulates travel and
 * fires a click every thirty degrees, which is what stops a slow drag
 * from either doing nothing or flying through the whole list.
 */
function ClickWheel({
  clips,
  index,
  paused,
  actions,
}: {
  clips: FeedTvClip[];
  index: number;
  paused: boolean;
  actions: TvActions;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastAngle = useRef<number | null>(null);
  const carried = useRef(0);

  function angleAt(clientX: number, clientY: number): number | null {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return angleFromCentre(
      clientX - (rect.left + rect.width / 2),
      clientY - (rect.top + rect.height / 2)
    );
  }

  return (
    <div className="tv-wheel-area">
      <div
        ref={ref}
        className="tv-wheel"
        role="slider"
        tabIndex={0}
        aria-label="Click wheel"
        aria-valuemin={1}
        aria-valuemax={Math.max(1, clips.length)}
        aria-valuenow={index + 1}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          lastAngle.current = angleAt(e.clientX, e.clientY);
          carried.current = 0;
        }}
        onPointerMove={(e) => {
          if (lastAngle.current === null) return;
          const now = angleAt(e.clientX, e.clientY);
          if (now === null) return;
          carried.current += wheelDelta(lastAngle.current, now);
          lastAngle.current = now;
          while (Math.abs(carried.current) >= WHEEL_STEP_DEGREES) {
            const direction = carried.current > 0 ? 1 : -1;
            carried.current -= direction * WHEEL_STEP_DEGREES;
            actions.select(nextChannel(index, clips.length, direction));
          }
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          lastAngle.current = null;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            actions.next();
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            actions.previous();
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            actions.togglePause();
          }
        }}
      >
        <span className="tv-wheel-label top">MENU</span>
        <button
          type="button"
          className="tv-wheel-edge left"
          onClick={actions.previous}
          aria-label="Previous"
        >
          ⏮
        </button>
        <button
          type="button"
          className="tv-wheel-edge right"
          onClick={actions.next}
          aria-label="Next"
        >
          ⏭
        </button>
        <span className="tv-wheel-label bottom" aria-hidden="true">
          {paused ? "▶" : "❚❚"}
        </span>
        <button
          type="button"
          className="tv-wheel-centre"
          onClick={actions.togglePause}
          aria-label={paused ? "Play" : "Pause"}
        />
      </div>
    </div>
  );
}

export function TvControls({
  era,
  clips,
  index,
  paused,
  muted,
  actions,
}: {
  era: TvEra;
  clips: FeedTvClip[];
  index: number;
  paused: boolean;
  muted: boolean;
  actions: TvActions;
}) {
  // Knobs and a disc slot never went together on one set, so this is a
  // straight choice rather than a set of flags to combine.
  if (era.controls === "knobs") {
    return <KnobPanel clips={clips} index={index} muted={muted} actions={actions} />;
  }

  if (era.controls === "wheel") {
    return <ClickWheel clips={clips} index={index} paused={paused} actions={actions} />;
  }

  if (era.hasDiscSlot) {
    return (
      <ButtonPanel clips={clips} index={index} paused={paused} muted={muted} actions={actions} />
    );
  }

  // The modern set keeps the chrome it already had.
  return null;
}
