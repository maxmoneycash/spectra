import { MSG_RATE, type Message } from './messages';

/**
 * Linear-interpolation resampler that turns a message-rate audio source into a
 * continuous stream of samples at the (much higher) RF sample rate. Maintains a
 * fractional phase accumulator across blocks so there are no discontinuities.
 */
export class MessagePump {
  private acc = 0;
  private s0 = 0;
  private s1 = 0;
  private readonly ratio: number;
  private readonly chunk = new Float32Array(2048);
  private chunkLen = 0;
  private chunkPos = 0;

  constructor(
    private readonly msg: Message,
    sampleRate: number,
  ) {
    this.ratio = MSG_RATE / sampleRate;
    this.s0 = this.pull();
    this.s1 = this.pull();
  }

  private pull(): number {
    if (this.chunkPos >= this.chunkLen) {
      this.msg.fill(this.chunk, this.chunk.length);
      this.chunkLen = this.chunk.length;
      this.chunkPos = 0;
    }
    return this.chunk[this.chunkPos++];
  }

  next(): number {
    const out = this.s0 + this.acc * (this.s1 - this.s0);
    this.acc += this.ratio;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.s0 = this.s1;
      this.s1 = this.pull();
    }
    return out;
  }
}

/**
 * Hilbert transformer: consumes a real message stream at MSG_RATE and yields the
 * analytic signal (real delayed + imaginary 90°-shifted). Used to build clean
 * single-sideband via the phasing method.
 */
export class AnalyticMessage {
  private readonly taps: Float32Array;
  private readonly hist: Float32Array;
  private readonly delayLine: Float32Array;
  private pos = 0;
  private readonly center: number;
  private readonly chunk = new Float32Array(2048);
  private chunkLen = 0;
  private chunkPos = 0;

  constructor(private readonly msg: Message, numTaps = 41) {
    if (numTaps % 2 === 0) numTaps += 1;
    this.taps = new Float32Array(numTaps);
    this.center = (numTaps - 1) / 2;
    // Ideal Hilbert impulse response, Hamming-windowed.
    for (let i = 0; i < numTaps; i++) {
      const k = i - this.center;
      let h = 0;
      if (k !== 0 && k % 2 !== 0) h = 2 / (Math.PI * k);
      const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (numTaps - 1));
      this.taps[i] = h * w;
    }
    this.hist = new Float32Array(numTaps);
    this.delayLine = new Float32Array(numTaps);
  }

  private pull(): number {
    if (this.chunkPos >= this.chunkLen) {
      this.msg.fill(this.chunk, this.chunk.length);
      this.chunkLen = this.chunk.length;
      this.chunkPos = 0;
    }
    return this.chunk[this.chunkPos++];
  }

  /** Returns [real, imag] of the analytic message sample. */
  next(out: [number, number]): void {
    const x = this.pull();
    const n = this.taps.length;
    this.hist[this.pos] = x;
    let imag = 0;
    let idx = this.pos;
    for (let t = 0; t < n; t++) {
      imag += this.hist[idx] * this.taps[t];
      idx--;
      if (idx < 0) idx = n - 1;
    }
    // Real path delayed by the filter's group delay (center taps).
    this.delayLine[this.pos] = x;
    let realIdx = this.pos - this.center;
    if (realIdx < 0) realIdx += n;
    const real = this.delayLine[realIdx];
    this.pos++;
    if (this.pos >= n) this.pos = 0;
    out[0] = real;
    out[1] = imag;
  }
}

/**
 * Complex linear-interpolation resampler for the analytic (SSB) message: pulls
 * (re, im) pairs at MSG_RATE and produces them at the RF sample rate.
 */
export class ComplexPump {
  private acc = 0;
  private r0 = 0;
  private i0 = 0;
  private r1 = 0;
  private i1 = 0;
  private readonly ratio: number;
  private readonly tmp: [number, number] = [0, 0];

  constructor(
    private readonly src: AnalyticMessage,
    sampleRate: number,
  ) {
    this.ratio = MSG_RATE / sampleRate;
    this.src.next(this.tmp);
    this.r0 = this.tmp[0];
    this.i0 = this.tmp[1];
    this.src.next(this.tmp);
    this.r1 = this.tmp[0];
    this.i1 = this.tmp[1];
  }

  next(out: [number, number]): void {
    out[0] = this.r0 + this.acc * (this.r1 - this.r0);
    out[1] = this.i0 + this.acc * (this.i1 - this.i0);
    this.acc += this.ratio;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.r0 = this.r1;
      this.i0 = this.i1;
      this.src.next(this.tmp);
      this.r1 = this.tmp[0];
      this.i1 = this.tmp[1];
    }
  }
}

/** Raised-cosine on/off ramp value for smooth keying edges (t in [0,1]). */
export function raisedEdge(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}
