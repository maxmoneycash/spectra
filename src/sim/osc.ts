/**
 * Cheap recursive real sine oscillator (phasor rotation, no per-sample trig).
 * Used to synthesise message audio at a modest rate before modulation.
 */
export class SineOsc {
  private pRe = 1;
  private pIm = 0;
  private wRe = 1;
  private wIm = 0;
  private count = 0;
  private rate: number;

  constructor(freqHz = 440, rate = 24000, phase = 0) {
    this.rate = rate;
    this.pRe = Math.cos(phase);
    this.pIm = Math.sin(phase);
    this.setFreq(freqHz);
  }

  setFreq(freqHz: number): void {
    const theta = (2 * Math.PI * freqHz) / this.rate;
    this.wRe = Math.cos(theta);
    this.wIm = Math.sin(theta);
  }

  /** Advance one sample, returning sin(phase) in [-1, 1]. */
  next(): number {
    const nRe = this.pRe * this.wRe - this.pIm * this.wIm;
    this.pIm = this.pRe * this.wIm + this.pIm * this.wRe;
    this.pRe = nRe;
    if (++this.count >= 2048) {
      const mag = Math.sqrt(this.pRe * this.pRe + this.pIm * this.pIm) || 1;
      this.pRe /= mag;
      this.pIm /= mag;
      this.count = 0;
    }
    return this.pIm;
  }
}

/** One-pole lowpass, handy for shaping noise into band-limited hiss. */
export class OnePole {
  private y = 0;
  private a: number;
  constructor(cutoff: number, rate: number) {
    const x = Math.exp((-2 * Math.PI * cutoff) / rate);
    this.a = x;
  }
  process(input: number): number {
    this.y = (1 - this.a) * input + this.a * this.y;
    return this.y;
  }
}
