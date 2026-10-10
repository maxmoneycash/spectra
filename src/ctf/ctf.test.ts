import { describe, it, expect } from 'vitest';
import { CHALLENGES, TOTAL_POINTS } from './challenges';
import { checkFlag, normalise, score, shareText, type Solve } from './store';
import { encodeMorse, MorseDecoder, MORSE } from '../sim/morse';

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
    expect(await checkFlag('morse-beacon', 'LISTEN UP')).toBe(true);
    expect(await checkFlag('morse-beacon', 'listen up')).toBe(true);
    expect(await checkFlag('morse-beacon', ' Listen  Up ')).toBe(true);
    expect(await checkFlag('morse-beacon', 'listen_up')).toBe(true);
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

  // Rank moved to src/progression/rank.ts — one ladder for the card and the CTF.
});

describe('share text', () => {
  const built = () =>
    shareText({ [CHALLENGES[0].id]: solve(100), [CHALLENGES[1].id]: solve(170, 1) }, 'https://x.test', 'Listener');

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
    expect(t).toContain(`2/${CHALLENGES.length} flags`);
    expect(t).toContain('https://x.test/?view=ctf');
    expect(t.split('\n').length).toBeGreaterThanOrEqual(4);
  });
});

describe('CW challenges are actually solvable', () => {
  // The bug this guards: braces are not in the Morse table, so `encodeMorse`
  // dropped them silently (and ate the word gap with them). The answer key was
  // right and the transmitter simply could not produce it — a player read
  // "SPECTRALISTEN UP" off the decoder and was rejected. Assert the full
  // encode -> decode -> checkFlag chain, not just the hash.
  const cwChallenges = CHALLENGES.filter((c) => c.emitters.some((e) => e.kind === 'cw' && e.text));

  it('covers every CW challenge', () => {
    expect(cwChallenges.length).toBeGreaterThan(0);
  });

  for (const c of cwChallenges) {
    it(`${c.id}: what the decoder emits contains the flag`, async () => {
      const emitter = c.emitters.find((e) => e.kind === 'cw' && e.text)!;
      const decoder = new MorseDecoder();
      for (const seg of encodeMorse(emitter.text!, emitter.wpm ?? 18)) {
        decoder.push(seg.on, seg.durSec);
      }
      const heard = decoder.output;

      // Every character the challenge transmits must survive the Morse table.
      const sendable = emitter
        .text!.toUpperCase()
        .split('')
        .filter((ch) => ch !== ' ')
        .every((ch) => ch in MORSE);
      expect(sendable, `${c.id} transmits a character Morse cannot send`).toBe(true);

      // And some run of what was heard must be the accepted answer — unless
      // this mission keys Morse that is deliberately NOT the flag.
      if (DECOY_CW.has(c.id)) return;
      const words = heard.split(/\s+/).filter(Boolean);
      let solvable = false;
      for (let i = 0; i < words.length && !solvable; i++) {
        for (let j = i + 1; j <= words.length && !solvable; j++) {
          if (await checkFlag(c.id, words.slice(i, j).join(' '))) solvable = true;
        }
      }
      expect(solvable, `${c.id}: decoder emitted "${heard}", which never matches the flag`).toBe(
        true,
      );
    });
  }

  it('every decoy-CW mission is really not a decode mission', () => {
    for (const id of DECOY_CW) {
      const c = CHALLENGES.find((x) => x.id === id)!;
      expect(c, id).toBeDefined();
      expect(c.category).not.toBe('decode');
    }
  });
});

/**
 * Missions whose CW is scenery, not the answer: Cold Case keys a station ID
 * so there is a third emitter to count, and its flag is that count. Listing
 * them here keeps the guard honest for every other CW mission — a new one
 * that forgets to key its flag still fails loudly.
 */
const DECOY_CW = new Set<string>(['cold-case']);
