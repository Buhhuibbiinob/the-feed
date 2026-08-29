/**
 * UI click sounds, synthesised rather than sampled.
 *
 * Two reasons it is generated in the browser instead of shipped as audio
 * files. The obvious one: Apple's actual sounds are Apple's, and copying
 * the files would be lifting their assets rather than building something
 * in the same spirit. The practical one: a click has to be instant, and
 * a synthesised burst starts on the same tick as the tap while a fetched
 * file may not have arrived.
 *
 * What a key click actually is, acoustically: a very short burst of
 * noise through a narrow band, decaying almost immediately. Around 20ms.
 * Longer than that and it stops being a click and starts being a beep -
 * which is the usual way this goes wrong on the web.
 */

const STORAGE_KEY = "feedback-sound";

export type ClickVariant = "tick" | "tock" | "toggle";

let ctx: AudioContext | null = null;

/** Created on the first real gesture, because a browser will not let
 *  audio start before one - and constructing it earlier just leaves a
 *  suspended context sitting there. */
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function soundEnabled(): boolean {
  try {
    // Default on: it was asked for. Anyone who dislikes it turns it off
    // once and the choice sticks per device.
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    // Private browsing, or storage blocked. Silence is the safer guess
    // when we cannot know the preference.
    return false;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Nothing to do - the toggle just will not persist.
  }
}

/* Gains look high for a UI sound, and they are not.
   ------------------------------------------------------------
   A narrow bandpass throws away most of a noise burst's energy, so the
   gain here is nothing like the level you hear. Rendered offline and
   measured: at gain 0.16 the tick peaked at 0.055, which on a phone at
   normal volume is inaudible - I would have shipped a feature that did
   nothing and been told it was broken.

   Calibrated by measurement rather than guesswork, each variant peaks
   around 0.15-0.30 and is audible for 5-10ms. That is a click. Past
   about 40ms it stops being a click and becomes a beep, which is the
   usual way this goes wrong. */
const SPEC: Record<ClickVariant, { freq: number; q: number; dur: number; gain: number }> = {
  // The general tap: bright and dry, like a key. Peaks ~0.29.
  tick: { freq: 2400, q: 1.1, dur: 0.018, gain: 0.95 },
  // Navigation and destructive actions: lower, so "you went somewhere"
  // is distinguishable from "you pressed a thing" without anybody being
  // told that is what it means. Peaks ~0.23.
  tock: { freq: 1250, q: 1.3, dur: 0.024, gain: 1.0 },
  // Switches get the softest of the three; they fire a lot. Peaks ~0.14.
  toggle: { freq: 1800, q: 2.0, dur: 0.016, gain: 0.72 },
};

export function playClick(variant: ClickVariant = "tick") {
  if (!soundEnabled()) return;
  const audio = audioContext();
  if (!audio) return;

  const { freq, q, dur, gain } = SPEC[variant];
  const now = audio.currentTime;
  const frames = Math.max(1, Math.ceil(audio.sampleRate * dur));

  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Noise shaped by a cubic decay. A linear fade reads as a short
    // hiss; the cube is what makes it land as a single impact.
    const fade = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * fade * fade * fade;
  }

  const source = audio.createBufferSource();
  source.buffer = buffer;

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = q;

  const amp = audio.createGain();
  amp.gain.setValueAtTime(gain, now);
  // Exponential, not linear: the ear hears loudness logarithmically, so
  // a linear fade to zero still sounds like it stops abruptly.
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  source.connect(band).connect(amp).connect(audio.destination);
  source.start(now);
  source.stop(now + dur);
}
