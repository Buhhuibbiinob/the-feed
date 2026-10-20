// Sound for the record store: menu blips, the clunk of picking things
// up, the real 30-second previews, and the hiss and crackle that make a
// cassette sound like a cassette.
//
// Nothing plays until somebody presses Start, which is both what the
// browser requires and what a console does.
//
// The previews are Apple's own clips, played through a plain <audio>
// element straight from Apple. They are not routed through WebAudio,
// because that needs the clip's host to allow it (CORS) and a preview
// that silently refuses to play is worse than one without an effect on
// it. The medium's character is a separate noise layer underneath.

type Medium = "vinyl" | "cd" | "cassette" | "dvd";

export class StoreAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private crackle: number | null = null;
  private el: HTMLAudioElement | null = null;
  muted = false;
  onPreviewEnd: (() => void) | null = null;

  start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const C =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    const x = new C();
    this.ctx = x;
    this.master = x.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(x.destination);
    const len = x.sampleRate * 2;
    this.noiseBuf = x.createBuffer(1, len, x.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
    if (this.el) this.el.muted = m;
  }

  private tone(f: number, dur = 0.08, type: OscillatorType = "square", vol = 0.12, slide = 0, when = 0) {
    const x = this.ctx;
    if (!x || !this.master) return;
    const t = x.currentTime + when;
    const o = x.createOscillator();
    const g = x.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur = 0.1, vol = 0.15, f = 2000, when = 0, q = 1) {
    const x = this.ctx;
    if (!x || !this.master || !this.noiseBuf) return;
    const t = x.currentTime + when;
    const s = x.createBufferSource();
    s.buffer = this.noiseBuf;
    const b = x.createBiquadFilter();
    b.type = "bandpass";
    b.frequency.value = f;
    b.Q.value = q;
    const g = x.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(b);
    b.connect(g);
    g.connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  sfx = {
    move: () => this.tone(1040, 0.04, "square", 0.06),
    select: () => {
      this.tone(660, 0.06, "square", 0.09);
      this.tone(990, 0.09, "square", 0.09, 0, 0.06);
    },
    back: () => this.tone(500, 0.08, "square", 0.08, -200),
    grab: () => {
      this.noise(0.09, 0.2, 900);
      this.tone(150, 0.08, "triangle", 0.18, -60);
    },
    place: () => {
      this.noise(0.07, 0.18, 1400);
      this.tone(220, 0.07, "triangle", 0.18, -80);
    },
    pan: () => this.noise(0.5, 0.05, 600, 0, 0.6),
    error: () => {
      this.tone(180, 0.18, "sawtooth", 0.1, -50);
      this.tone(150, 0.2, "sawtooth", 0.1, -40, 0.12);
    },
    register: () => {
      this.noise(0.05, 0.2, 3500);
      this.tone(1318, 0.12, "square", 0.07, 0, 0.08);
      this.tone(1760, 0.35, "square", 0.07, 0, 0.16);
      this.noise(0.2, 0.1, 5000, 0.2);
    },
    whirr: () => this.noise(0.6, 0.05, 300, 0, 0.5),
    click: () => this.tone(1400, 0.02, "square", 0.05),
    confirm: () => [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, "square", 0.08, 0, i * 0.07)),
  };

  /** The medium's own noise floor: crackle for vinyl, hiss for tape. */
  private startBed(medium: Medium) {
    this.stopBed();
    const x = this.ctx;
    if (!x || !this.master || !this.noiseBuf || (medium !== "vinyl" && medium !== "cassette")) return;
    const src = x.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = x.createBiquadFilter();
    f.type = medium === "cassette" ? "highpass" : "bandpass";
    f.frequency.value = medium === "cassette" ? 5000 : 2500;
    const gain = x.createGain();
    gain.gain.value = medium === "cassette" ? 0.012 : 0.018;
    src.connect(f);
    f.connect(gain);
    gain.connect(this.master);
    src.start();
    this.bed = { src, gain };
    if (medium === "vinyl") {
      this.crackle = window.setInterval(() => {
        if (Math.random() < 0.7) this.noise(0.012, 0.1 * Math.random() + 0.03, 3000 + Math.random() * 4000);
      }, 170);
    }
  }

  private stopBed() {
    if (this.crackle !== null) window.clearInterval(this.crackle);
    this.crackle = null;
    if (this.bed) {
      try {
        this.bed.src.stop();
      } catch {
        // Already stopped.
      }
      this.bed = null;
    }
  }

  /** Plays a real preview clip. Resolves false if it could not start. */
  async play(url: string, medium: Medium): Promise<boolean> {
    this.stop();
    this.start();
    const el = new Audio(url);
    el.preload = "auto";
    el.muted = this.muted;
    el.volume = 0.9;
    el.onended = () => {
      this.stopBed();
      this.onPreviewEnd?.();
    };
    this.el = el;
    try {
      await el.play();
      this.startBed(medium);
      return true;
    } catch {
      this.el = null;
      return false;
    }
  }

  /** Noise only, for a DVD whose trailer is playing in a <video>. */
  hum(medium: Medium) {
    this.start();
    this.startBed(medium);
  }

  stop() {
    this.stopBed();
    if (this.el) {
      this.el.onended = null;
      this.el.pause();
      this.el.removeAttribute("src");
      this.el.load();
      this.el = null;
    }
  }

  get playing(): boolean {
    return !!this.el && !this.el.paused;
  }

  /** 0-1, how far through the clip. */
  get progress(): number {
    const el = this.el;
    if (!el || !el.duration || !Number.isFinite(el.duration)) return 0;
    return el.currentTime / el.duration;
  }

  /**
   * The cashier speaking. Speech in the browser cannot be routed through
   * WebAudio, so it cannot be bit-crushed; a lo-fi hiss sits under it
   * instead. A pre-recorded, processed clip is the proper fix (see
   * docs/ps2-store/README.md). Resolves when the line has been said.
   */
  speak(text: string, onMouth: (open: number) => void): Promise<void> {
    this.start();
    return new Promise((resolve) => {
      let done = false;
      let mouthTimer: number | null = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (mouthTimer !== null) window.clearInterval(mouthTimer);
        onMouth(0);
        this.stopBed();
        resolve();
      };
      mouthTimer = window.setInterval(() => onMouth(Math.random() < 0.3 ? 0 : 0.4 + Math.random() * 0.6), 90);
      this.startBed("cassette");
      const ss = window.speechSynthesis;
      if (!this.muted && ss && typeof SpeechSynthesisUtterance !== "undefined") {
        try {
          ss.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 0.95;
          u.pitch = 1.15;
          const voices = ss.getVoices().filter((v) => /^en/i.test(v.lang));
          const pick = voices.find((v) => /female|samantha|zira|aria|jenny|google us/i.test(v.name)) ?? voices[0];
          if (pick) u.voice = pick;
          u.onend = finish;
          u.onerror = finish;
          ss.speak(u);
          window.setTimeout(finish, text.length * 95 + 2500);
          return;
        } catch {
          // Fall through to the blips.
        }
      }
      // No speech: the PS2 text-box blip, one per letter.
      for (let i = 0; i < text.length; i++) {
        if (text[i] !== " ") this.tone(180 + ((text.charCodeAt(i) * 13) % 260), 0.05, "square", 0.05, 0, i * 0.045);
      }
      window.setTimeout(finish, text.length * 45 + 400);
    });
  }

  dispose() {
    this.stop();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // Nothing to cancel.
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
