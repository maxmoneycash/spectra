import { describe, expect, it } from 'vitest';
import {
  ENCODE_SCALE,
  bytesPerSample,
  clipFraction,
  datatypeFromName,
  decodeSamples,
  encodeSamples,
  parseSigMFMeta,
  type CaptureDatatype,
} from './decode';

function tone(n: number): { re: Float32Array; im: Float32Array } {
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = 0.7 * Math.cos((2 * Math.PI * 7 * i) / n);
    im[i] = 0.7 * Math.sin((2 * Math.PI * 7 * i) / n);
  }
  return { re, im };
}

describe('sample decoders', () => {
  // Integer formats carry ENCODE_SCALE of headroom, so a round trip comes back
  // scaled by it; a player sees the same spectrum a quarter as loud, which the
  // receiver's AGC absorbs. cf32 is bit-exact.
  const tol: Record<CaptureDatatype, number> = { cf32_le: 1e-7, ci16_le: 1e-4, cu8: 0.01 };
  const gain: Record<CaptureDatatype, number> = { cf32_le: 1, ci16_le: ENCODE_SCALE, cu8: ENCODE_SCALE };

  for (const dt of ['cf32_le', 'ci16_le', 'cu8'] as CaptureDatatype[]) {
    it(`${dt} round-trips a tone within its precision`, () => {
      const { re, im } = tone(256);
      const buf = encodeSamples(re, im, dt);
      expect(buf.byteLength).toBe(256 * bytesPerSample(dt));
      const d = decodeSamples(buf, dt);
      expect(d.re.length).toBe(256);
      for (let i = 0; i < 256; i++) {
        expect(Math.abs(d.re[i] - re[i] * gain[dt])).toBeLessThan(tol[dt]);
        expect(Math.abs(d.im[i] - im[i] * gain[dt])).toBeLessThan(tol[dt]);
      }
    });
  }

  it('does not clip a summed band that exceeds ±1 (the First Light case)', () => {
    // Three carriers that align: peak 2.1, the real measured worst case.
    const n = 512;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = 0.71 * Math.cos(i * 0.1) + 0.56 * Math.cos(i * 0.1) + 0.45 * Math.cos(i * 0.1) + 0.4 * Math.cos(i * 0.31);
      im[i] = 0.71 * Math.sin(i * 0.1) + 0.56 * Math.sin(i * 0.1) + 0.45 * Math.sin(i * 0.1);
    }
    expect(Math.max(...re)).toBeGreaterThan(1.9);
    expect(clipFraction(re, im, n, 1)).toBeGreaterThan(0.2); // unscaled, it would clip hard
    expect(clipFraction(re, im, n)).toBe(0); // at ENCODE_SCALE nothing clips
    for (const dt of ['cu8', 'ci16_le'] as CaptureDatatype[]) {
      const d = decodeSamples(encodeSamples(re, im, dt), dt);
      // Linear everywhere, including at the peak — no flat tops.
      const k = Math.max(...re) * ENCODE_SCALE;
      expect(Math.abs(Math.max(...d.re) - k)).toBeLessThan(tol[dt] * 2);
    }
  });

  it('decodes a chunk from an offset and clamps count to what is there', () => {
    const { re, im } = tone(64);
    const buf = encodeSamples(re, im, 'ci16_le', 1); // unscaled: this test is about offsets, not headroom
    const d = decodeSamples(buf, 'ci16_le', 10 * 4, 1000);
    expect(d.re.length).toBe(54);
    expect(Math.abs(d.re[0] - re[10])).toBeLessThan(1e-4);
  });

  it('cu8 silence decodes to zero, not a DC spike', () => {
    const buf = new Uint8Array([128, 128, 127, 127, 128, 127]).buffer;
    const d = decodeSamples(buf, 'cu8');
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(d.re[i])).toBeLessThan(0.005);
      expect(Math.abs(d.im[i])).toBeLessThan(0.005);
    }
  });

  it('guesses the datatype from common extensions', () => {
    expect(datatypeFromName('fm_band.cf32')).toBe('cf32_le');
    expect(datatypeFromName('hackrf.cs16')).toBe('ci16_le');
    expect(datatypeFromName('rtl.cu8')).toBe('cu8');
    expect(datatypeFromName('mystery.sigmf-data')).toBeNull();
  });
});

describe('parseSigMFMeta', () => {
  it('reads rate, datatype and centre frequency from a standard file', () => {
    const m = parseSigMFMeta(
      JSON.stringify({
        global: { 'core:datatype': 'cf32_le', 'core:sample_rate': 2400000, 'core:description': 'FM band' },
        captures: [{ 'core:sample_start': 0, 'core:frequency': 98500000 }],
      }),
    );
    expect(m).toEqual({ sampleRate: 2400000, datatype: 'cf32_le', centerFreqHz: 98500000, description: 'FM band' });
  });

  it('maps datatype variants and tolerates a missing frequency', () => {
    expect(parseSigMFMeta(JSON.stringify({ global: { 'core:datatype': 'cu8', 'core:sample_rate': 2048000 } }))).toEqual({
      sampleRate: 2048000,
      datatype: 'cu8',
      centerFreqHz: 0,
      description: undefined,
    });
    expect(parseSigMFMeta(JSON.stringify({ global: { 'core:datatype': 'ci16_le', 'core:sample_rate': 8e6 } }))?.datatype).toBe(
      'ci16_le',
    );
  });

  it('refuses what cannot be played', () => {
    expect(parseSigMFMeta('not json')).toBeNull();
    expect(parseSigMFMeta(JSON.stringify({ global: { 'core:datatype': 'cf32_le' } }))).toBeNull();
    expect(parseSigMFMeta(JSON.stringify({ global: { 'core:datatype': 'cf64_le', 'core:sample_rate': 1e6 } }))).toBeNull();
  });
});
