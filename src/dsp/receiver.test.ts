import { describe, it, expect } from 'vitest';
import { Receiver, AUDIO_RATE } from './receiver';
import { FFT } from './fft';
import { makeWindow } from './window';
import type { DemodMode } from '../sim/signal-kinds';

const FS = 1_152_000;
const BLOCK = 24576; // multiple of 24

/** Generate one block of a synthetic signal at RF offset `offsetHz`. */
function genFM(offsetHz: number, toneHz: number, devHz: number, t0: number) {
  const re = new Float32Array(BLOCK);
  const im = new Float32Array(BLOCK);
  const beta = devHz / toneHz;
  for (let i = 0; i < BLOCK; i++) {
    const t = (t0 + i) / FS;
    const ph = 2 * Math.PI * offsetHz * t + beta * Math.sin(2 * Math.PI * toneHz * t);
    re[i] = Math.cos(ph);
    im[i] = Math.sin(ph);
  }
  return { re, im };
}

function genAM(offsetHz: number, toneHz: number, t0: number) {
  const re = new Float32Array(BLOCK);
  const im = new Float32Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    const t = (t0 + i) / FS;
    const env = 1 + 0.6 * Math.sin(2 * Math.PI * toneHz * t);
    const ph = 2 * Math.PI * offsetHz * t;
    re[i] = env * Math.cos(ph);
    im[i] = env * Math.sin(ph);
  }
  return { re, im };
}

/** Single complex exponential — an SSB tone lives at carrier ± audio. */
function genComplexTone(freqHz: number, t0: number) {
  const re = new Float32Array(BLOCK);
  const im = new Float32Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    const t = (t0 + i) / FS;
    const ph = 2 * Math.PI * freqHz * t;
    re[i] = Math.cos(ph);
    im[i] = Math.sin(ph);
  }
  return { re, im };
}

function peakAudioFreq(audio: Float32Array): { freq: number; mag: number } {
  const N = 4096;
  const w = makeWindow('hann', N);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < N; i++) re[i] = audio[i] * w[i];
  new FFT(N).forward(re, im);
  let best = 0;
  let bestMag = -1;
  for (let k = 1; k < N / 2; k++) {
    const m = re[k] * re[k] + im[k] * im[k];
    if (m > bestMag) {
      bestMag = m;
      best = k;
    }
  }
  return { freq: (best / N) * AUDIO_RATE, mag: Math.sqrt(bestMag) };
}

/** Run a generator through the receiver and collect 4096 audio samples. */
function receive(
  mode: DemodMode,
  offsetHz: number,
  bandwidthHz: number,
  gen: (t0: number) => { re: Float32Array; im: Float32Array },
): Float32Array {
  const rx = new Receiver(FS, BLOCK);
  rx.setMode(mode);
  rx.setBandwidth(bandwidthHz);
  rx.setTuning(offsetHz);
  const audio = new Float32Array(8192);
  let filled = 0;
  const out = new Float32Array(BLOCK);
  let t0 = 0;
  let blocks = 0;
  while (filled < 4096 && blocks < 40) {
    const { re, im } = gen(t0);
    const c = rx.process(re, im, BLOCK, out);
    if (blocks >= 8) {
      // skip warm-up
      for (let i = 0; i < c && filled < audio.length; i++) audio[filled++] = out[i];
    }
    t0 += BLOCK;
    blocks++;
  }
  return audio.subarray(0, 4096);
}

describe('Receiver demodulation', () => {
  it('recovers a 1 kHz tone from NFM', () => {
    const audio = receive('nfm', 120_000, 12_000, (t0) => genFM(120_000, 1000, 3000, t0));
    const { freq } = peakAudioFreq(audio);
    expect(freq).toBeGreaterThan(850);
    expect(freq).toBeLessThan(1150);
  });

  it('recovers a 1 kHz tone from WFM', () => {
    const audio = receive('wfm', -200_000, 180_000, (t0) => genFM(-200_000, 1000, 50_000, t0));
    const { freq } = peakAudioFreq(audio);
    expect(freq).toBeGreaterThan(850);
    expect(freq).toBeLessThan(1150);
  });

  it('recovers a 1 kHz tone from AM', () => {
    const audio = receive('am', 80_000, 8000, (t0) => genAM(80_000, 1000, t0));
    const { freq } = peakAudioFreq(audio);
    expect(freq).toBeGreaterThan(850);
    expect(freq).toBeLessThan(1150);
  });

  it('recovers USB and rejects it when set to LSB', () => {
    // USB signal: carrier at 50 kHz, 1 kHz audio -> tone at 51 kHz.
    const good = receive('usb', 50_000, 2700, (t0) => genComplexTone(51_000, t0));
    const gp = peakAudioFreq(good);
    expect(gp.freq).toBeGreaterThan(800);
    expect(gp.freq).toBeLessThan(1200);

    // Same signal demodulated as LSB should be strongly attenuated.
    const wrong = receive('lsb', 50_000, 2700, (t0) => genComplexTone(51_000, t0));
    const wp = peakAudioFreq(wrong);
    expect(wp.mag).toBeLessThan(gp.mag * 0.5);
  });
});
