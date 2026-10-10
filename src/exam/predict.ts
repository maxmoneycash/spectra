/**
 * Predicted exam score from spaced-repetition state.
 *
 * A VE session draws one question at random from each question group, so
 * the expected score is the sum over groups of the mean P(correct) of that
 * group's questions. P(correct) comes from the Leitner box: an unseen
 * question is a guess among four choices; a box-4 question is near certain.
 * Group draws are independent, so the variance is the sum of Bernoulli
 * variances and a ±1.28 σ band is roughly the 10th–90th percentile.
 */
import { groupOf } from './types';

export const P_UNSEEN = 0.25;
/** Index = Leitner box 0–4, for questions that have been answered at least once. */
export const P_BY_BOX = [0.35, 0.55, 0.75, 0.9, 0.97] as const;

export interface ProgressLike {
  box: number;
  seen: number;
}

export interface Prediction {
  /** Expected correct answers, unrounded. */
  expected: number;
  /** Rounded for display. */
  predicted: number;
  low: number;
  high: number;
  total: number;
  passing: number;
  /** Question groups seen in `ids` (equals `total` for every current pool). */
  groups: number;
}

export function pCorrect(p: ProgressLike | undefined): number {
  if (!p || p.seen === 0) return P_UNSEEN;
  return P_BY_BOX[Math.max(0, Math.min(4, p.box))];
}

export function predictScore(
  ids: readonly string[],
  progress: Record<string, ProgressLike | undefined>,
  meta: { examQuestions: number; passing: number },
): Prediction {
  const groups = new Map<string, number[]>();
  for (const id of ids) {
    const g = groupOf(id);
    const arr = groups.get(g);
    const p = pCorrect(progress[id]);
    if (arr) arr.push(p);
    else groups.set(g, [p]);
  }
  let mean = 0;
  let variance = 0;
  for (const arr of groups.values()) {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    mean += m;
    variance += m * (1 - m);
  }
  // Every current pool has exactly one group per exam question; scale if a
  // future pool doesn't, treating the draw as `examQuestions` of the mean group.
  const scale = groups.size ? meta.examQuestions / groups.size : 0;
  const expected = mean * scale;
  const sd = Math.sqrt(variance * scale);
  const clip = (x: number) => Math.max(0, Math.min(meta.examQuestions, Math.round(x)));
  return {
    expected,
    predicted: clip(expected),
    low: clip(expected - 1.28 * sd),
    high: clip(expected + 1.28 * sd),
    total: meta.examQuestions,
    passing: meta.passing,
    groups: groups.size,
  };
}
