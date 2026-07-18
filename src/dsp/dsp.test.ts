import { describe, it, expect } from 'vitest';
import { FFT } from './fft';
import { makeWindow } from './window';
import { designLowpass, ComplexFIR } from './fir';
import { ComplexOsc } from './oscillator';
import { FIRDecimator } from './decimator';
import { SpectrumAnalyzer } from './spectrum';

/** Reference (naive, O(N^2)) DFT for correctness checks. */
function dft(re: Float32Array, im: Float32Array) {
  const N = re.length;
  const outRe = new Float64Array(N);
  const outIm = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    let sr = 0;
    let si = 0;
    for (let n = 0; n < N; n++) {
      const ang = (-2 * Math.PI * k * n) / N;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      sr += re[n] * c - im[n] * s;
      si += re[n] * s + im[n] * c;
    }
    outRe[k] = sr;
    outIm[k] = si;
  }
  return { outRe, outIm };
}

function peakBin(re: Float32Array, im: Float32Array): number {
  let best = 0;
  let bestMag = -1;
  for (let i = 0; i < re.length; i++) {
    const m = re[i] * re[i] + im[i] * im[i];
    if (m > bestMag) {
      bestMag = m;
      best = i;
    }
  }
  return best;
}

describe('FFT', () => {
  it('matches a naive DFT on random input', () => {
    const N = 64;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff - 0.5;
    };
    for (let i = 0; i < N; i++) {
      re[i] = rand();
      im[i] = rand();
    }
    const ref = dft(re.slice(), im.slice());
    const fft = new FFT(N);
    fft.forward(re, im);
    for (let k = 0; k < N; k++) {
      expect(re[k]).toBeCloseTo(ref.outRe[k], 3);
      expect(im[k]).toBeCloseTo(ref.outIm[k], 3);
    }
  });

  it('places a complex sinusoid in the correct bin', () => {
    const N = 256;
    const bin = 40;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const ph = (2 * Math.PI * bin * n) / N;
      re[n] = Math.cos(ph);
      im[n] = Math.sin(ph);
    }
    new FFT(N).forward(re, im);
    expect(peakBin(re, im)).toBe(bin);
  });

  it('round-trips through inverse', () => {
    const N = 128;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      re[i] = Math.sin(i * 0.3);
      im[i] = Math.cos(i * 0.11);
    }
    const re0 = re.slice();
    const im0 = im.slice();
    const fft = new FFT(N);
    fft.forward(re, im);
    fft.inverse(re, im);
    for (let i = 0; i < N; i++) {
      expect(re[i]).toBeCloseTo(re0[i], 4);
      expect(im[i]).toBeCloseTo(im0[i], 4);
    }
  });

  it('rejects non-power-of-two sizes', () => {
    expect(() => new FFT(48)).toThrow();
  });
});

describe('windows', () => {
  it('hann tapers to zero at the edges', () => {
    const w = makeWindow('hann', 32);
    expect(w[0]).toBeCloseTo(0, 5);
    expect(w[31]).toBeCloseTo(0, 5);
    expect(w[16]).toBeGreaterThan(0.9);
  });
});

describe('FIR lowpass', () => {
  it('has unity DC gain (taps sum to 1)', () => {
    const taps = designLowpass(65, 0.1);
    let sum = 0;
    for (const t of taps) sum += t;
    expect(sum).toBeCloseTo(1, 5);
  });

  it('is symmetric (linear phase)', () => {
    const taps = designLowpass(65, 0.15);
    for (let i = 0; i < taps.length; i++) {
      expect(taps[i]).toBeCloseTo(taps[taps.length - 1 - i], 6);
    }
  });

  it('passes DC and attenuates a high tone', () => {
    const taps = designLowpass(129, 0.05);
    const fir = new ComplexFIR(taps);
    const N = 4096;
    const inRe = new Float32Array(N).fill(1); // DC
    const inIm = new Float32Array(N);
    const outRe = new Float32Array(N);
    const outIm = new Float32Array(N);
    fir.process(inRe, inIm, outRe, outIm);
    expect(outRe[N - 1]).toBeCloseTo(1, 2); // DC passes at unity

    // High-frequency complex tone (0.4 of Fs) should be strongly attenuated.
    const hiRe = new Float32Array(N);
    const hiIm = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const ph = 2 * Math.PI * 0.4 * n;
      hiRe[n] = Math.cos(ph);
      hiIm[n] = Math.sin(ph);
    }
    const hoRe = new Float32Array(N);
    const hoIm = new Float32Array(N);
    const fir2 = new ComplexFIR(taps);
    fir2.process(hiRe, hiIm, hoRe, hoIm);
    let power = 0;
    for (let n = N - 512; n < N; n++) power += hoRe[n] * hoRe[n] + hoIm[n] * hoIm[n];
    power /= 512;
    expect(power).toBeLessThan(0.01); // < -20 dB
  });
});

