import { describe, expect, it } from 'vitest';
import { BandpassCascade } from './biquad';

const FS = 48_000;
/** Steady-state RMS of a tone after the filter, in dB relative to the input. */
function gainDb(f: number, bpf: BandpassCascade): number {
  const n = FS; // 1 s
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * f * i) / FS);
  bpf.process(x, n);
  let acc = 0;
  for (let i = n / 2; i < n; i++) acc += x[i] * x[i]; // skip the transient
  return 10 * Math.log10(acc / (n / 2) / 0.5);
}

describe('CW bandpass cascade', () => {
  it('passes the 650 Hz note and rejects a station 350 Hz away at a 200 Hz width', () => {
    expect(gainDb(650, new BandpassCascade(650, 200, FS))).toBeGreaterThan(-1);
    expect(gainDb(1000, new BandpassCascade(650, 200, FS))).toBeLessThan(-25);
    expect(gainDb(300, new BandpassCascade(650, 200, FS))).toBeLessThan(-25);
  });

  it('has the requested −3 dB width', () => {
    const edge = gainDb(650 + 100, new BandpassCascade(650, 200, FS));
    expect(edge).toBeGreaterThan(-4.5);
    expect(edge).toBeLessThan(-1.5);
  });

  it('is wide open at the stock 500 Hz width, so the neighbour still gets in', () => {
    expect(gainDb(1000, new BandpassCascade(650, 500, FS))).toBeGreaterThan(-12);
  });
});
