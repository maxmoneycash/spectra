import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { NCDXF_BEACONS, SLOT_MS, activeBeacon } from '../sim/ncdxf';
import { challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';
import { copyCw } from '../test/cwHarness';

/**
 * Catch the Rotation asks for the beacon that follows W6WX. The NCDXF decode
 * test proves the FIRST beacon copies from power-on; this flag needs a
 * callsign copied across a slot handoff — the 0.55 s gap and a fresh station
 * keying mid-stream — so that is what gets run through the receiver. The
 * expected answer is derived from the published roster, not typed in: if the
 * roster ever changes, the stored hash goes stale and this says so.
 */
describe('Catch the Rotation', () => {
  const c = challengeById('catch-the-rotation')!;
  const spec = toSceneSpec(c);
  const beacon = spec.emitters.find((e) => e.ncdxfBand !== undefined)!;

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
    // The emitter anchors its rotation to Date.now() when the scene is built,
    // which happens inside copyCw while the fake clock is in effect.
    const { text } = copyCw({ spec, tuneHz: beacon.freqHz, squelchDb: c.startSquelchDb, sec: 20 });
    const atW = text.indexOf('W6WX');
    const atNext = text.indexOf(next, atW + 4);
    expect(atW, `W6WX not copied: "${text}"`).toBeGreaterThanOrEqual(0);
    expect(atNext, `${next} not copied after W6WX: "${text}"`).toBeGreaterThan(atW);
  });
});
