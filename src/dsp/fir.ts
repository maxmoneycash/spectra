import { makeWindow, type WindowType } from './window';

/**
 * Windowed-sinc FIR lowpass design.
 * @param numTaps  filter length (odd is preferred for a symmetric linear-phase filter)
 * @param cutoff   cutoff as a fraction of the sample rate (0..0.5)
 * @param window   analysis window applied to the ideal impulse response
 * @returns taps normalised to unity DC gain
 */
export function designLowpass(
  numTaps: number,
  cutoff: number,
  window: WindowType = 'blackman-harris',
): Float32Array {
  if (numTaps < 1) throw new Error('numTaps must be >= 1');
  if (cutoff <= 0 || cutoff >= 0.5) {
    throw new Error(`cutoff must be within (0, 0.5), got ${cutoff}`);
  }
  const taps = new Float32Array(numTaps);
  const win = makeWindow(window, numTaps);
  const M = (numTaps - 1) / 2;
  const wc = 2 * Math.PI * cutoff;

  let sum = 0;
  for (let i = 0; i < numTaps; i++) {
    const k = i - M;
    let h: number;
    if (k === 0) {
      h = 2 * cutoff;
    } else {
      h = Math.sin(wc * k) / (Math.PI * k);
    }
    h *= win[i];
    taps[i] = h;
    sum += h;
  }
  // Normalise to unity gain at DC.
  const inv = 1 / sum;
  for (let i = 0; i < numTaps; i++) taps[i] *= inv;
  return taps;
}

/**
 * Streaming complex FIR filter with an internal delay line, so successive
 * blocks of a stream filter seamlessly. Real (symmetric) taps applied to both
 * I and Q. Operates in place is avoided — outputs into caller-supplied arrays.
 */
export class ComplexFIR {
  private readonly taps: Float32Array;
  private readonly histRe: Float32Array;
  private readonly histIm: Float32Array;
  private pos = 0;

  constructor(taps: Float32Array) {
    this.taps = taps;
    this.histRe = new Float32Array(taps.length);
    this.histIm = new Float32Array(taps.length);
  }

  /** Filter a block; outRe/outIm must be at least as long as inRe. */
  process(
    inRe: Float32Array,
    inIm: Float32Array,
    outRe: Float32Array,
    outIm: Float32Array,
    len = inRe.length,
  ): void {
    const taps = this.taps;
    const n = taps.length;
    const hRe = this.histRe;
    const hIm = this.histIm;
    let pos = this.pos;
    for (let i = 0; i < len; i++) {
      hRe[pos] = inRe[i];
      hIm[pos] = inIm[i];
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
      outRe[i] = accRe;
      outIm[i] = accIm;
      pos++;
      if (pos >= n) pos = 0;
    }
    this.pos = pos;
  }
}
