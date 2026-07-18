/**
 * Radix-2 iterative Cooley-Tukey FFT operating in place on split (re/im)
 * Float32Array pairs. A single FFT instance precomputes the bit-reversal
 * permutation and twiddle-factor tables for one fixed transform size, so it is
 * cheap to reuse across the millions of transforms a live waterfall needs.
 */
export class FFT {
  readonly size: number;
  private readonly cosTable: Float32Array;
  private readonly sinTable: Float32Array;
  private readonly rev: Uint32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of two >= 2, got ${size}`);
    }
    this.size = size;

    const bits = Math.round(Math.log2(size));
    this.rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let x = i;
      let r = 0;
      for (let b = 0; b < bits; b++) {
        r = (r << 1) | (x & 1);
        x >>= 1;
      }
      this.rev[i] = r >>> 0;
    }

    const half = size >> 1;
    this.cosTable = new Float32Array(half);
    this.sinTable = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      const angle = (-2 * Math.PI * k) / size;
      this.cosTable[k] = Math.cos(angle);
      this.sinTable[k] = Math.sin(angle);
    }
  }

  /** In-place forward transform. re/im are modified. */
  forward(re: Float32Array, im: Float32Array): void {
    const n = this.size;
    const rev = this.rev;

    // Bit-reversal reordering.
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }

    const cosT = this.cosTable;
    const sinT = this.sinTable;
    for (let stage = 2; stage <= n; stage <<= 1) {
      const half = stage >> 1;
      const step = (n / stage) | 0;
      for (let i = 0; i < n; i += stage) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const c = cosT[k];
          const s = sinT[k];
          const l = j + half;
          const lr = re[l];
          const li = im[l];
          const tr = lr * c - li * s;
          const ti = lr * s + li * c;
          re[l] = re[j] - tr;
          im[l] = im[j] - ti;
          re[j] += tr;
          im[j] += ti;
        }
      }
    }
  }

  /** In-place inverse transform (normalised by 1/N). */
  inverse(re: Float32Array, im: Float32Array): void {
    const n = this.size;
    for (let i = 0; i < n; i++) im[i] = -im[i];
    this.forward(re, im);
    const inv = 1 / n;
    for (let i = 0; i < n; i++) {
      re[i] = re[i] * inv;
      im[i] = -im[i] * inv;
    }
  }
}
