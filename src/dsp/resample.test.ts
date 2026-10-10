import { describe, expect, it } from 'vitest';
import { StreamResampler } from './resample';

function tone(n: number, fHz: number, rate: number, amp = 1): { re: Float32Array; im: Float32Array } {
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ph = (2 * Math.PI * fHz * i) / rate;
    re[i] = amp * Math.cos(ph);
    im[i] = amp * Math.sin(ph);
  }
  return { re, im };
}

/** Frequency of a (nearly) pure complex tone from its mean phase advance. */
function estimateHz(re: Float32Array, im: Float32Array, n: number, rate: number, skip = 400): number {
  let sx = 0;
  let sy = 0;
  for (let i = skip; i < n - 1; i++) {
    // angle(z[i+1] * conj(z[i]))
    const x = re[i + 1] * re[i] + im[i + 1] * im[i];
    const y = im[i + 1] * re[i] - re[i + 1] * im[i];
    sx += x;
    sy += y;
  }
  return (Math.atan2(sy, sx) * rate) / (2 * Math.PI);
}

function rms(re: Float32Array, im: Float32Array, n: number, skip = 400): number {
  let s = 0;
  for (let i = skip; i < n; i++) s += re[i] * re[i] + im[i] * im[i];
  return Math.sqrt(s / (n - skip));
}

function run(rs: StreamResampler, src: { re: Float32Array; im: Float32Array }, chunk: number) {
  const n = src.re.length;
  const outRe = new Float32Array(rs.outCapacity(n) + 16);
  const outIm = new Float32Array(outRe.length);
  let k = 0;
  for (let off = 0; off < n; off += chunk) {
    const len = Math.min(chunk, n - off);
    const cap = rs.outCapacity(len);
    const tRe = new Float32Array(cap);
    const tIm = new Float32Array(cap);
    const got = rs.process(src.re.subarray(off, off + len), src.im.subarray(off, off + len), len, tRe, tIm);
    outRe.set(tRe.subarray(0, got), k);
    outIm.set(tIm.subarray(0, got), k);
    k += got;
  }
  return { re: outRe, im: outIm, n: k };
}

describe('StreamResampler', () => {
  it('passes equal rates through untouched', () => {
    const rs = new StreamResampler(1_152_000, 1_152_000);
    const src = tone(4096, 10_000, 1_152_000);
    const out = run(rs, src, 1000);
    expect(out.n).toBe(4096);
    expect(out.re[1234]).toBe(src.re[1234]);
  });

  it('keeps a tone at its frequency when downsampling 2.4 MSPS → 1.152 MSPS', () => {
    const rs = new StreamResampler(2_400_000, 1_152_000);
    const src = tone(96_000, 100_000, 2_400_000);
    const out = run(rs, src, 4096);
    expect(out.n).toBeGreaterThan(45_000);
    expect(Math.abs(estimateHz(out.re, out.im, out.n, 1_152_000) - 100_000)).toBeLessThan(100);
    // Amplitude survives the passband.
    expect(rms(out.re, out.im, out.n)).toBeGreaterThan(0.9);
  });

  it('produces about in·out/in outputs', () => {
    const rs = new StreamResampler(2_400_000, 1_152_000);
    const out = run(rs, tone(48_000, 1000, 2_400_000), 3000);
    expect(Math.abs(out.n - 48_000 * (1_152_000 / 2_400_000))).toBeLessThan(40);
  });

  it('rejects a tone above the output Nyquist instead of folding it in', () => {
    const rs = new StreamResampler(2_400_000, 1_152_000);
    // 700 kHz is above the 576 kHz output Nyquist; without the lowpass it would alias to 452 kHz.
    const out = run(rs, tone(96_000, 700_000, 2_400_000), 4096);
    expect(rms(out.re, out.im, out.n)).toBeLessThan(0.03); // > 30 dB down
  });

  it('is chunk-size independent (stream continuity)', () => {
    const src = tone(40_000, 123_456, 2_400_000);
    const whole = run(new StreamResampler(2_400_000, 1_152_000), src, 40_000);
    const pieces = run(new StreamResampler(2_400_000, 1_152_000), src, 997);
    expect(pieces.n).toBe(whole.n);
    let maxDiff = 0;
    for (let i = 0; i < whole.n; i++) maxDiff = Math.max(maxDiff, Math.abs(whole.re[i] - pieces.re[i]), Math.abs(whole.im[i] - pieces.im[i]));
    expect(maxDiff).toBeLessThan(1e-5);
  });

  it('upsamples too (1.024 MSPS → 1.152 MSPS)', () => {
    const rs = new StreamResampler(1_024_000, 1_152_000);
    const out = run(rs, tone(40_960, 50_000, 1_024_000), 2048);
    expect(Math.abs(out.n - 40_960 * (1_152_000 / 1_024_000))).toBeLessThan(40);
    expect(Math.abs(estimateHz(out.re, out.im, out.n, 1_152_000) - 50_000)).toBeLessThan(100);
  });
});
