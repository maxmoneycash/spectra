import { describe, expect, it } from 'vitest';
import { CaptureStream, seamTaper } from './stream';
import { encodeSamples } from './decode';
import type { ToWorker } from '../engine/protocol';

function constant(n: number, v: number): { re: Float32Array; im: Float32Array } {
  return { re: new Float32Array(n).fill(v), im: new Float32Array(n).fill(-v) };
}

describe('seamTaper', () => {
  it('fades the ends to zero and leaves the middle alone', () => {
    const { re, im } = constant(1000, 0.5);
    seamTaper(re, im, 1000, 100, true, true);
    expect(re[0]).toBe(0);
    expect(im[0]).toBe(-0);
    expect(re[999]).toBe(0);
    expect(re[500]).toBe(0.5);
    expect(re[50]).toBeGreaterThan(0);
    expect(re[50]).toBeLessThan(0.5);
  });

  it('only fades the ends it is asked to', () => {
    const { re, im } = constant(1000, 0.5);
    seamTaper(re, im, 1000, 100, false, true);
    expect(re[0]).toBe(0.5);
    expect(re[999]).toBe(0);
  });
});

describe('CaptureStream', () => {
  // Node ≥ 20 has File/Blob globally; the stream only uses slice().arrayBuffer() and size.
  const rate = 100_000;
  const n = 40_000; // 0.4 s → chunks of 16384, 16384, 7232
  const { re, im } = constant(n, 0.8);
  // Unscaled on purpose: the seam/chunk assertions below read the constant back by value.
  const file = new File([encodeSamples(re, im, 'ci16_le', 1)], 'loop.cs16');

  it('streams the file in chunks, loops, and tapers only the seam', async () => {
    const posted: ToWorker[] = [];
    const s = new CaptureStream(file, { sampleRate: rate, datatype: 'ci16_le', centerFreqHz: 1e6 }, (m) => posted.push(m));
    expect(s.totalSamples).toBe(n);
    expect(s.totalSec).toBeCloseTo(0.4, 6);
    await s.open();
    // open() primes two chunks; one more call reaches the end, the next wraps.
    await s.feed();
    await s.feed();
    const chunks = posted.filter((m): m is Extract<ToWorker, { type: 'playChunk' }> => m.type === 'playChunk');
    expect(posted[0].type).toBe('playOpen');
    expect(chunks.map((c) => c.re.length)).toEqual([16384, 16384, 7232, 16384]);
    // First chunk fades in; the last chunk of the window fades out; a middle chunk does neither.
    expect(chunks[0].re[0]).toBe(0);
    expect(chunks[0].re[5000]).toBeCloseTo(0.8, 3);
    expect(chunks[1].re[0]).toBeCloseTo(0.8, 3);
    expect(chunks[1].re[16383]).toBeCloseTo(0.8, 3);
    expect(chunks[2].re[7231]).toBe(0);
    // After the wrap the stream is back at sample 0: faded in again.
    expect(chunks[3].re[0]).toBe(0);
  });

  it('reports a position that wraps with the loop', () => {
    const s = new CaptureStream(file, { sampleRate: rate, datatype: 'ci16_le', centerFreqHz: 1e6 }, () => {});
    expect(s.posSec(10_000)).toBeCloseTo(0.1, 6);
    expect(s.posSec(n + 10_000)).toBeCloseTo(0.1, 6);
  });

  it('drops a feed that lands mid-read instead of reading twice', async () => {
    const posted: ToWorker[] = [];
    const s = new CaptureStream(file, { sampleRate: rate, datatype: 'ci16_le', centerFreqHz: 1e6 }, (m) => posted.push(m));
    await Promise.all([s.feed(), s.feed(), s.feed()]);
    expect(posted.filter((m) => m.type === 'playChunk')).toHaveLength(1);
  });
});
