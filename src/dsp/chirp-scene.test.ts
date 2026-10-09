import { describe, it, expect } from 'vitest';
import { scenarioById, toSceneSpec } from '../scenarios/scenarios';
import { challengeById, toSceneSpec as challengeSpec } from '../ctf/challenges';
import { detectScene, syntheticBank, nearestTrack } from '../test/detectHarness';

/**
 * The chirp analyzer on real scenes, through the worker's chain. The positive
 * cases — the two LoRa challenges read SF8 / 125 kHz and name LoRa first — are
 * pinned in ctf/recon.test.ts and guide/identify-lesson.test.ts. These are
 * the negatives: the other wide signals in the simulator must NOT chirp, or
 * the feature would just be a new way to mislabel them.
 */
const MHZ = 1e6;
const bank = syntheticBank();

describe('chirp analyzer: only the chirper chirps', () => {
  it('does not flag a tone-modulated broadcast FM station — its deviation is a sinusoid, not a sawtooth', () => {
    const r = detectScene({ spec: toSceneSpec(scenarioById('drone-hunt')!), sec: 20, bank });
    const wfm = nearestTrack(r.everSeen.filter((t) => !t.hopping), 2439.7 * MHZ);
    expect(wfm).not.toBeNull();
    expect(wfm!.chirp).toBeUndefined();
  });

  it('does not flag a PSK burst of the same width as a chirp', () => {
    const r = detectScene({ spec: challengeSpec(challengeById('hopper')!), sec: 20, bank });
    const psk = nearestTrack(r.everSeen.filter((t) => !t.hopping), 2440.3 * MHZ);
    expect(psk).not.toBeNull();
    expect(psk!.chirp).toBeUndefined();
  });

  it('does not flag anything on a band of voice stations', () => {
    const r = detectScene({ spec: challengeSpec(challengeById('first-light')!), sec: 15, bank });
    expect(r.everSeen.length).toBeGreaterThan(0);
    expect(r.everSeen.every((t) => !t.chirp)).toBe(true);
  });
});
