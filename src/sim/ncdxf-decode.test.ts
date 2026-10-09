import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { MorseDecoder } from '../sim/morse';
import { CwKeyer } from '../dsp/cwKeyer';
import { activeBeacon, SLOT_MS } from './ncdxf';

/**
 * End-to-end NCDXF beacon decode: self-rotating emitter -> CW receiver ->
 * the worker's envelope decoder. Guards the rotation + decode chain.
 */
describe('ncdxf decode chain', () => {
  // The emitter anchors its rotation to Date.now() at construction. Pin the
  // clock 1 s into a slot so the test always starts on the same beacon with
  // 9 s of it ahead — unpinned, it read whatever the wall clock said.
  const T0 = Math.floor(1_760_000_000_000 / SLOT_MS) * SLOT_MS + 1000;
  beforeEach(() => vi.useFakeTimers({ now: T0 }));
  afterEach(() => vi.useRealTimers());

  it('copies the first beacon exactly from power-on', () => {
    const want = activeBeacon(0, T0);
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
    // 8.5 s: the whole first beacon, ending before the slot hands off.
    for (let b = 0; b < 598; b++) {
      scene.generate(bandRe, bandIm, 16384);
      keyer.process(audio, rx.process(bandRe, bandIm, 16384, audio));
    }
    const got = dec.output.replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    // The first callsign used to garble almost every time: the keyer's
    // threshold decayed into the noise during the inter-slot silence and the
    // chatter fused with the first dot. Now it must copy exactly.
    expect(got.startsWith(want.call)).toBe(true);
    expect(got).toContain('T T T T');
    expect(got).toContain(want.grid);
  });
});
