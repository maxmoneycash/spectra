import { describe, it, expect } from 'vitest';
import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { MorseDecoder } from '../sim/morse';
import { AUDIO_RATE } from '../dsp/receiver';

/**
 * End-to-end CW decode: scene (CW emitter) -> receiver (CW mode) -> the
 * worker's envelope decoder -> MorseDecoder. Guards the decode chain.
 */
describe('morse decode chain', () => {
  it('copies a beacon callsign', () => {
    const scene = new Scene({ sampleRate: 1_152_000, centerFreqHz: 7.05e6, noiseSigma: 0.02 });
    scene.add({ id: 'b1', kind: 'cw', freqHz: 7.06e6, powerDb: -4, wpm: 18, text: 'CQ CQ DE SPECTRA SPECTRA K', seed: 3 });
    const rx = new Receiver(1_152_000);
    rx.setMode('cw');
    rx.setBandwidth(500);
    rx.setTuning(10_000);
    rx.setSquelch(-120);
    const bandRe = new Float32Array(16384);
    const bandIm = new Float32Array(16384);
    const audio = new Float32Array(4096);
    const dec = new MorseDecoder();
    let env = 0;
    let peak = 0.01;
    let state = false;
    let samples = 0;
    const cwAlpha = 1 - Math.exp(-1 / (0.003 * AUDIO_RATE));
    for (let b = 0; b < 900; b++) {
      scene.generate(bandRe, bandIm, 16384);
      const n = rx.process(bandRe, bandIm, 16384, audio);
      for (let i = 0; i < n; i++) {
        const a = Math.abs(audio[i]);
        env += cwAlpha * (a - env);
        peak = Math.max(peak * 0.99995, env);
        const on = env > peak * 0.35;
        if (on !== state) {
          const dur = samples / AUDIO_RATE;
          if (dur > 0.01) dec.push(state, dur);
          state = on;
          samples = 0;
        } else {
          samples++;
        }
      }
    }
    console.log('decoded:', JSON.stringify(dec.output));
    expect(dec.output).toContain('SPECTRA');
  });
});
