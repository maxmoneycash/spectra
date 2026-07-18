import { describe, it, expect } from 'vitest';
import { detectEmissions, EmissionTracker, estimateNoiseFloor, type Detection } from './detector';

/** Build a synthetic dB spectrum: flat noise floor with raised signal regions. */
function makeSpectrum(
  n: number,
  noiseDb: number,
  signals: { bin: number; width: number; db: number }[],
): Float32Array {
  const s = new Float32Array(n).fill(noiseDb);
  for (const sig of signals) {
    for (let b = sig.bin - sig.width; b <= sig.bin + sig.width; b++) {
      if (b >= 0 && b < n) s[b] = sig.db;
    }
  }
  return s;
}

describe('detectEmissions', () => {
  it('finds seeded emissions at the right frequency and bandwidth', () => {
    const N = 1024;
    const binHz = 1000; // 1.024 MHz span
    const spec = makeSpectrum(N, -90, [
      { bin: 600, width: 10, db: -50 }, // +88 kHz, ~21 kHz wide
      { bin: 300, width: 3, db: -60 }, // -212 kHz, ~7 kHz wide
    ]);
    const dets = detectEmissions(spec, { binHz, centerFreqHz: 100e6, thresholdDb: 10 });
    expect(dets.length).toBe(2);
    const near = (off: number) => dets.find((d) => Math.abs(d.offsetHz - off) < 4000);
    const a = near(88_000);
    const b = near(-212_000);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a!.bandwidthHz).toBeGreaterThan(15_000);
    expect(a!.bandwidthHz).toBeLessThan(28_000);
    expect(a!.snrDb).toBeGreaterThan(30);
  });

  it('ignores a flat noise floor', () => {
    const spec = new Float32Array(1024).fill(-88);
    const dets = detectEmissions(spec, { binHz: 1000, centerFreqHz: 100e6, thresholdDb: 10 });
    expect(dets.length).toBe(0);
  });

  it('estimates the noise floor near the true value', () => {
    const spec = makeSpectrum(1024, -85, [{ bin: 500, width: 20, db: -40 }]);
    expect(estimateNoiseFloor(spec)).toBeCloseTo(-85, 0);
  });
});

describe('EmissionTracker', () => {
  const det = (offsetHz: number, snr = 30): Detection => ({
    offsetHz,
    centerFreqHz: 100e6 + offsetHz,
    bandwidthHz: 5000,
    peakDb: -50,
    snrDb: snr,
    crestDb: 5,
  });

  it('confirms a track after repeated detections and gives it a stable id', () => {
    const tr = new EmissionTracker();
    expect(tr.update([det(0)]).length).toBe(0); // first sighting: unconfirmed
    const out = tr.update([det(200)]); // second: confirmed
    expect(out.length).toBe(1);
    const id = out[0].id;
    expect(tr.update([det(-100)])[0].id).toBe(id); // same track keeps its id
  });

  it('dedups overlapping tracks, keeping the stronger', () => {
    const tr = new EmissionTracker();
    // Two nearby detections + confirm over two frames.
    tr.update([det(0, 40), det(3000, 20)]);
    const out = tr.update([det(0, 40), det(3000, 20)]);
    expect(out.length).toBe(1);
    expect(out[0].snrDb).toBeGreaterThan(30); // kept the stronger one
  });

  it('keeps well-separated emissions distinct', () => {
    const tr = new EmissionTracker();
    tr.update([det(0), det(80_000)]);
    const out = tr.update([det(0), det(80_000)]);
    expect(out.length).toBe(2);
  });
});
