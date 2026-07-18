/**
 * Deterministic pseudo-random generators. Scenarios are reproducible (same
 * seed → same spectrum), which matters for training, grading, and tests.
 */
export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x1a2b3c4d;
  }

  /** Mulberry32 — fast, decent-quality uniform in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Standard normal via Box–Muller. */
  private spare: number | null = null;
  gaussian(): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * mul;
    return u * mul;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  bool(pTrue = 0.5): boolean {
    return this.next() < pTrue;
  }
}
