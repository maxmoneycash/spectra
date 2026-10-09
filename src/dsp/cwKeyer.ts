import { AUDIO_RATE, CW_NOTE_HZ } from './receiver';

/**
 * Turns demodulated CW audio into keyed on/off intervals for the Morse
 * decoder.
 *
 * Detection is a quadrature detector on the beat note (CW_NOTE_HZ, ~120 Hz
 * wide), not a broadband envelope: a weak beacon stands ~8 dB further above
 * the noise in that bin than it does across the whole channel, and that
 * margin is what separates a −26 dB beacon's marks from noise peaks.
 *
 * Decisions are made 250 ms late, from the statistics of a 500 ms window
 * around each 10 ms hop: the floor is a low percentile of the hops' mean
 * level (Morse at 12 wpm and up always has gaps inside half a second), the
 * ceiling the window max. If the ceiling is not clearly above the floor,
 * nothing in the window keys — so an empty channel stays silent — and the
 * threshold sits at a fraction of the ceiling but never below a multiple of
 * the floor. Knowing the floor before the first element is keyed is what the
 * old peak-tracking keyer could not do: at power-on its threshold decayed
 * into the noise, noise keyed on, and the first dot of every transmission
 * fused with that chatter into a dash.
 *
 * Measured against the previous keyer on the same audio: first NCDXF
 * callsign after power-on copied exactly 8/8 times (was 0/8); phantom
 * letters on an empty channel 0 in 30 s (was 1); both −26 dB lesson beacons
 * and the squelch-opened-mid-stream case still copy; and Split the Pair
 * still reads as garbage at the stock width between the two stations, goes
 * quiet when narrowed but uncentred, and copies clean once centred.
 *
 * Shared by the worker and the end-to-end decode tests so they cannot drift.
 */
const HOP = Math.round(0.01 * AUDIO_RATE);
const WIN = 50; // hops: 500 ms
const LOOK = WIN >> 1; // decide this many hops late
const DET_CUT_HZ = 60;
const FLOOR_PCT = 0.1;
const GATE = 6;
const FLOOR_MULT = 4;
const PEAK_FRAC = 0.35;
const HYST = 0.6;
const MIN_INTERVAL_S = 0.01;

export class CwKeyer {
  // Detector: down-mix by the note with an incremental phasor, one-pole I/Q.
  private pRe = 1;
  private pIm = 0;
  private readonly wRe: number;
  private readonly wIm: number;
  private sinceNorm = 0;
  private i = 0;
  private q = 0;
  private readonly aDet = 1 - Math.exp((-2 * Math.PI * DET_CUT_HZ) / AUDIO_RATE);

  // The window: per-sample detector magnitude, and per-hop max and mean.
  private readonly ring = new Float32Array(WIN * HOP);
  private w = 0;
  private readonly hopMax = new Float32Array(WIN);
  private readonly hopMean = new Float32Array(WIN);
  private hops = 0; // hops completed since reset
  private curMax = 0;
  private curSum = 0;
  private inHop = 0;
  private readonly sorted = new Float32Array(WIN);

  private state = false;
  private samples = 0;

  constructor(private readonly onInterval: (on: boolean, durSec: number) => void) {
    const theta = (-2 * Math.PI * CW_NOTE_HZ) / AUDIO_RATE;
    this.wRe = Math.cos(theta);
    this.wIm = Math.sin(theta);
  }

  /** Forget the window: call on retune, mode or scene change, so the first
   *  hops of a new channel are not judged by the old one's levels. */
  reset(): void {
    this.pRe = 1;
    this.pIm = 0;
    this.sinceNorm = 0;
    this.i = 0;
    this.q = 0;
    this.ring.fill(0);
    this.w = 0;
    this.hops = 0;
    this.curMax = 0;
    this.curSum = 0;
    this.inHop = 0;
    this.state = false;
    this.samples = 0;
  }

  /** Feed `n` samples of demodulated audio. */
  process(audio: Float32Array, n: number): void {
    for (let k = 0; k < n; k++) {
      const x = audio[k];
      this.i += this.aDet * (x * this.pRe - this.i);
      this.q += this.aDet * (x * this.pIm - this.q);
      const nRe = this.pRe * this.wRe - this.pIm * this.wIm;
      this.pIm = this.pRe * this.wIm + this.pIm * this.wRe;
      this.pRe = nRe;
      if (++this.sinceNorm >= 1024) {
        const inv = 1 / (Math.hypot(this.pRe, this.pIm) || 1);
        this.pRe *= inv;
        this.pIm *= inv;
        this.sinceNorm = 0;
      }
      const m = Math.hypot(this.i, this.q);
      this.ring[this.w] = m;
      this.w = (this.w + 1) % this.ring.length;
      if (m > this.curMax) this.curMax = m;
      this.curSum += m;
      if (++this.inHop === HOP) {
        const slot = this.hops % WIN;
        this.hopMax[slot] = this.curMax;
        this.hopMean[slot] = this.curSum / HOP;
        this.hops++;
        this.curMax = 0;
        this.curSum = 0;
        this.inHop = 0;
        if (this.hops === WIN) {
          // First full window: decide its older half in one go, so the
          // opening hops of a transmission are never skipped.
          for (let back = WIN - 1; back >= LOOK; back--) this.decide(back);
        } else if (this.hops > WIN) {
          this.decide(LOOK);
        }
      }
    }
  }

  /** Decide the hop `back` hops behind the newest, from the whole window. */
  private decide(back: number): void {
    this.sorted.set(this.hopMean);
    this.sorted.sort();
    const floor = this.sorted[Math.floor(WIN * FLOOR_PCT)];
    let ceil = 0;
    for (let k = 0; k < WIN; k++) if (this.hopMax[k] > ceil) ceil = this.hopMax[k];
    const thrOn = ceil < GATE * floor ? Infinity : Math.max(PEAK_FRAC * ceil, FLOOR_MULT * floor);
    const thrOff = HYST * thrOn;
    const start = (this.w - (back + 1) * HOP + this.ring.length) % this.ring.length;
    for (let k = 0; k < HOP; k++) {
      const m = this.ring[(start + k) % this.ring.length];
      const on = this.state ? m > thrOff : m > thrOn;
      if (on !== this.state) {
        const dur = this.samples / AUDIO_RATE;
        if (dur > MIN_INTERVAL_S) this.onInterval(this.state, dur);
        this.state = on;
        this.samples = 0;
      } else {
        this.samples++;
      }
    }
  }
}
