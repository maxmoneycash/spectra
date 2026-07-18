/**
 * Numerically-controlled complex oscillator (NCO). Maintains phase continuity
 * across blocks using incremental phasor rotation (no per-sample trig), with
 * periodic renormalisation to bound rounding drift. This is the workhorse for
 * both frequency translation in the receiver and up-conversion of every
 * simulated emitter into the wideband I/Q stream.
 */
export class ComplexOsc {
  private pRe = 1;
  private pIm = 0;
  private wRe = 1;
  private wIm = 0;
  private sinceNorm = 0;
  private freqHz = 0;

  constructor(freqHz = 0, sampleRate = 1) {
    this.setFrequency(freqHz, sampleRate);
  }

  setFrequency(freqHz: number, sampleRate: number): void {
    this.freqHz = freqHz;
    const theta = (2 * Math.PI * freqHz) / sampleRate;
    this.wRe = Math.cos(theta);
    this.wIm = Math.sin(theta);
  }

  get frequency(): number {
    return this.freqHz;
  }

  /** Reset phase to zero (phasor = 1 + 0j). */
  resetPhase(): void {
    this.pRe = 1;
    this.pIm = 0;
    this.sinceNorm = 0;
  }

  /** out[i] = in[i] * e^{j·phase}; phase advances each sample. */
  mix(
    inRe: Float32Array,
    inIm: Float32Array,
    outRe: Float32Array,
    outIm: Float32Array,
    len = inRe.length,
  ): void {
    let pRe = this.pRe;
    let pIm = this.pIm;
    const wRe = this.wRe;
    const wIm = this.wIm;
    for (let i = 0; i < len; i++) {
      const ir = inRe[i];
      const ii = inIm[i];
      outRe[i] = ir * pRe - ii * pIm;
      outIm[i] = ir * pIm + ii * pRe;
      const nRe = pRe * wRe - pIm * wIm;
      pIm = pRe * wIm + pIm * wRe;
      pRe = nRe;
      if (++this.sinceNorm >= 1024) {
        const mag = Math.sqrt(pRe * pRe + pIm * pIm) || 1;
        const inv = 1 / mag;
        pRe *= inv;
        pIm *= inv;
        this.sinceNorm = 0;
      }
    }
    this.pRe = pRe;
    this.pIm = pIm;
  }

  /**
   * Up-convert a complex baseband and accumulate into a shared band buffer:
   *   band[i] += gain * baseband[i] * e^{j·phase}
   * The core of mixing many emitters into one wideband spectrum.
   */
  mixAdd(
    inRe: Float32Array,
    inIm: Float32Array,
    bandRe: Float32Array,
    bandIm: Float32Array,
    len: number,
    gain: number,
  ): void {
    let pRe = this.pRe;
    let pIm = this.pIm;
    const wRe = this.wRe;
    const wIm = this.wIm;
    for (let i = 0; i < len; i++) {
      const ir = inRe[i] * gain;
      const ii = inIm[i] * gain;
      bandRe[i] += ir * pRe - ii * pIm;
      bandIm[i] += ir * pIm + ii * pRe;
      const nRe = pRe * wRe - pIm * wIm;
      pIm = pRe * wIm + pIm * wRe;
      pRe = nRe;
      if (++this.sinceNorm >= 1024) {
        const mag = Math.sqrt(pRe * pRe + pIm * pIm) || 1;
        const inv = 1 / mag;
        pRe *= inv;
        pIm *= inv;
        this.sinceNorm = 0;
      }
    }
    this.pRe = pRe;
    this.pIm = pIm;
  }
}
