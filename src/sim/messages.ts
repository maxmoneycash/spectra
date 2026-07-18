import { Rng } from './prng';
import { SineOsc, OnePole } from './osc';

/** Sample rate at which message audio is synthesised before modulation. */
export const MSG_RATE = 24000;

/** A source of baseband message audio in [-1, 1], stateful across blocks. */
export interface Message {
  fill(buf: Float32Array, len: number): void;
}

/** Steady single or two-tone test signal. */
export class ToneMessage implements Message {
  private a: SineOsc;
  private b: SineOsc | null;
  constructor(freqA = 1000, freqB?: number) {
    this.a = new SineOsc(freqA, MSG_RATE);
    this.b = freqB ? new SineOsc(freqB, MSG_RATE) : null;
  }
  fill(buf: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      let v = this.a.next();
      if (this.b) v = 0.5 * (v + this.b.next());
      buf[i] = v * 0.7;
    }
  }
}

/**
 * Speech-like babble: two or three formant oscillators that drift in pitch,
 * amplitude-gated by a syllabic envelope so it has the on/off cadence of voice.
 */
export class VoiceMessage implements Message {
  private formants: SineOsc[];
  private baseFreqs: number[];
  private rng: Rng;
  private env = 0;
  private target = 0;
  private holdCounter = 0;
  private drift = 0;

  constructor(rng: Rng) {
    this.rng = rng;
    this.baseFreqs = [
      rng.range(180, 260),
      rng.range(700, 1100),
      rng.range(1800, 2500),
    ];
    this.formants = this.baseFreqs.map((f) => new SineOsc(f, MSG_RATE));
  }

  fill(buf: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      if (this.holdCounter <= 0) {
        // New syllable/pause every 60–260 ms.
        this.target = this.rng.bool(0.72) ? this.rng.range(0.5, 1) : 0;
        this.holdCounter = Math.floor(this.rng.range(0.06, 0.26) * MSG_RATE);
        this.drift = this.rng.range(-0.02, 0.02);
      }
      this.holdCounter--;
      this.env += (this.target - this.env) * 0.002;

      let pitchMul = 1 + this.drift * Math.sin(i * 0.0002);
      let v = 0;
      for (let k = 0; k < this.formants.length; k++) {
        this.formants[k].setFreq(this.baseFreqs[k] * pitchMul);
        v += this.formants[k].next() * (k === 0 ? 1 : 0.5 / k);
      }
      buf[i] = (v / 2) * this.env;
    }
  }
}

/** Simple procedural melody: an arpeggiator over a scale plus a bass note. */
export class MusicMessage implements Message {
  private lead = new SineOsc(440, MSG_RATE);
  private bass = new SineOsc(110, MSG_RATE);
  private rng: Rng;
  private noteCounter = 0;
  private noteEnv = 0;
  private scale = [0, 2, 4, 5, 7, 9, 11, 12];
  private root: number;

  constructor(rng: Rng) {
    this.rng = rng;
    this.root = rng.pick([220, 246.94, 261.63, 293.66]);
  }

  private noteFreq(semi: number): number {
    return this.root * Math.pow(2, semi / 12);
  }

  fill(buf: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      if (this.noteCounter <= 0) {
        const semi = this.rng.pick(this.scale) + (this.rng.bool(0.3) ? 12 : 0);
        this.lead.setFreq(this.noteFreq(semi));
        this.noteCounter = Math.floor(this.rng.range(0.12, 0.24) * MSG_RATE);
        this.noteEnv = 1;
        if (this.rng.bool(0.25)) this.bass.setFreq(this.noteFreq(-12));
      }
      this.noteCounter--;
      this.noteEnv *= 0.9997;
      const v = this.lead.next() * 0.6 * this.noteEnv + this.bass.next() * 0.25;
      buf[i] = v * 0.8;
    }
  }
}

/** Band-limited noise (static, weak un-modulated hiss). */
export class NoiseMessage implements Message {
  private rng: Rng;
  private lp: OnePole;
  constructor(rng: Rng, cutoff = 4000) {
    this.rng = rng;
    this.lp = new OnePole(cutoff, MSG_RATE);
  }
  fill(buf: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      buf[i] = this.lp.process(this.rng.gaussian() * 0.5);
    }
  }
}
