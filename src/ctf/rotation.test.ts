import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { MorseDecoder } from '../sim/morse';
import { CwKeyer } from '../dsp/cwKeyer';
import { NCDXF_BEACONS, SLOT_MS, activeBeacon } from '../sim/ncdxf';
import { challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';

const SR = 1_152_000;
const BLOCK = 16384;
const clean = (s: string) => s.replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Catch the Rotation asks for the beacon that follows W6WX. The existing
 * NCDXF decode test proves the FIRST beacon copies from power-on; this flag
 * needs a callsign copied across a slot handoff — the 0.55 s gap and a fresh
 * station keying mid-stream — so that is what gets run through the receiver.
 * The expected answer is derived from the published roster, not typed in: if
 * the roster ever changes, the stored hash goes stale and this says so.
 */
describe('Catch the Rotation', () => {
  const c = challengeById('catch-the-rotation')!;
  const spec = toSceneSpec(c);
  const beacon = spec.emitters.find((e) => e.ncdxfBand !== undefined)!;
  const tune = beacon.freqHz - spec.centerFreqHz;

  // Band 0: beacon index == slot index. Pin the clock 1 s into W6WX's slot so
  // a 20 s run spans the rest of W6WX and all of the next beacon.
  const w6wx = NCDXF_BEACONS.findIndex((b) => b.call === 'W6WX');
  const next = NCDXF_BEACONS[(w6wx + 1) % NCDXF_BEACONS.length].call;
  const cycleMs = SLOT_MS * NCDXF_BEACONS.length;
  const T0 = Math.floor(1_760_000_000_000 / cycleMs) * cycleMs + w6wx * SLOT_MS + 1000;
  beforeEach(() => vi.useFakeTimers({ now: T0 }));
  afterEach(() => vi.useRealTimers());

  it('is pinned onto W6WX, and the stored flag is the roster entry after it', async () => {
    expect(activeBeacon(beacon.ncdxfBand!, T0).call).toBe('W6WX');
    expect(await checkFlag(c.id, next), `hash is stale: roster says ${next} follows W6WX`).toBe(true);
    expect(await checkFlag(c.id, 'W6WX')).toBe(false);
  });

  it('copies W6WX and then the next beacon across the handoff', () => {
    const scene = new Scene({ sampleRate: SR, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma });
    for (const e of spec.emitters) scene.add(e);
    const rx = new Receiver(SR);
    rx.setMode('cw');
    rx.setBandwidth(500);
    rx.setTuning(tune);
    rx.setSquelch(c.startSquelchDb ?? -80);
    const re = new Float32Array(BLOCK);
    const im = new Float32Array(BLOCK);
    const audio = new Float32Array(4096);
    const dec = new MorseDecoder();
    const keyer = new CwKeyer((on, d) => dec.push(on, d));
    for (let b = 0, n = Math.round((20 * SR) / BLOCK); b < n; b++) {
      scene.generate(re, im, BLOCK);
      keyer.process(audio, rx.process(re, im, BLOCK, audio));
    }
    const text = clean(dec.output);
    const atW = text.indexOf('W6WX');
    const atNext = text.indexOf(next, atW + 4);
    expect(atW, `W6WX not copied: "${text}"`).toBeGreaterThanOrEqual(0);
    expect(atNext, `${next} not copied after W6WX: "${text}"`).toBeGreaterThan(atW);
  });
});
