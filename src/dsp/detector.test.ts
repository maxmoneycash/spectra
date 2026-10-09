import { describe, it, expect } from 'vitest';
import { detectEmissions, EmissionTracker, estimateNoiseFloor, type Detection, type Track } from './detector';

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

  it('merges a flicker at a wide station\'s skirt into the station', () => {
    // The dedup radius came from the candidate's width alone (8 kHz for a
    // 1 kHz ghost), so skirt flickers 50 kHz out from a 138 kHz FM station
    // were listed as emitters of their own: the FM band counted 8 for 4.
    const station = { ...det(0, 42), bandwidthHz: 138_000 };
    const ghost = { ...det(50_000, 14), bandwidthHz: 1_000 };
    const tr = new EmissionTracker();
    tr.update([station, ghost]);
    const out = tr.update([station, ghost]);
    expect(out.length).toBe(1);
    expect(out[0].bandwidthHz).toBeCloseTo(138_000, -3);
  });

  it('collapses a comb of narrow, briefly-present channels into one hopper', () => {
    // 24 carrier-only channels 35 kHz apart, one dwelt on at a time for ~3
    // frames: the 2.4 GHz hopper that used to list as ~20 "CW" entries.
    const chan = (i: number): Detection => ({ ...det(-400_000 + i * 35_000, 28), bandwidthHz: 900 });
    // The hop sequence is random, so at any moment some channels have gone
    // unvisited long enough to be culled: holes in the comb. Channels 7–10
    // and 15 are never revisited here, so by frame ~162 the comb has a
    // four-channel hole (wider than the link) and a one-channel hole, and
    // must still read as a single hopper.
    const visited = [...Array(24).keys()].filter((i) => i < 7 || (i > 10 && i !== 15));
    const tr = new EmissionTracker();
    let out: Track[] = [];
    for (let frame = 0; frame < 260; frame++) {
      const dets =
        frame < 2 ? Array.from({ length: 24 }, (_, i) => chan(i)) : [chan(visited[Math.floor(frame / 3) % visited.length])];
      out = tr.update(dets, { minHits: 2, maxMiss: 160 });
    }
    expect(out.length).toBe(1);
    expect(out[0].hopping?.members).toBe(19);
    expect(out[0].bandwidthHz).toBeGreaterThan(500_000);
    expect(out[0].id).toMatch(/^hop-/);
  });

  it('leaves a pile-up of steady narrow stations alone', () => {
    // Six CW stations 35 kHz apart, all keying most of the time: not a hopper.
    const chan = (i: number): Detection => ({ ...det(-100_000 + i * 35_000, 28), bandwidthHz: 900 });
    const tr = new EmissionTracker();
    let out: Track[] = [];
    for (let frame = 0; frame < 20; frame++) out = tr.update(Array.from({ length: 6 }, (_, i) => chan(i)));
    expect(out.length).toBe(6);
    expect(out.every((t) => !t.hopping)).toBe(true);
  });

  it('remembers occupied bandwidth: widens quickly, narrows slowly', () => {
    // A repeater's carrier-only hang (~0.3 s of narrow detections) used to
    // collapse a 12 kHz voice track to the carrier's width, and the
    // classifier then called the station CW.
    const wide = { ...det(0), bandwidthHz: 12_000 };
    const narrow = { ...det(0), bandwidthHz: 800 };
    const tr = new EmissionTracker();
    tr.update([wide]);
    tr.update([wide]);
    let t = tr.update([wide])[0];
    expect(t.bandwidthHz).toBeCloseTo(12_000, -2);
    for (let i = 0; i < 50; i++) t = tr.update([narrow])[0]; // ~0.7 s at 70 frames/s
    expect(t.bandwidthHz).toBeGreaterThan(8_000);

    const tr2 = new EmissionTracker();
    tr2.update([narrow]);
    tr2.update([narrow]);
    let u = tr2.update([narrow])[0];
    expect(u.bandwidthHz).toBeCloseTo(800, -1);
    for (let i = 0; i < 5; i++) u = tr2.update([wide])[0];
    expect(u.bandwidthHz).toBeGreaterThan(10_000);
  });
});
