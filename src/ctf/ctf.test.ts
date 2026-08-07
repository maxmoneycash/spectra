import { describe, it, expect } from 'vitest';
import { CHALLENGES, TOTAL_POINTS } from './challenges';
import { checkFlag, normalise, score, rankFor, shareText, type Solve } from './store';

const solve = (points: number, hintsUsed = 0): Solve => ({ at: 0, points, hintsUsed });

describe('challenge set', () => {
  it('has unique ids and non-empty hashes', () => {
    const ids = CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHALLENGES) {
      expect(c.flagHash).toMatch(/^[0-9a-f]{32}$/);
      expect(c.emitters.length).toBeGreaterThan(0);
      expect(c.hints.length).toBeGreaterThan(0);
    }
  });

  it('never ships a filled-in flag in the visible copy', () => {
    // `SPECTRA{...}` is a deliberate format hint; `SPECTRA{LISTEN UP}` would
    // be handing the answer over. Only the latter should fail.
    const leaked = /spectra\{(?!\.\.\.\})/i;
    for (const c of CHALLENGES) {
      const text = `${c.brief} ${c.answerHint} ${c.hints.join(' ')}`;
      expect(leaked.test(text), `${c.id} leaks its flag`).toBe(false);
    }
  });
});

describe('flag checking', () => {
  it('accepts the right answer regardless of case and spacing', async () => {
    for (const answer of ['4', ' 4 ', '4']) {
      expect(await checkFlag('first-light', answer)).toBe(true);
    }
    expect(await checkFlag('morse-beacon', 'SPECTRA{LISTEN UP}')).toBe(true);
    expect(await checkFlag('morse-beacon', 'spectra{listen up}')).toBe(true);
    expect(await checkFlag('morse-beacon', ' Spectra{Listen  Up} ')).toBe(true);
  });

  it('rejects wrong answers and unknown challenges', async () => {
    expect(await checkFlag('first-light', '5')).toBe(false);
    expect(await checkFlag('first-light', '')).toBe(false);
    expect(await checkFlag('no-such-challenge', '4')).toBe(false);
  });

  it('normalises consistently', () => {
    expect(normalise('  Foo Bar ')).toBe('foobar');
    expect(normalise('124.200')).toBe('124.200');
  });
});

describe('scoring', () => {
  it('sums banked points and reports progress', () => {
    const s = score({ a: solve(100), b: solve(250) });
    expect(s.points).toBe(350);
    expect(s.solvedCount).toBe(2);
    expect(s.totalPoints).toBe(TOTAL_POINTS);
  });

  it('ranks by share of the total, not raw points', () => {
    expect(rankFor(0)).toBe('Unlicensed');
    expect(rankFor(TOTAL_POINTS)).toBe('Signals Officer');
    expect(rankFor(Math.round(TOTAL_POINTS * 0.5))).toBe('Operator');
  });
});

describe('share text', () => {
  const built = () =>
    shareText({ [CHALLENGES[0].id]: solve(100), [CHALLENGES[1].id]: solve(170, 1) }, 'https://x.test');

  it('never leaks a flag or a challenge name', () => {
    const t = built();
    expect(t.toLowerCase()).not.toContain('spectra{');
    for (const c of CHALLENGES) expect(t).not.toContain(c.name);
  });

  it('marks clean solves apart from hinted ones', () => {
    const t = built();
    expect(t).toContain('🟩'); // solved with no hints
    expect(t).toContain('🟨'); // solved after a hint
    expect(t).toContain('⬜'); // still unsolved
  });

  it('carries score, rank and a link', () => {
    const t = built();
    expect(t).toContain('2/10 flags');
    expect(t).toContain('https://x.test/?view=ctf');
    expect(t.split('\n').length).toBeGreaterThanOrEqual(4);
  });
});
