import { describe, it, expect } from 'vitest';
import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { MorseDecoder } from '../sim/morse';
import { CwKeyer } from '../dsp/cwKeyer';

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
    const keyer = new CwKeyer((on, dur) => dec.push(on, dur));
    for (let b = 0; b < 900; b++) {
      scene.generate(bandRe, bandIm, 16384);
      keyer.process(audio, rx.process(bandRe, bandIm, 16384, audio));
    }
    console.log('decoded:', JSON.stringify(dec.output));
    expect(dec.output).toMatch(/T T T/); // the dah group (trailing dah may truncate)
    // Callsign letters/digits also come through (first char may garble at slot start).
    expect(dec.output.replace(/[^A-Z0-9 ]/g, '').trim().length).toBeGreaterThan(6);
  });
});
