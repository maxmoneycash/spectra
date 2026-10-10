import { describe, it, expect } from 'vitest';
import { lessonById } from './lessons';
import { detectScene, syntheticBank, nearestTrack } from '../test/detectHarness';

/**
 * The chirp lesson's premise through the worker's chain: tap the ramps and
 * the card reads the sweep. Its node runs SF10 at 125 kHz — slow, long-range,
 * and well inside what the analyzer can time.
 *
 * Measured first with SF7 (2026-10-09): no reading at all. SF7 at 125 kHz
 * sweeps 87% of the band inside one 0.9 ms sub-frame, so each sub-spectrum
 * is a smear with no peak to follow — there is no sawtooth to alias, whatever
 * the synthetic sequences in chirp.test.ts suggested. At 125 kHz the
 * analyzer's reach is SF8 and slower.
 */
const lesson = lessonById('chirp')!;
const MHZ = 1e6;

describe('chirp lesson: the card reads SF10 / 125 kHz off the ramps', () => {
  const r = detectScene({ spec: lesson.scene, sec: 30, bank: syntheticBank() });
  const t = nearestTrack(r.everSeen, 915.4 * MHZ);

  it('finds the chirper and reads its sweep', () => {
    expect(t).not.toBeNull();
    expect(t!.chirp).toBeDefined();
    expect(t!.chirp?.bwHz).toBe(125_000);
    expect(t!.chirp?.sf).toBe(10);
  });

  it('names it LoRa first', () => {
    expect(t!.candidates[0]?.kind).toBe('lora');
  });

  it('does not read a chirp off the narrow clutter', () => {
    for (const x of r.everSeen) if (x.bandwidthHz < 40_000) expect(x.chirp).toBeUndefined();
  });
});
