import { describe, it, expect } from 'vitest';
import { detectScene, syntheticBank, nearestTrack, type Guessed } from '../test/detectHarness';
import type { SignalKind } from '../sim/signal-kinds';
import { lessonById } from './lessons';

/**
 * The identify lesson says: the Signals list shows everything the receiver
 * found, with a guess per signal; pick one, name it, and the confirmation is
 * graded against the truth. lessons.test.ts checks the step predicates with a
 * hand-written `identified: ['wfm']`, so it cannot see whether the DETECTOR
 * finds the lesson's stations or whether the CLASSIFIER offers their true
 * kind to pick. This runs the lesson's own scene through the worker's chain
 * (src/test/detectHarness.ts), including the worker's rule that a track's
 * guess is refreshed only on frames the signal is present.
 *
 * What it found (2026-10-09): the NFM repeater read as AM whenever it talked
 * (its residual carrier scored like AM's real one) and as CW whenever it
 * rested (its bandwidth had collapsed to the carrier during the hang). Both
 * are fixed in the classifier, tracker and worker; this pins the result.
 */
const lesson = lessonById('identify')!;
const spec = lesson.scene;

interface Seen {
  kind: SignalKind;
  freqHz: number;
  track: Guessed | null;
}

const result = detectScene({ spec, sec: 24, bank: syntheticBank() });
const seen: Seen[] = spec.emitters.map((e) => ({
  kind: e.kind as SignalKind,
  freqHz: e.freqHz,
  track: nearestTrack(result.tracks, e.freqHz),
}));
for (const s of seen) {
  const t = s.track;
  console.log(
    `${s.kind.padEnd(5)} @ ${(s.freqHz / 1e6).toFixed(3)} MHz → ` +
      (t
        ? `bw ${Math.round(t.bandwidthHz)} Hz duty ${t.duty.toFixed(2)} crest ${t.crestDb.toFixed(1)} dB: ` +
          t.candidates.map((c) => `${c.kind} ${(c.confidence * 100).toFixed(0)}%`).join(', ')
        : 'NOT DETECTED'),
  );
}

describe('identify lesson: the detector finds the stations and the classifier offers their names', () => {
  it('detects every station in the lesson scene', () => {
    for (const s of seen) expect(s.track, `${s.kind} at ${s.freqHz} Hz not detected`).not.toBeNull();
  });

  it('offers every station its true kind among the candidates, so naming it is a skill not a trick', () => {
    for (const s of seen) {
      const kinds = s.track?.candidates.map((c) => c.kind) ?? [];
      expect(kinds, `${s.kind}: candidates were ${kinds.join(', ')}`).toContain(s.kind);
    }
  });

  it('guesses the voice and keyed stations right outright: broadcast FM, NFM, AM and CW', () => {
    for (const kind of ['wfm', 'nfm', 'am', 'cw'] as const) {
      const s = seen.find((x) => x.kind === kind)!;
      expect(s.track?.candidates[0]?.kind, `${kind} top guess`).toBe(kind);
    }
  });

  it('keeps LoRa among the candidates (spectrum alone cannot see the chirp, a known limit)', () => {
    const l = seen.find((x) => x.kind === 'lora')!;
    expect(l.track?.candidates.some((c) => c.kind === 'lora')).toBe(true);
  });
});
