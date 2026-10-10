import { describe, expect, it } from 'vitest';
import { P_BY_BOX, P_UNSEEN, pCorrect, predictScore } from './predict';

/** 35 groups × 3 questions, ids in the real pool shape (G1A01 …). */
function ids(): string[] {
  const out: string[] = [];
  for (let g = 0; g < 35; g++) {
    const sub = 1 + Math.floor(g / 5);
    const letter = String.fromCharCode(65 + (g % 5));
    for (let q = 1; q <= 3; q++) out.push(`G${sub}${letter}${String(q).padStart(2, '0')}`);
  }
  return out;
}
const META = { examQuestions: 35, passing: 26 };
const all = (box: number) => Object.fromEntries(ids().map((id) => [id, { box, seen: 1 }]));

describe('predictScore', () => {
  it('sees one group per exam question in the real id shape', () => {
    expect(predictScore(ids(), {}, META).groups).toBe(35);
  });

  it('nothing studied: chance level, one in four', () => {
    const p = predictScore(ids(), {}, META);
    expect(p.predicted).toBe(Math.round(P_UNSEEN * 35));
    expect(p.low).toBeLessThan(p.predicted);
    expect(p.high).toBeGreaterThan(p.predicted);
  });

  it('everything mastered: within one of a perfect score', () => {
    const p = predictScore(ids(), all(4), META);
    expect(p.predicted).toBeGreaterThanOrEqual(34);
    expect(p.high).toBe(35);
  });

  it('is monotone in the Leitner box', () => {
    const scores = [0, 1, 2, 3, 4].map((b) => predictScore(ids(), all(b), META).expected);
    for (let k = 1; k < scores.length; k++) expect(scores[k]).toBeGreaterThan(scores[k - 1]);
    expect(pCorrect({ box: 0, seen: 1 })).toBe(P_BY_BOX[0]);
    expect(pCorrect(undefined)).toBe(P_UNSEEN);
  });

  it('a seen-but-wrong question is worth more than an unseen one', () => {
    expect(pCorrect({ box: 0, seen: 2 })).toBeGreaterThan(pCorrect(undefined));
  });

  it('the band narrows as certainty rises', () => {
    const guess = predictScore(ids(), {}, META);
    const sure = predictScore(ids(), all(4), META);
    expect(sure.high - sure.low).toBeLessThan(guess.high - guess.low);
  });

  it('never predicts outside 0..total', () => {
    const p = predictScore(ids(), all(4), META);
    expect(p.low).toBeGreaterThanOrEqual(0);
    expect(p.high).toBeLessThanOrEqual(35);
  });
});
