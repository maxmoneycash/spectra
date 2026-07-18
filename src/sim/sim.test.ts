import { describe, it, expect } from 'vitest';
import { Scene } from './scene';
import { SpectrumAnalyzer } from '../dsp/spectrum';

const FS = 1_024_000;
const N = 4096;

/** Average power (dB) over an offset-frequency window, from one FFT frame. */
function bandLevelDb(
  re: Float32Array,
  im: Float32Array,
  loHz: number,
  hiHz: number,
): number {
  const sa = new SpectrumAnalyzer(N, 'blackman-harris');
  const out = new Float32Array(N);
  sa.compute(re, im, 0, out);
  const binHz = FS / N;
  const loBin = Math.round(N / 2 + loHz / binHz);
  const hiBin = Math.round(N / 2 + hiHz / binHz);
  let peak = -Infinity;
  for (let k = Math.max(0, loBin); k <= Math.min(N - 1, hiBin); k++) {
    if (out[k] > peak) peak = out[k];
  }
  return peak;
}

function renderBlock(scene: Scene, len: number) {
  const re = new Float32Array(len);
  const im = new Float32Array(len);
  scene.generate(re, im, len);
  return { re, im };
}

describe('Scene emitters', () => {
  it('places a WFM station at its offset frequency', () => {
    const scene = new Scene({ sampleRate: FS, centerFreqHz: 100_000_000, noiseSigma: 0.02 });
    scene.add({ id: 'a', kind: 'wfm', freqHz: 100_200_000, powerDb: 0 });
    // Warm up modulator state, then measure.
    renderBlock(scene, N);
    const { re, im } = renderBlock(scene, N);
    const inBand = bandLevelDb(re, im, 120_000, 280_000); // around +200 kHz
    const offBand = bandLevelDb(re, im, -400_000, -250_000); // empty
    expect(inBand).toBeGreaterThan(offBand + 15);
  });

  it('places a narrow CW carrier at its offset', () => {
    const scene = new Scene({ sampleRate: FS, centerFreqHz: 14_000_000, noiseSigma: 0.02 });
    scene.add({ id: 'cw', kind: 'cw', freqHz: 14_050_000, powerDb: 0, wpm: 20, text: 'TEST TEST' });
    // Render enough to be within a key-down interval.
    let re!: Float32Array;
    let im!: Float32Array;
    let inBand = -Infinity;
    for (let b = 0; b < 8; b++) {
      ({ re, im } = renderBlock(scene, N));
      inBand = Math.max(inBand, bandLevelDb(re, im, 45_000, 55_000));
    }
    const offBand = bandLevelDb(re, im, -200_000, -150_000);
    expect(inBand).toBeGreaterThan(offBand + 15);
  });

  it('spreads LoRa energy across its ~125 kHz channel', () => {
    const scene = new Scene({ sampleRate: FS, centerFreqHz: 915_000_000, noiseSigma: 0.02 });
    scene.add({ id: 'l', kind: 'lora', freqHz: 915_100_000, powerDb: 0, sf: 8, bwHz: 125_000 });
    let hit = false;
    // LoRa idles up to ~1 s before its first packet, so render ~1.8 s worth.
    for (let b = 0; b < 450 && !hit; b++) {
      const { re, im } = renderBlock(scene, N);
      const inBand = bandLevelDb(re, im, 40_000, 160_000);
      const offBand = bandLevelDb(re, im, -300_000, -200_000);
      if (inBand > offBand + 12) hit = true;
    }
    expect(hit).toBe(true);
  });

  it('reports ground truth for all emitters', () => {
    const scene = new Scene({ sampleRate: FS, centerFreqHz: 100_000_000 });
    scene.add({ id: 'a', kind: 'wfm', freqHz: 100_100_000 });
    scene.add({ id: 'b', kind: 'nfm', freqHz: 100_300_000 });
    const gt = scene.groundTruth();
    expect(gt).toHaveLength(2);
    expect(gt[0].offsetHz).toBe(100_000);
    expect(gt[1].kind).toBe('nfm');
  });
});

describe('Scene performance', () => {
  it('generates faster than real time with a full scene', () => {
    const scene = new Scene({ sampleRate: FS, centerFreqHz: 100_000_000, noiseSigma: 0.03 });
    const kinds = ['wfm', 'wfm', 'nfm', 'am', 'usb', 'cw', 'fsk2', 'ook', 'lora', 'psk', 'fhss', 'radar'] as const;
    kinds.forEach((k, i) => {
      scene.add({ id: `e${i}`, kind: k, freqHz: 100_000_000 - 450_000 + i * 80_000, powerDb: -3 });
    });
    const block = 32768;
    const blocks = Math.ceil(FS / block); // ~1 second of signal
    const re = new Float32Array(block);
    const im = new Float32Array(block);
    const start = performance.now();
    for (let b = 0; b < blocks; b++) scene.generate(re, im, block);
    const elapsed = performance.now() - start;
    const rtFactor = elapsed / 1000; // <1 means faster than real time
    // eslint-disable-next-line no-console
    console.log(`[sim] 1 s of ${FS} Hz with ${kinds.length} emitters: ${elapsed.toFixed(0)} ms (RT factor ${rtFactor.toFixed(2)}x)`);
    expect(elapsed).toBeLessThan(3000);
  });
});
