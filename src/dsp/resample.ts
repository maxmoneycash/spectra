/**
 * Streaming rational-ish resampler for captures recorded at a rate other
 * than the engine's. Anti-alias lowpass (windowed-sinc, 90 % of the narrower
 * Nyquist) followed by linear interpolation on a fractional read position
 * that carries across chunks, so a stream fed in arbitrary pieces comes out
 * identical to one fed whole. Equal rates pass straight through.
 *
 * Linear interpolation after a proper lowpass is plenty for a waterfall and
 * demodulated audio; it is not a measurement-grade resampler.
 */
import { designLowpass, ComplexFIR } from './fir';

export class StreamResampler {
  /** Input samples per output sample. */
  readonly step: number;
  private readonly fir: ComplexFIR | null;
  private fRe = new Float32Array(0);
  private fIm = new Float32Array(0);
  /** Read position relative to the current chunk; index −1 is the previous chunk's last sample. */
  private pos = 0;
  private prevRe = 0;
  private prevIm = 0;
  private primed = false;

  constructor(
    readonly inRate: number,
    readonly outRate: number,
    taps = 127,
  ) {
    if (!(inRate > 0) || !(outRate > 0)) throw new Error('rates must be positive');
    this.step = inRate / outRate;
    if (inRate === outRate) {
      this.fir = null;
    } else {
      const cutoff = 0.45 * Math.min(1, outRate / inRate);
      this.fir = new ComplexFIR(designLowpass(taps, cutoff));
    }
  }

  /** Output samples a chunk of `n` inputs can produce at most. */
  outCapacity(n: number): number {
    return Math.ceil(n / this.step) + 2;
  }

  /** Resample `n` inputs; returns how many outputs were written. */
  process(inRe: Float32Array, inIm: Float32Array, n: number, outRe: Float32Array, outIm: Float32Array): number {
    if (n <= 0) return 0;
    if (!this.fir) {
      outRe.set(inRe.subarray(0, n));
      outIm.set(inIm.subarray(0, n));
      return n;
    }
    if (this.fRe.length < n) {
      this.fRe = new Float32Array(n);
      this.fIm = new Float32Array(n);
    }
    this.fir.process(inRe, inIm, this.fRe, this.fIm, n);
    const f = this.fRe;
    const g = this.fIm;
    const step = this.step;
    let p = this.pos;
    if (!this.primed) {
      this.prevRe = f[0];
      this.prevIm = g[0];
      this.primed = true;
      p = 0;
    }
    let k = 0;
    while (Math.floor(p) + 1 < n) {
      const i = Math.floor(p);
      const t = p - i;
      const aRe = i < 0 ? this.prevRe : f[i];
      const aIm = i < 0 ? this.prevIm : g[i];
      const bRe = f[i + 1];
      const bIm = g[i + 1];
      outRe[k] = aRe + t * (bRe - aRe);
      outIm[k] = aIm + t * (bIm - aIm);
      k++;
      p += step;
    }
    this.pos = p - n;
    this.prevRe = f[n - 1];
    this.prevIm = g[n - 1];
    return k;
  }

  reset(): void {
    this.pos = 0;
    this.primed = false;
    this.prevRe = this.prevIm = 0;
    if (this.fir) {
      // ComplexFIR has no reset; a fresh history is cheapest to get by refiltering zeros.
      const z = new Float32Array(this.fRe.length || 1);
      this.fir.process(z, z, new Float32Array(z.length), new Float32Array(z.length), z.length);
    }
  }
}
