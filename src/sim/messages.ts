import { Rng } from './prng';
import { SineOsc, OnePole } from './osc';
import { voiceSet } from './voicebank';
import type { BankSetMsg } from '../engine/protocol';

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

/* ------------------------------------------------------------ speech */

type SpeechState = 'gap' | 'talk' | 'hang' | 'beep' | 'tail';

export interface SpeechOptions {
  /** Pause between transmissions in a conversation, seconds. */
  gap?: [number, number];
  /** Pause after the last line before the conversation repeats, seconds. */
  rest?: [number, number];
  /** Called when a transmission starts (line index into the set). */
  onLine?: (line: number, set: BankSetMsg) => void;
  /**
   * Broadcast stations stay on the air between lines and before the bank
   * has loaded (dead air still has a carrier). Taken from the set once it
   * arrives; this covers the moments before.
   */
  continuous?: boolean;
}

/**
 * Plays recorded transmissions from the voice bank as a conversation, and
 * reports whether the transmitter is keyed, so emitters can drop the carrier
 * between overs like a real push-to-talk radio.
 *
 *   talk ─▶ (repeater) hang ─▶ beep ─▶ tail ─▶ gap ─▶ talk …
 *   talk ─▶ (simplex)  tail ─▶ gap
 *
 * The keyed flag is read by the modulator once per pump chunk (~85 ms), so
 * every transmission ends with a tail longer than that; the last syllable
 * is never clipped by the carrier dropping.
 */
/**
 * A net that only meets at scheduled times: on UTC minutes where
 * `minute % periodMin === offsetMin`, for the first `onSec` seconds. Outside
 * the window no transmission starts (one already keyed finishes), so the
 * intercept log only ever holds traffic that was really on the air.
 */
export interface SpeechSchedule {
  periodMin: number;
  offsetMin: number;
  onSec: number;
}

export function inScheduleWindow(s: SpeechSchedule, nowMs: number): boolean {
  const minute = Math.floor(nowMs / 60_000);
  const sec = (nowMs % 60_000) / 1000;
  return minute % s.periodMin === s.offsetMin && sec < s.onSec;
}

export class SpeechMessage implements Message {
  keyed = false;
  private state: SpeechState = 'gap';
  private counter: number;
  private line: number;
  private pos = 0;
  private beepPh = 0;
  private readonly gap: [number, number];
  private readonly rest: [number, number];
  /** Wall clock at creation, advanced in simulated time (like the NCDXF rotation). */
  private readonly wall0 = Date.now();
  private elapsed = 0;

  constructor(
    private readonly setId: string,
    private readonly rng: Rng,
    private readonly opts: SpeechOptions & { schedule?: SpeechSchedule } = {},
  ) {
    this.gap = opts.gap ?? [0.7, 2.2];
    this.rest = opts.rest ?? [7, 15];
    // Stagger: start somewhere in the conversation, after a short delay, so
    // two stations sharing a script never talk in unison.
    this.line = Math.floor(rng.range(0, 64)) - 1;
    this.counter = Math.floor(rng.range(0.3, 3) * MSG_RATE);
  }

  private nextGap(set: BankSetMsg): number {
    const lastLine = this.line >= set.lines.length - 1;
    const [a, b] = set.continuous ? [0.35, 0.9] : lastLine ? this.rest : this.gap;
    return Math.floor(this.rng.range(a, b) * MSG_RATE);
  }

  fill(buf: Float32Array, len: number): void {
    const set = voiceSet(this.setId);
    this.elapsed += len;
    const nowMs = this.wall0 + (this.elapsed / MSG_RATE) * 1000;
    for (let i = 0; i < len; i++) {
      switch (this.state) {
        case 'gap':
          buf[i] = 0;
          this.keyed = set ? set.continuous : !!this.opts.continuous;
          if (--this.counter > 0) break;
          if (!set || set.lines.length === 0) {
            this.counter = MSG_RATE; // bank not here yet — look again in a second
            break;
          }
          if (this.opts.schedule && !inScheduleWindow(this.opts.schedule, nowMs)) {
            this.counter = MSG_RATE >> 2; // off the schedule — check again in a quarter second
            break;
          }
          this.line = (((this.line + 1) % set.lines.length) + set.lines.length) % set.lines.length;
          this.pos = 0;
          this.state = 'talk';
          this.keyed = true;
          this.opts.onLine?.(this.line, set);
          break;
        case 'talk': {
          const pcm = set!.lines[this.line].pcm;
          buf[i] = this.pos < pcm.length ? pcm[this.pos] : 0;
          if (++this.pos >= pcm.length) {
            if (set!.courtesy) {
              this.state = 'hang';
              this.counter = Math.floor(0.32 * MSG_RATE);
            } else {
              this.state = 'tail';
              this.counter = Math.floor((set!.continuous ? 0.12 : 0.16) * MSG_RATE);
            }
          }
          break;
        }
        case 'hang':
          buf[i] = 0;
          if (--this.counter <= 0) {
            this.state = 'beep';
            this.counter = Math.floor(0.13 * MSG_RATE);
            this.beepPh = 0;
          }
          break;
        case 'beep': {
          // Courtesy tone: a soft 1 kHz blip with raised-cosine edges.
          const n = Math.floor(0.13 * MSG_RATE);
          const k = n - this.counter;
          const edge = Math.min(1, k / 240, this.counter / 240);
          this.beepPh += (2 * Math.PI * 1000) / MSG_RATE;
          buf[i] = 0.32 * edge * Math.sin(this.beepPh);
          if (--this.counter <= 0) {
            this.state = 'tail';
            this.counter = Math.floor(0.45 * MSG_RATE);
          }
          break;
        }
        case 'tail':
          buf[i] = 0;
          if (--this.counter <= 0) {
            this.state = 'gap';
            this.counter = this.nextGap(set!);
            this.keyed = !!set!.continuous;
          }
          break;
      }
    }
  }
}

/**
 * Speech over a quiet music bed, the way talk radio sounds. Broadcast FM
 * never goes dead silent: between lines a bare program would leave an
 * unmodulated carrier, a sharp spike the detector reads as Morse.
 */
export class BedMessage implements Message {
  private scratch = new Float32Array(0);
  constructor(
    private readonly voice: Message,
    private readonly bed: Message,
    private readonly bedLevel = 0.3,
  ) {}

  fill(buf: Float32Array, len: number): void {
    this.voice.fill(buf, len);
    if (this.scratch.length < len) this.scratch = new Float32Array(len);
    this.bed.fill(this.scratch, len);
    const g = this.bedLevel;
    for (let i = 0; i < len; i++) buf[i] += g * this.scratch[i];
  }
}
