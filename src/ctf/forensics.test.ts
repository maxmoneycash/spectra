/**
 * Forensics missions are rendered from their emitters and played back as a
 * file. The content is the scene, so solvability is proved on the scene:
 * run each mission's RF through the real detector / decoder for its loop
 * length and submit what an operator would read off the screen.
 */
import { describe, expect, it } from 'vitest';
import { CHALLENGES, challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';
import { detectScene, distinctEmitters, nearestTrack, syntheticBank } from '../test/detectHarness';
import { copyCw } from '../test/cwHarness';

const forensics = CHALLENGES.filter((c) => c.category === 'forensics');

describe('forensics missions', () => {
  it('each ships a capture spec and a deterministic seed', () => {
    expect(forensics.length).toBeGreaterThanOrEqual(3);
    for (const c of forensics) {
      expect(c.capture, c.id).toBeDefined();
      expect(c.capture!.seconds).toBeGreaterThanOrEqual(10);
      expect(Number.isInteger(c.capture!.seed)).toBe(true);
    }
  });

  it('Cold Case: the detector sees exactly three distinct emitters over one loop', async () => {
    const c = challengeById('cold-case')!;
    const r = detectScene({ spec: toSceneSpec(c), sec: c.capture!.seconds, bank: syntheticBank() });
    const n = distinctEmitters(r.everSeen).length;
    expect(n).toBe(3);
    expect(await checkFlag(c.id, String(n))).toBe(true);
    expect(await checkFlag(c.id, '2')).toBe(false);
  }, 120_000);

  it('The Callsign: the lower beacon copies as K6XYZ in CW', async () => {
    const c = challengeById('the-callsign')!;
    const r = copyCw({ spec: toSceneSpec(c), tuneHz: 7_000_000, sec: 20 });
    expect(r.text).toContain('K6XYZ');
    expect(await checkFlag(c.id, 'K6XYZ')).toBe(true);
    expect(await checkFlag(c.id, 'k6 xyz')).toBe(true); // spacing forgiven
  }, 120_000);

  it('Repeater Pair: the input carrier is found 600 kHz below the output', async () => {
    const c = challengeById('repeater-pair')!;
    const r = detectScene({ spec: toSceneSpec(c), sec: c.capture!.seconds, bank: syntheticBank() });
    const out = nearestTrack(r.everSeen, 146_940_000);
    const inp = nearestTrack(r.everSeen, 146_340_000);
    expect(out).not.toBeNull();
    expect(inp).not.toBeNull();
    const inHz = c.centerFreqHz + inp!.offsetHz;
    expect(Math.abs(inHz - 146_340_000)).toBeLessThan(5_000);
    expect(await checkFlag(c.id, (Math.round(inHz / 1000) / 1000).toFixed(3))).toBe(true);
  }, 120_000);
});