describe('ComplexOsc', () => {
  it('generates a unit-magnitude phasor at the requested frequency', () => {
    const N = 512;
    const fs = 48000;
    const f = 3000;
    const osc = new ComplexOsc(f, fs);
    const ones = new Float32Array(N).fill(1);
    const zeros = new Float32Array(N);
    const outRe = new Float32Array(N);
    const outIm = new Float32Array(N);
    osc.mix(ones, zeros, outRe, outIm);
    for (let i = 0; i < N; i += 37) {
      expect(Math.hypot(outRe[i], outIm[i])).toBeCloseTo(1, 3);
    }
    // Verify frequency via FFT peak.
    const re = outRe.slice(0, 512);
    const im = outIm.slice(0, 512);
    new FFT(512).forward(re, im);
    const expectedBin = Math.round((f / fs) * 512);
    expect(peakBin(re, im)).toBe(expectedBin);
  });

  it('accumulates multiple emitters additively', () => {
    const N = 1024;
    const fs = 1_000_000;
    const bandRe = new Float32Array(N);
    const bandIm = new Float32Array(N);
    const ones = new Float32Array(N).fill(1);
    const zeros = new Float32Array(N);
    new ComplexOsc(100_000, fs).mixAdd(ones, zeros, bandRe, bandIm, N, 1);
    new ComplexOsc(-250_000, fs).mixAdd(ones, zeros, bandRe, bandIm, N, 0.5);
    const re = bandRe.slice();
    const im = bandIm.slice();
    new FFT(N).forward(re, im);
    // Two distinct peaks should exist at the two emitter frequencies.
    const b1 = Math.round((100_000 / fs) * N);
    const b2 = Math.round(((fs - 250_000) / fs) * N); // negative freq wraps
    const mag = (k: number) => Math.hypot(re[k], im[k]);
    expect(mag(b1)).toBeGreaterThan(N * 0.4);
    expect(mag(b2)).toBeGreaterThan(N * 0.2);
  });
});

describe('FIRDecimator', () => {
  it('passes DC through at unity gain and outputs len/factor samples', () => {
    const taps = designLowpass(129, 0.4 / 8);
    const dec = new FIRDecimator(taps, 8);
    const N = 8192;
    const inRe = new Float32Array(N).fill(1);
    const inIm = new Float32Array(N);
    const outRe = new Float32Array(dec.maxOut(N));
    const outIm = new Float32Array(dec.maxOut(N));
    const count = dec.process(inRe, inIm, outRe, outIm);
    expect(count).toBe(N / 8);
    expect(outRe[count - 1]).toBeCloseTo(1, 2);
  });

  it('rejects a tone above the new Nyquist (anti-aliasing)', () => {
    const D = 8;
    const taps = designLowpass(129, 0.45 / D);
    const dec = new FIRDecimator(taps, D);
    const N = 8192;
    const inRe = new Float32Array(N);
    const inIm = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const ph = 2 * Math.PI * 0.25 * n; // 0.25 Fs, well above new Nyquist (0.0625)
      inRe[n] = Math.cos(ph);
      inIm[n] = Math.sin(ph);
    }
    const outRe = new Float32Array(dec.maxOut(N));
    const outIm = new Float32Array(dec.maxOut(N));
    const count = dec.process(inRe, inIm, outRe, outIm);
    let power = 0;
    for (let i = count - 100; i < count; i++) power += outRe[i] ** 2 + outIm[i] ** 2;
    power /= 100;
    expect(power).toBeLessThan(0.02);
  });
});

describe('SpectrumAnalyzer', () => {
  it('reports a full-scale tone near 0 dBFS at the right shifted bin', () => {
    const N = 1024;
    const fs = 1_000_000;
    const f = 200_000;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const ph = (2 * Math.PI * f * n) / fs;
      re[n] = Math.cos(ph);
      im[n] = Math.sin(ph);
    }
    const sa = new SpectrumAnalyzer(N, 'hann');
    const out = new Float32Array(N);
    sa.compute(re, im, 0, out);
    // Expected FFT-shifted bin: DC at N/2, +f above centre.
    const expectedBin = N / 2 + Math.round((f / fs) * N);
    let peak = 0;
    let peakVal = -Infinity;
    for (let k = 0; k < N; k++) {
      if (out[k] > peakVal) {
        peakVal = out[k];
        peak = k;
      }
    }
    expect(peak).toBe(expectedBin);
    expect(peakVal).toBeGreaterThan(-1); // ~0 dBFS for unit amplitude
    expect(peakVal).toBeLessThan(1);
  });
});
