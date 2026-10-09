import { describe, it, expect } from 'vitest';
import { evaluateSteps, snapLoRaBw, SUB_N } from './chirp';
import { SAMPLE_RATE } from '../engine/protocol';

/**
 * The sawtooth test on synthetic peak sequences. The chirp-width scene,
 * measured through sub-frame FFTs on 2026-10-09, stepped +54–55 kHz per
 * 0.889 ms with ≈ −70 kHz fly-backs (SF8, 125 kHz); these sequences are
 * built from that geometry, with the stray steps a symbol boundary adds.
 */
const subSec = SUB_N / SAMPLE_RATE;
const binHz = SAMPLE_RATE / SUB_N;
const quant = (hz: number) => Math.round(hz / binHz) * binHz;

/** Peak sequence of a LoRa chirp: sweeps `bw` in 2^sf / bw seconds, wrapping. */
function loraSteps(sf: number, bw: number, n: number, opts: { down?: boolean; strays?: number } = {}): number[] {
  const tSym = Math.pow(2, sf) / bw;
  const step = (bw / tSym) * subSec * (opts.down ? -1 : 1);
  const peaks: number[] = [];
  let f = -bw / 2 + 1000;
  for (let i = 0; i < n; i++) {
    peaks.push(quant(f));
    f += step;
    if (f >= bw / 2) f -= bw;
    if (f < -bw / 2) f += bw;
    // A symbol boundary jumps the start frequency by the data code.
    if (opts.strays && i % 7 === 6) f += (i % 3 === 0 ? 1 : -1) * opts.strays;
  }
  const steps: number[] = [];
  for (let i = 1; i < peaks.length; i++) steps.push(peaks[i] - peaks[i - 1]);
  return steps;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('snapLoRaBw', () => {
  it('snaps a measured width to the standard one within 15%, else null', () => {
    expect(snapLoRaBw(123_800)).toBe(125_000);
    expect(snapLoRaBw(131_000)).toBe(125_000);
    expect(snapLoRaBw(240_000)).toBe(250_000);
    expect(snapLoRaBw(2_250)).toBeNull();
    expect(snapLoRaBw(90_000)).toBeNull();
  });
});

describe('evaluateSteps: the sawtooth is a chirp and its geometry is the signal', () => {
  it('reads SF8 / 125 kHz from the chirp-width scene geometry, strays included', () => {
    const info = evaluateSteps(loraSteps(8, 125_000, 40, { strays: 30_000 }), subSec, binHz)!;
    expect(info).not.toBeNull();
    expect(info.bwHz).toBe(125_000);
    expect(info.sf).toBe(8);
    expect(info.rateHzPerS).toBeGreaterThan(55e6);
    expect(info.rateHzPerS).toBeLessThan(67e6);
    expect(info.consistency).toBeGreaterThan(0.6);
  });

  it('reads SF7 and SF9 at 125 kHz — one sweeps in barely more than a sub-frame, one in 4.6', () => {
    expect(evaluateSteps(loraSteps(7, 125_000, 40), subSec, binHz)?.sf).toBe(7);
    expect(evaluateSteps(loraSteps(9, 125_000, 60), subSec, binHz)?.sf).toBe(9);
  });

  it('reads a down-chirp with a negative rate and the same parameters', () => {
    const info = evaluateSteps(loraSteps(8, 125_000, 40, { down: true }), subSec, binHz)!;
    expect(info.rateHzPerS).toBeLessThan(0);
    expect(info.bwHz).toBe(125_000);
    expect(info.sf).toBe(8);
  });

  it('is not fooled by a tone-modulated FM station, whose deviation is a sinusoid', () => {
    // 75 kHz deviation at 1 kHz, sampled every sub-frame: both signs, but the
    // step magnitudes spread across a cosine instead of clustering.
    const peaks = Array.from({ length: 60 }, (_, n) => quant(75_000 * Math.sin(2 * Math.PI * 1000 * n * subSec)));
    const steps = peaks.slice(1).map((p, i) => p - peaks[i]);
    expect(evaluateSteps(steps, subSec, binHz)).toBeNull();
  });

  it('is not fooled by a drifting carrier (no fly-back) or a random walk (no consistency)', () => {
    expect(evaluateSteps(Array(30).fill(5_000), subSec, binHz)).toBeNull();
    const rnd = lcg(7);
    const walk = Array.from({ length: 60 }, () => quant((rnd() - 0.5) * 120_000));
    expect(evaluateSteps(walk, subSec, binHz)).toBeNull();
  });

  it('ignores a stable carrier flickering between adjacent bins', () => {
    const steps = Array.from({ length: 40 }, (_, i) => (i % 2 ? binHz : -binHz));
    expect(evaluateSteps(steps, subSec, binHz)).toBeNull();
  });

  it('needs enough evidence before it will say anything', () => {
    expect(evaluateSteps(loraSteps(8, 125_000, 6), subSec, binHz)).toBeNull();
  });
});
