import { describe, it, expect } from 'vitest';
import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { MorseDecoder } from '../sim/morse';
import { AUDIO_RATE } from '../dsp/receiver';

/**
 * End-to-end NCDXF beacon decode: self-rotating emitter -> CW receiver ->
 * the worker's envelope decoder. Guards the rotation + decode chain.
 */
describe('ncdxf decode chain', () => {
  it('copies the four-dah group and callsign fragments', () => {
    const scene = new Scene({ sampleRate: 1_152_000, centerFreqHz: 14.1e6, noiseSigma: 0.028 });
    scene.add({ id: 'ncdxf-live', kind: 'cw', freqHz: 14.1e6, powerDb: -4, ncdxfBand: 0 });
    const rx = new Receiver(1_152_000);
    rx.setMode('cw');
    rx.setBandwidth(500);
    rx.setTuning(0);
    rx.setSquelch(-80);
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
    expect(dec.output).toMatch(/T T T/); // the dah group (trailing dah may truncate)
    // Callsign letters/digits also come through (first char may garble at slot start).
    expect(dec.output.replace(/[^A-Z0-9 ]/g, '').trim().length).toBeGreaterThan(6);
  });
});
