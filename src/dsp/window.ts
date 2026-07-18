/** Window functions used for spectral estimation and FIR design. */
export type WindowType =
  | 'rect'
  | 'hann'
  | 'hamming'
  | 'blackman'
  | 'blackman-harris';

/** Build a window of length n. Symmetric (good for FIR design and analysis). */
export function makeWindow(type: WindowType, n: number): Float32Array {
  const w = new Float32Array(n);
  if (n === 1) {
    w[0] = 1;
    return w;
  }
  const N = n - 1;
  const twoPi = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    switch (type) {
      case 'rect':
        w[i] = 1;
        break;
      case 'hann':
        w[i] = 0.5 - 0.5 * Math.cos((twoPi * i) / N);
        break;
      case 'hamming':
        w[i] = 0.54 - 0.46 * Math.cos((twoPi * i) / N);
        break;
      case 'blackman':
        w[i] =
          0.42 -
          0.5 * Math.cos((twoPi * i) / N) +
          0.08 * Math.cos((2 * twoPi * i) / N);
        break;
      case 'blackman-harris':
        w[i] =
          0.35875 -
          0.48829 * Math.cos((twoPi * i) / N) +
          0.14128 * Math.cos((2 * twoPi * i) / N) -
          0.01168 * Math.cos((3 * twoPi * i) / N);
        break;
    }
  }
  return w;
}

/** Sum of window samples — used to normalise coherent gain. */
export function windowCoherentGain(w: Float32Array): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i];
  return s / w.length;
}
