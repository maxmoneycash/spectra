import type { GroundTruth, TrackMsg } from '../engine/protocol';
import type { DemodMode, SignalKind } from '../sim/signal-kinds';
import type { Objective, Scenario } from './scenarios';

/** Nearest true emitter to a detection, within a frequency tolerance. */
export function nearestGroundTruth(
  centerFreqHz: number,
  bandwidthHz: number,
  gt: GroundTruth[],
): GroundTruth | null {
  const tol = Math.max(bandwidthHz, 25_000);
  let best: GroundTruth | null = null;
  let bestDist = Infinity;
  for (const g of gt) {
    const dist = Math.abs(g.freqHz - centerFreqHz);
    if (dist < tol && dist < bestDist) {
      bestDist = dist;
      best = g;
    }
  }
  return best;
}

export interface IdResult {
  correct: boolean;
  actualKind: SignalKind | null;
  actualLabel: string | null;
}

/** Grade a user's identification of a track against ground truth. */
export function scoreIdentification(
  track: TrackMsg,
  guessKind: SignalKind,
  gt: GroundTruth[],
): IdResult {
  const truth = nearestGroundTruth(track.centerFreqHz, track.bandwidthHz, gt);
  if (!truth) return { correct: false, actualKind: null, actualLabel: null };
  return {
    correct: truth.kind === guessKind,
    actualKind: truth.kind,
    actualLabel: truth.label,
  };
}

export interface ScoringContext {
  tracks: TrackMsg[];
  tuningOffsetHz: number;
  mode: DemodMode;
  morseText: string;
  correctlyIdentified: Set<SignalKind>;
}

export function objectiveDone(obj: Objective, ctx: ScoringContext): boolean {
  switch (obj.type) {
    case 'count':
      return ctx.tracks.length >= obj.count;
    case 'identify':
      return ctx.correctlyIdentified.has(obj.kind);
    case 'tune':
      return Math.abs(ctx.tuningOffsetHz - obj.offsetHz) <= obj.tolHz && ctx.mode === obj.mode;
    case 'decode':
      return ctx.morseText.toUpperCase().includes(obj.text.toUpperCase());
  }
}

export function evaluateObjectives(scenario: Scenario, ctx: ScoringContext): boolean[] {
  return scenario.objectives.map((o) => objectiveDone(o, ctx));
}
