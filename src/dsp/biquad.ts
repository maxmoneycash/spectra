/**
 * Real-valued biquad sections (transposed direct form II) and a Butterworth
 * bandpass built from them. Used for the CW audio filter: a narrow passband
 * around the beat note, which the 187-tap FIRs at 48 kHz are far too short
 * to provide (their transition bands are ~850 Hz wide, so a "200 Hz" FIR is
 * mostly skirt).
 */
export class Biquad {
  private s1 = 0;
  private s2 = 0;
  constructor(
    private readonly b0: number,
    private readonly b1: number,
    private readonly b2: number,
    private readonly a1: number,
    private readonly a2: number,
  ) {}

  process(x: Float32Array, n: number): void {
    let s1 = this.s1;
    let s2 = this.s2;
    for (let i = 0; i < n; i++) {
      const v = x[i];
      const y = this.b0 * v + s1;
      s1 = this.b1 * v - this.a1 * y + s2;
      s2 = this.b2 * v - this.a2 * y;
      x[i] = y;
    }
    this.s1 = s1;
    this.s2 = s2;
  }

  reset(): void {
    this.s1 = 0;
    this.s2 = 0;
  }

  /** |H| at angular frequency w (rad/sample). */
  magnitudeAt(w: number): number {
    const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    const nr = this.b0 + this.b1 * c1 + this.b2 * c2, ni = -(this.b1 * s1 + this.b2 * s2);
    const dr = 1 + this.a1 * c1 + this.a2 * c2, di = -(this.a1 * s1 + this.a2 * s2);
    return Math.hypot(nr, ni) / Math.hypot(dr, di);
  }
}

function csqrt(re: number, im: number): { re: number; im: number } {
  const r = Math.hypot(re, im);
  return { re: Math.sqrt((r + re) / 2), im: Math.sign(im || 1) * Math.sqrt((r - re) / 2) };
}

/**
 * Butterworth bandpass of the given (even) order, centred on `f0` with a
 * −3 dB width of `bw`: an order/2-pole lowpass prototype through the
 * lowpass→bandpass transform, bilinear-transformed with the band edges
 * prewarped so they land where asked. Order 6 puts a station 350 Hz off the
 * note ~28 dB down at a 200 Hz width, and only ~5 dB down at 500 Hz — which
 * is the gameplay: the stock filter hears the neighbour, the narrow one doesn't.
 */
export class BandpassCascade {
  private readonly stages: Biquad[] = [];
  constructor(f0: number, bw: number, fs: number, order = 6) {
    const n = Math.max(1, Math.round(order / 2));
    const w1 = Math.tan((Math.PI * Math.max(1, f0 - bw / 2)) / fs);
    const w2 = Math.tan((Math.PI * Math.min(fs / 2 - 1, f0 + bw / 2)) / fs);
    const w0sq = w1 * w2;
    const b = w2 - w1;
    // Each prototype pole maps to two bandpass poles; the set is closed under
    // conjugation, so keeping the upper-half-plane poles gives one per section.
    const upper: { re: number; im: number }[] = [];
    for (let k = 0; k < n; k++) {
      const theta = (Math.PI * (2 * k + n + 1)) / (2 * n);
      const ar = b * Math.cos(theta), ai = b * Math.sin(theta); // B·p
      const { re: sr, im: si } = csqrt(ar * ar - ai * ai - 4 * w0sq, 2 * ar * ai);
      for (const s of [{ re: (ar + sr) / 2, im: (ai + si) / 2 }, { re: (ar - sr) / 2, im: (ai - si) / 2 }]) {
        if (s.im > 1e-12) upper.push(s);
      }
    }
    for (const s of upper) {
      // Bilinear: z = (1 + s) / (1 − s); zeros at z = ±1 (DC and Nyquist).
      const dr = 1 - s.re, di = -s.im;
      const d = dr * dr + di * di;
      const zr = ((1 + s.re) * dr + s.im * di) / d;
      const zi = (s.im * dr - (1 + s.re) * di) / d;
      this.stages.push(new Biquad(1, 0, -1, -2 * zr, zr * zr + zi * zi));
    }
    // Unity gain at the centre.
    const w = (2 * Math.PI * f0) / fs;
    let g = 1;
    for (const st of this.stages) g /= st.magnitudeAt(w);
    this.stages[0] = this.withGain(upper[0], g);
  }

  private withGain(s: { re: number; im: number }, g: number): Biquad {
    const dr = 1 - s.re, di = -s.im;
    const d = dr * dr + di * di;
    const zr = ((1 + s.re) * dr + s.im * di) / d;
    const zi = (s.im * dr - (1 + s.re) * di) / d;
    return new Biquad(g, 0, -g, -2 * zr, zr * zr + zi * zi);
  }

  process(x: Float32Array, n: number): void {
    for (const s of this.stages) s.process(x, n);
  }

  reset(): void {
    for (const s of this.stages) s.reset();
  }
}
