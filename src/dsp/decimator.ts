/**
 * Streaming complex decimating FIR filter. Only output samples are computed
 * (one every `factor` inputs), so a wide-to-audio decimation costs
 * outputRate × taps rather than inputRate × taps. Keeps a delay line so blocks
 * stitch together without discontinuities.
 */
export class FIRDecimator {
  readonly factor: number;
  private readonly taps: Float32Array;
  private readonly histRe: Float32Array;
  private readonly histIm: Float32Array;
  private pos = 0;
  private phase: number;

  constructor(taps: Float32Array, factor: number) {
    if (factor < 1 || !Number.isInteger(factor)) {
      throw new Error(`decimation factor must be a positive integer, got ${factor}`);
    }
    this.taps = taps;
    this.factor = factor;
    this.histRe = new Float32Array(taps.length);
    this.histIm = new Float32Array(taps.length);
    this.phase = factor;
  }

  /** Maximum output samples a call with `len` inputs could produce. */
  maxOut(len: number): number {
    return Math.ceil(len / this.factor) + 1;
  }

  /**
   * Decimate a block. Writes into outRe/outIm and returns the number of
   * output samples produced.
   */
  process(
    inRe: Float32Array,
    inIm: Float32Array,
    outRe: Float32Array,
    outIm: Float32Array,
    len = inRe.length,
  ): number {
    const taps = this.taps;
    const n = taps.length;
    const hRe = this.histRe;
    const hIm = this.histIm;
    let pos = this.pos;
    let phase = this.phase;
    let out = 0;
    for (let i = 0; i < len; i++) {
      hRe[pos] = inRe[i];
      hIm[pos] = inIm[i];
      phase--;
      if (phase <= 0) {
        phase += this.factor;
        let accRe = 0;
        let accIm = 0;
        let idx = pos;
        for (let t = 0; t < n; t++) {
          const c = taps[t];
          accRe += hRe[idx] * c;
          accIm += hIm[idx] * c;
          idx--;
          if (idx < 0) idx = n - 1;
        }
        outRe[out] = accRe;
        outIm[out] = accIm;
        out++;
      }
      pos++;
      if (pos >= n) pos = 0;
    }
    this.pos = pos;
    this.phase = phase;
    return out;
  }
}
