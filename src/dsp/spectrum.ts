import { FFT } from './fft';
import { makeWindow, type WindowType } from './window';

/**
 * Power-spectrum estimator. Applies an analysis window, runs one FFT, and
 * returns FFT-shifted power in dBFS (0 dB ≈ a full-scale complex sinusoid).
 * Reuses scratch buffers so it can run every animation frame without GC churn.
 */
export class SpectrumAnalyzer {
  readonly size: number;
  private readonly fft: FFT;
  private readonly window: Float32Array;
  private readonly winSum: number;
  private readonly re: Float32Array;
  private readonly im: Float32Array;

  constructor(size: number, windowType: WindowType = 'blackman-harris') {
    this.size = size;
    this.fft = new FFT(size);
    this.window = makeWindow(windowType, size);
    let s = 0;
    for (let i = 0; i < size; i++) s += this.window[i];
    this.winSum = s;
    this.re = new Float32Array(size);
    this.im = new Float32Array(size);
  }

  /**
   * Compute the FFT-shifted power spectrum (dBFS) of `size` complex samples
   * starting at `offset` in the split input arrays. Result is written into
   * `outDb` (length === size); index 0 corresponds to -Fs/2, centre to DC.
   */
  compute(
    inRe: Float32Array,
    inIm: Float32Array,
    offset: number,
    outDb: Float32Array,
  ): void {
    const n = this.size;
    const re = this.re;
    const im = this.im;
    const w = this.window;
    for (let i = 0; i < n; i++) {
      const wi = w[i];
      re[i] = inRe[offset + i] * wi;
      im[i] = inIm[offset + i] * wi;
    }
    this.fft.forward(re, im);

    const norm = 1 / this.winSum;
    const half = n >> 1;
    // FFT shift: negative frequencies (upper half of the FFT) go to the left.
    for (let k = 0; k < n; k++) {
      const src = k < half ? k + half : k - half;
      const mag = Math.sqrt(re[src] * re[src] + im[src] * im[src]) * norm;
      outDb[k] = 20 * Math.log10(mag + 1e-12);
    }
  }
}

/** Exponential-moving-average smoothing of a spectrum frame (in place). */
export function smoothSpectrum(
  prev: Float32Array,
  next: Float32Array,
  alpha: number,
): void {
  for (let i = 0; i < next.length; i++) {
    prev[i] = prev[i] + alpha * (next[i] - prev[i]);
  }
}
